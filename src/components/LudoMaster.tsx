import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Flag,
  Gamepad2,
  Lock,
  Receipt,
  RotateCcw,
  Shield,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { getStore, subscribeStore } from '../lib/localStore';
import {
  creditMatchWinnings,
  extractWalletErrorMessage,
  MAX_GAME_STAKE_UGX,
  MIN_GAME_STAKE_UGX,
  payGameEntryStake,
} from '../lib/walletService';
import {
  applyLudoMove,
  chooseLudoBotToken,
  createInitialLudoState,
  getPathBlockadeColor,
  LUDO_COLOR_LABELS,
  rollLudoDice,
  toSanitizedLudoState,
  type InternalLudoState,
} from '../shared/ludoEngine';
import {
  ALL_CLUB_IDS,
  CLUB_BADGES,
  ClubBadge,
  DEFAULT_CLUB_BY_COLOR,
  type ClubId,
} from './ClubBadges';
import { ThreeLudoBoard } from './three/ThreeLudoBoard';
import { TableChatPanel } from './TableChatPanel';
import type { TypingIndicatorUser } from './ChatTypingBubble';
import { useGameFullscreen } from '../hooks/useGameFullscreen';
import proBgLudo from '../assets/images/pro_bg_ludo_1794922550828.jpg';
import { CHAT_PRESETS, type ChatPresetId, type RoomChatMessage } from '../shared/chatPresets';
import { soundFx } from '../utils/sound';
import {
  DEFAULT_AI_ROSTER,
  generateAiGameReaction,
  generateAiJoinGreeting,
  normalizeAiConfig,
  pickBalancedAiPersonas,
  type AiGovernanceConfig,
  type AiPersonaProfile,
} from '../shared/aiPersonas';
import { requestSmartContenderReply } from '../lib/smartReplyClient';
import type { LudoColor, SanitizedLudoState, SanitizedSeatState } from '../shared/types';

const COLOR_TEXT_CLASSES: Record<LudoColor, string> = {
  green: 'text-emerald-400',
  yellow: 'text-[#FFD76A]',
  red: 'text-red-400',
  blue: 'text-sky-400',
};

function buildRealNameColorProfiles(
  roster = DEFAULT_AI_ROSTER
): Record<LudoColor, { name: string; rating: number; gender: 'female' | 'male'; persona: AiPersonaProfile }> {
  const picked = pickBalancedAiPersonas(roster, 4);
  const colors: LudoColor[] = ['green', 'yellow', 'red', 'blue'];
  const out = {} as Record<LudoColor, { name: string; rating: number; gender: 'female' | 'male'; persona: AiPersonaProfile }>;
  colors.forEach((c, idx) => {
    const p = picked[idx] || DEFAULT_AI_ROSTER[idx] || DEFAULT_AI_ROSTER[0];
    out[c] = { name: p.name, rating: p.rating, gender: p.gender, persona: p };
  });
  return out;
}

const STAKE_OPTIONS = [1000, 2000, 5000, 10000, 25000] as const;

function getDefaultRivalColor(playerColor: LudoColor): LudoColor {
  const opposite: Record<LudoColor, LudoColor> = {
    red: 'yellow',
    yellow: 'red',
    green: 'blue',
    blue: 'green',
  };
  return opposite[playerColor];
}

function createTicketId(): string {
  return `LM-${Math.floor(1000 + Math.random() * 9000)}`;
}

export interface LudoMasterProps {
  ludoState?: SanitizedLudoState;
  seats?: SanitizedSeatState[];
  viewerUid?: string;
  isYourTurn?: boolean;
  gameStatus?: 'waiting' | 'in_progress' | 'completed';
  onRoll?: () => void;
  onMoveToken?: (tokenIndex: number) => void;
  onResign?: () => void;
  initialPlayerCount?: 2 | 3 | 4;
  playerName?: string;
  onLaunchFullMatch?: (playerCount: 2 | 3 | 4, stakeUgx?: number) => void;
  launchingFullMatch?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

function renderDiceIcon(value: number | null) {
  switch (value) {
    case 1:
      return <Dice1 className="h-4 w-4 text-[#93A8FF]" />;
    case 2:
      return <Dice2 className="h-4 w-4 text-[#93A8FF]" />;
    case 3:
      return <Dice3 className="h-4 w-4 text-[#93A8FF]" />;
    case 4:
      return <Dice4 className="h-4 w-4 text-[#93A8FF]" />;
    case 5:
      return <Dice5 className="h-4 w-4 text-[#93A8FF]" />;
    case 6:
      return <Dice6 className="h-4 w-4 text-[#93A8FF]" />;
    default:
      return <Dice6 className="h-4 w-4 text-[#93A8FF]" />;
  }
}

export const LudoMaster: React.FC<LudoMasterProps> = ({
  ludoState: externalState,
  seats: externalSeats,
  viewerUid: externalViewerUid,
  isYourTurn: externalIsYourTurn,
  gameStatus: externalGameStatus,
  onRoll: externalOnRoll,
  onMoveToken: externalOnMoveToken,
  onResign: externalOnResign,
  initialPlayerCount = 4,
  playerName = 'You',
  onLaunchFullMatch,
  launchingFullMatch = false,
  isFullscreen: externalIsFullscreen = false,
  onToggleFullscreen,
}) => {
  const isControlled = Boolean(externalState);
  const { firebaseUser, userDoc, wallet } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const standaloneFullscreen = useGameFullscreen(containerRef);
  const effectiveFullscreen = isControlled
    ? externalIsFullscreen
    : standaloneFullscreen.isFullscreen;
  const handleToggleFullscreen =
    onToggleFullscreen ?? (() => void standaloneFullscreen.toggleFullscreen());
  const lockingBetRef = useRef<boolean>(false);

  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(initialPlayerCount);
  const [humanColor, setHumanColor] = useState<LudoColor>('blue');
  const [opponentColor, setOpponentColor] = useState<LudoColor>(() => getDefaultRivalColor('blue'));
  const [internalState, setInternalState] = useState<InternalLudoState>(() =>
    createInitialLudoState(initialPlayerCount, 'blue', getDefaultRivalColor('blue'))
  );
  const [standaloneBanner, setStandaloneBanner] = useState<string>(
    'Table Open (Preview Mode): Choose your UGX entry stake (Min 1,000) & club, then stake to unlock rolls!'
  );

  const bankroll = isControlled ? 0 : Number(wallet?.availableBalance ?? 0);
  const [stakeInput, setStakeInput] = useState<string>(String(MIN_GAME_STAKE_UGX));
  const rawStakeInput = Math.round(Number(stakeInput));
  const stakeAmount = Number.isFinite(rawStakeInput) ? rawStakeInput : 0;
  const [betStatus, setBetStatus] = useState<'pending' | 'locked' | 'won' | 'lost'>('pending');
  const [stakeBusy, setStakeBusy] = useState(false);
  const [ticketId, setTicketId] = useState<string>(() => createTicketId());
  const [entryKoCount, setEntryKoCount] = useState<number>(0);
  const [entryKoBonusEarned, setEntryKoBonusEarned] = useState<number>(0);
  const [settlementInfo, setSettlementInfo] = useState<{
    won: boolean;
    stake: number;
    payout: number;
    netProfit: number;
    players: number;
    entryKos: number;
    entryKoBonus: number;
    winnerClub: string;
    ticketId: string;
  } | null>(null);
  const settledTicketRef = useRef<string | null>(null);

  const [isRolling, setIsRolling] = useState(false);
  const [rollingFace, setRollingFace] = useState<number>(6);
  const [aiConfig, setAiConfig] = useState<AiGovernanceConfig>(() => normalizeAiConfig(getStore().aiConfig));
  const [opponentProfiles, setOpponentProfiles] = useState<
    Record<LudoColor, { name: string; rating: number; gender: 'female' | 'male'; persona: AiPersonaProfile }>
  >(() => buildRealNameColorProfiles(getStore().aiConfig.roster));
  const [ludoChatMessages, setLudoChatMessages] = useState<RoomChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingIndicatorUser[]>([]);
  const ludoChatRef = useRef<RoomChatMessage[]>([]);
  const lastCaptureReactionRef = useRef<number>(0);
  const chatTimersRef = useRef<number[]>([]);

  useEffect(() => {
    ludoChatRef.current = ludoChatMessages;
  }, [ludoChatMessages]);

  useEffect(() => {
    if (isControlled) return;
    const sync = () => {
      const nextCfg = normalizeAiConfig(getStore().aiConfig);
      setAiConfig(nextCfg);
    };
    sync();
    return subscribeStore(sync);
  }, [isControlled]);

  useEffect(() => {
    if (isControlled) return;
    const rivalColors = internalState.activeColors.slice(1);
    const firstRivalColor = rivalColors[0];
    if (!firstRivalColor) return;
    const opp = opponentProfiles[firstRivalColor];
    if (!opp) return;

    const timer = window.setTimeout(() => {
      setLudoChatMessages((prev) => {
        if (prev.length > 0) return prev;
        const greeting = generateAiJoinGreeting(opp.persona, playerName, 'ludo');
        return [
          {
            id: `ludo_sys_${Date.now()}`,
            roomId: 'ludo_lobby',
            uid: 'system',
            senderName: 'Ludo Table',
            text: `Seated with ${rivalColors.map((c) => opponentProfiles[c]?.name).filter(Boolean).join(', ')}.`,
            createdAtMs: Date.now(),
            isSystem: true,
          },
          {
            id: `ludo_greet_${Date.now()}`,
            roomId: 'ludo_lobby',
            uid: `local-bot-1`,
            senderName: opp.name,
            text: greeting,
            createdAtMs: Date.now() + 10,
            isFreeText: true,
            isAi: true,
            senderGender: opp.gender,
          },
        ];
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isControlled, internalState.activeColors, opponentProfiles, playerName]);

  useEffect(() => {
    return () => {
      chatTimersRef.current.forEach((id) => window.clearTimeout(id));
      chatTimersRef.current = [];
    };
  }, []);

  const rollIntervalRef = useRef<number | null>(null);
  const rollTimeoutRef = useRef<number | null>(null);
  const lastExternalSignalRef = useRef<string>('');

  const clearRollTimers = useCallback(() => {
    if (rollIntervalRef.current !== null) {
      window.clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
    if (rollTimeoutRef.current !== null) {
      window.clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearRollTimers();
    };
  }, [clearRollTimers]);

  const standaloneBuilt = useMemo(() => {
    const activeHumanColor = internalState.activeColors[0];
    const seatColors: Record<string, LudoColor> = {
      'local-human': activeHumanColor,
    };
    const seats: SanitizedSeatState[] = [
      {
        seatIndex: 0,
        uid: 'local-human',
        playerId: 'local-human',
        displayName: playerName,
        isBot: false,
        connected: true,
        cardCount: 4,
        calledLastCard: false,
        score: 0,
      },
    ];
    internalState.activeColors.slice(1).forEach((color, idx) => {
      const botUid = `local-bot-${idx + 1}`;
      seatColors[botUid] = color;
      const opp = opponentProfiles[color];
      seats.push({
        seatIndex: idx + 1,
        uid: botUid,
        playerId: botUid,
        displayName: opp.name,
        isBot: true,
        gender: opp.gender,
        connected: true,
        cardCount: 4,
        calledLastCard: false,
        score: 0,
      });
    });

    const sanitized = toSanitizedLudoState(internalState, seatColors);
    const status: 'waiting' | 'in_progress' | 'completed' = internalState.winnerColor
      ? 'completed'
      : betStatus === 'pending'
      ? 'waiting'
      : 'in_progress';
    const isHumanTurn =
      status === 'in_progress' && !internalState.winnerColor && internalState.turnColor === activeHumanColor;

    return { sanitized, seats, humanUid: 'local-human', status, isHumanTurn };
  }, [internalState, playerName, opponentProfiles, betStatus]);

  const activeLudoState = isControlled && externalState ? externalState : standaloneBuilt.sanitized;
  const activeSeats = isControlled && externalSeats ? externalSeats : standaloneBuilt.seats;
  const activeViewerUid = isControlled && externalViewerUid ? externalViewerUid : standaloneBuilt.humanUid;
  const activeGameStatus = isControlled && externalGameStatus ? externalGameStatus : standaloneBuilt.status;
  const activeIsYourTurn = isControlled ? Boolean(externalIsYourTurn) : standaloneBuilt.isHumanTurn;

  const viewerColor: LudoColor =
    activeLudoState.seatColors[activeViewerUid] || activeLudoState.activeColors[0] || humanColor;
  const canRoll =
    !isRolling &&
    activeGameStatus === 'in_progress' &&
    activeIsYourTurn &&
    activeLudoState.phase === 'roll';
  const canMove =
    !isRolling &&
    activeGameStatus === 'in_progress' &&
    activeIsYourTurn &&
    activeLudoState.phase === 'move';

  const triggerDiceAnimation = useCallback(
    (targetFinalFace?: number, onCommit?: () => void) => {
      clearRollTimers();
      setIsRolling(true);
      setRollingFace((prev) => (prev % 6) + 1);
      soundFx.play('ludo-roll');

      rollIntervalRef.current = window.setInterval(() => {
        setRollingFace((prev) => {
          let next = Math.floor(Math.random() * 6) + 1;
          if (next === prev) next = (prev % 6) + 1;
          return next;
        });
      }, 90);

      rollTimeoutRef.current = window.setTimeout(() => {
        if (rollIntervalRef.current !== null) {
          window.clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
        }
        if (targetFinalFace) {
          setRollingFace(targetFinalFace);
        }
        setIsRolling(false);
        if (onCommit) onCommit();
      }, 420);
    },
    [clearRollTimers]
  );

  useEffect(() => {
    if (!isControlled || !externalState) return;
    const signal = `${externalState.turnColor}:${externalState.phase}:${externalState.diceValue}:${externalState.moveHistory.length}`;
    if (!lastExternalSignalRef.current) {
      lastExternalSignalRef.current = signal;
      return;
    }
    if (lastExternalSignalRef.current !== signal) {
      const prevPhase = lastExternalSignalRef.current.split(':')[1];
      lastExternalSignalRef.current = signal;
      if (externalState.diceValue !== null && (externalState.phase === 'move' || prevPhase === 'roll')) {
        if (!isRolling) {
          triggerDiceAnimation(externalState.diceValue);
        }
      }
    }
  }, [isControlled, externalState, isRolling, triggerDiceAnimation]);

  const grossPot = stakeAmount * playerCount;
  const potentialNetProfit = stakeAmount * (playerCount - 1);
  const entryKoUnitBonus = Math.round(stakeAmount * 0.2);

  useEffect(() => {
    if (isControlled || !internalState.winnerColor || settledTicketRef.current === ticketId) {
      return;
    }
    settledTicketRef.current = ticketId;
    const activeHumanColor = internalState.activeColors[0];
    const won = internalState.winnerColor === activeHumanColor;
    const payout = won ? stakeAmount * playerCount : 0;
    const netProfit = won ? payout - stakeAmount + entryKoBonusEarned : -stakeAmount + entryKoBonusEarned;
    const winnerClub = CLUB_BADGES[DEFAULT_CLUB_BY_COLOR[internalState.winnerColor]].name;

    if (won) {
      setBetStatus('won');
      soundFx.play('win');
      const totalCredit = payout + entryKoBonusEarned;
      setStandaloneBanner(
        `CLASSIC POT WON! ${winnerClub} sweeps the UGX ${totalCredit.toLocaleString()} payout!`
      );
      if (firebaseUser && totalCredit >= MIN_GAME_STAKE_UGX) {
        void creditMatchWinnings({
          uid: firebaseUser.uid,
          playerId: userDoc?.playerId,
          amountUgx: totalCredit,
          gameLabel: `Ludo Master ${playerCount}-Club Pot (#${ticketId})`,
        }).catch(() => {});
      }
    } else {
      setBetStatus('lost');
      setStandaloneBanner(
        `${winnerClub} (${opponentProfiles[internalState.winnerColor].name}) took the UGX ${grossPot.toLocaleString()} pot.`
      );
      if (firebaseUser && entryKoBonusEarned >= MIN_GAME_STAKE_UGX) {
        void creditMatchWinnings({
          uid: firebaseUser.uid,
          playerId: userDoc?.playerId,
          amountUgx: entryKoBonusEarned,
          gameLabel: `Ludo Master Entry KO Bonus (#${ticketId})`,
        }).catch(() => {});
      }
    }

    setSettlementInfo({
      won,
      stake: stakeAmount,
      payout,
      netProfit,
      players: playerCount,
      entryKos: entryKoCount,
      entryKoBonus: entryKoBonusEarned,
      winnerClub,
      ticketId,
    });
  }, [
    isControlled,
    internalState.winnerColor,
    internalState.activeColors,
    ticketId,
    playerCount,
    stakeAmount,
    grossPot,
    entryKoCount,
    entryKoBonusEarned,
    opponentProfiles,
    firebaseUser,
    userDoc?.playerId,
  ]);

  const handleLockStandaloneStake = useCallback(async () => {
    if (isControlled || betStatus !== 'pending' || lockingBetRef.current) return;
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setStandaloneBanner('Sign in with your verified account to lock a UGX stake and play.');
      return;
    }
    if (!Number.isFinite(stakeAmount) || stakeAmount < MIN_GAME_STAKE_UGX || stakeAmount > MAX_GAME_STAKE_UGX) {
      setStandaloneBanner(
        `Entry price must be between UGX ${MIN_GAME_STAKE_UGX.toLocaleString()} and UGX ${MAX_GAME_STAKE_UGX.toLocaleString()}.`
      );
      return;
    }
    if (bankroll < stakeAmount) {
      setStandaloneBanner(
        `Insufficient UGX balance (${bankroll.toLocaleString()}). Deposit at least UGX ${stakeAmount.toLocaleString()} to play.`
      );
      return;
    }
    lockingBetRef.current = true;
    setStakeBusy(true);
    try {
      await payGameEntryStake({
        uid: firebaseUser.uid,
        playerId: userDoc?.playerId,
        amountUgx: stakeAmount,
        gameLabel: `Ludo Master ${playerCount}-Club Table (#${ticketId})`,
      });
      setBetStatus('locked');
      soundFx.play('match');
      setStandaloneBanner(
        `Stake locked (UGX ${stakeAmount.toLocaleString()})! Tap the 3D die or press R to roll.`
      );
    } catch (err) {
      setStandaloneBanner(extractWalletErrorMessage(err, 'Unable to lock table stake.'));
    } finally {
      lockingBetRef.current = false;
      setStakeBusy(false);
    }
  }, [isControlled, betStatus, firebaseUser, stakeAmount, bankroll, userDoc?.playerId, playerCount, ticketId]);

  const handleStandaloneRoll = useCallback(async () => {
    if (isRolling || betStatus !== 'locked' || internalState.winnerColor || internalState.phase !== 'roll') return;

    const outcome = rollLudoDice(internalState);
    if (!outcome) return;

    triggerDiceAnimation(outcome.diceValue, () => {
      setInternalState(outcome.nextState);
      if (outcome.diceValue === 6) {
        soundFx.play('ludo-six');
      }
      const actorColor = internalState.turnColor;
      const actorClub = LUDO_COLOR_LABELS[actorColor];
      const wasBlocked = (internalState.tokensByColor[actorColor] || []).some(
        (pos) =>
          pos >= 0 &&
          pos + outcome.diceValue <= 56 &&
          getPathBlockadeColor(internalState, actorColor, pos, outcome.diceValue) !== null
      );
      const actorOppName = opponentProfiles[outcome.nextState.turnColor].name;

      if (outcome.forfeitedByThreeSixes) {
        setStandaloneBanner(`${actorClub} rolled three 6s — turn forfeited.`);
      } else if (outcome.noLegalMoves && outcome.diceValue === 6) {
        setStandaloneBanner(
          `${actorClub} rolled 6 (blocked by opponent pair) — roll again for your 2nd 6!`
        );
      } else if (outcome.noLegalMoves) {
        setStandaloneBanner(
          wasBlocked
            ? `${actorClub} rolled ${outcome.diceValue} · Blocked by 2-button wall (need two 6s to pass).`
            : `${actorClub} rolled ${outcome.diceValue} with no legal pawn moves.`
        );
      } else if (outcome.unlockedDoubleSix) {
        const isHuman = outcome.nextState.turnColor === outcome.nextState.activeColors[0];
        setStandaloneBanner(
          isHuman
            ? `2x SIXES! You rolled two 6s — you can now PASS opponent pairs or LEAVE them!`
            : `${actorClub} (${actorOppName}) rolled 2x SIXES — blockade pass unlocked!`
        );
      } else {
        const isHuman = outcome.nextState.turnColor === outcome.nextState.activeColors[0];
        setStandaloneBanner(
          isHuman
            ? `You rolled ${outcome.diceValue}! Pick a ${LUDO_COLOR_LABELS[viewerColor]} pawn.`
            : `${actorClub} (${actorOppName}) rolled ${outcome.diceValue}…`
        );
      }
    });
  }, [
    isRolling,
    internalState,
    betStatus,
    triggerDiceAnimation,
    viewerColor,
    opponentProfiles,
  ]);

  const handleStandaloneMove = useCallback(
    (tokenIndex: number) => {
      if (isRolling || internalState.winnerColor || internalState.phase !== 'move') return;
      const actorColor = internalState.turnColor;
      const activeHuman = internalState.activeColors[0];
      const outcome = applyLudoMove(internalState, tokenIndex);
      if (!outcome) return;

      setInternalState(outcome.nextState);

      if (outcome.entryCapturedColors.length > 0 && actorColor === activeHuman) {
        const koBonus = entryKoUnitBonus * outcome.entryCapturedColors.length;
        setEntryKoCount((prev) => prev + outcome.entryCapturedColors.length);
        setEntryKoBonusEarned((prev) => prev + koBonus);
        setStandaloneBanner(
          `${outcome.moveSummary} (+UGX ${koBonus.toLocaleString()} Entry KO bonus queued for settlement!)`
        );
      } else {
        setStandaloneBanner(outcome.moveSummary);
      }

      if (outcome.nextState.winnerColor) {
        soundFx.play('win');
        const winnerName =
          outcome.nextState.winnerColor === activeHuman
            ? playerName
            : opponentProfiles[outcome.nextState.winnerColor].name;
        const rivalColor = outcome.nextState.activeColors.slice(1)[0];
        if (rivalColor && aiConfig.aiChatEnabled) {
          const opp = opponentProfiles[rivalColor];
          const recentTexts = ludoChatRef.current.map((m) => m.text);
          setLudoChatMessages((prev) => [
            ...prev.slice(-29),
            {
              id: `ludo_react_${Date.now()}`,
              roomId: 'ludo_lobby',
              uid: 'local-bot-1',
              senderName: opp.name,
              text: generateAiGameReaction(opp.persona, 'victory', winnerName, recentTexts),
              createdAtMs: Date.now(),
              isFreeText: true,
              isAi: true,
              senderGender: opp.gender,
            },
          ]);
        }
      } else if (outcome.capturedColors.length > 0) {
        soundFx.play('ludo-capture');
        const rivalColor = outcome.nextState.activeColors.slice(1)[0];
        const nowMs = Date.now();
        if (
          rivalColor &&
          aiConfig.aiChatEnabled &&
          nowMs - lastCaptureReactionRef.current > 35000 &&
          Math.random() < 0.25
        ) {
          lastCaptureReactionRef.current = nowMs;
          const opp = opponentProfiles[rivalColor];
          const actorName = actorColor === activeHuman ? playerName : opponentProfiles[actorColor].name;
          const recentTexts = ludoChatRef.current.map((m) => m.text);
          setLudoChatMessages((prev) => [
            ...prev.slice(-29),
            {
              id: `ludo_react_${nowMs}`,
              roomId: 'ludo_lobby',
              uid: 'local-bot-1',
              senderName: opp.name,
              text: generateAiGameReaction(opp.persona, 'ludo_capture', actorName, recentTexts),
              createdAtMs: nowMs,
              isFreeText: true,
              isAi: true,
              senderGender: opp.gender,
            },
          ]);
        }
      } else if (outcome.reachedHome) {
        soundFx.play('ludo-home');
      } else {
        soundFx.play('ludo-move');
      }
    },
    [isRolling, internalState, entryKoUnitBonus, aiConfig.aiChatEnabled, opponentProfiles, playerName]
  );

  useEffect(() => {
    if (isControlled || betStatus !== 'locked' || isRolling || internalState.winnerColor) return;
    const activeHuman = internalState.activeColors[0];
    if (internalState.turnColor === activeHuman) return;

    if (internalState.phase === 'roll') {
      const timer = window.setTimeout(() => {
        void handleStandaloneRoll();
      }, 340);
      return () => window.clearTimeout(timer);
    }

    if (internalState.phase === 'move') {
      const timer = window.setTimeout(() => {
        const chosen = chooseLudoBotToken(internalState);
        if (chosen !== null) {
          handleStandaloneMove(chosen);
        }
      }, 320);
      return () => window.clearTimeout(timer);
    }
  }, [isControlled, betStatus, isRolling, internalState, handleStandaloneRoll, handleStandaloneMove]);

  const resetStandaloneMatch = useCallback(
    (
      nextCount: 2 | 3 | 4 = playerCount,
      nextClubColor: LudoColor = humanColor,
      nextStake: number = stakeAmount,
      nextOpponentColor: LudoColor = opponentColor
    ) => {
      clearRollTimers();
      setIsRolling(false);
      const resolvedOpponent =
        nextOpponentColor === nextClubColor ? getDefaultRivalColor(nextClubColor) : nextOpponentColor;
      setPlayerCount(nextCount);
      setHumanColor(nextClubColor);
      setOpponentColor(resolvedOpponent);
      const validNextStake = Math.max(MIN_GAME_STAKE_UGX, Math.min(MAX_GAME_STAKE_UGX, Math.round(nextStake || MIN_GAME_STAKE_UGX)));
      setStakeInput(String(validNextStake));
      setBetStatus('pending');
      setEntryKoCount(0);
      setEntryKoBonusEarned(0);
      setSettlementInfo(null);
      settledTicketRef.current = null;
      setTicketId(createTicketId());
      setLudoChatMessages([]);
      setOpponentProfiles(buildRealNameColorProfiles(getStore().aiConfig.roster));
      setInternalState(createInitialLudoState(nextCount, nextClubColor, resolvedOpponent));
      const pot = nextStake * nextCount;
      setStandaloneBanner(
        `Table Open for ${LUDO_COLOR_LABELS[nextClubColor]} · Entry UGX ${nextStake.toLocaleString()} each (Pot UGX ${pot.toLocaleString()}). Stake to unlock gameplay!`
      );
    },
    [clearRollTimers, playerCount, humanColor, stakeAmount, opponentColor]
  );

  const handleSelectClub = useCallback(
    (clubId: ClubId) => {
      const nextColor = CLUB_BADGES[clubId].defaultColor;
      if (nextColor === humanColor || betStatus === 'locked') return;
      const nextRival = opponentColor === nextColor ? getDefaultRivalColor(nextColor) : opponentColor;
      resetStandaloneMatch(playerCount, nextColor, stakeAmount, nextRival);
    },
    [humanColor, betStatus, playerCount, stakeAmount, opponentColor, resetStandaloneMatch]
  );

  const handleSelectOpponent = useCallback(
    (clubId: ClubId) => {
      const nextRival = CLUB_BADGES[clubId].defaultColor;
      if (nextRival === humanColor || betStatus === 'locked') return;
      resetStandaloneMatch(2, humanColor, stakeAmount, nextRival);
    },
    [humanColor, betStatus, stakeAmount, resetStandaloneMatch]
  );

  const handleRollClick = useCallback(() => {
    if (!canRoll) return;
    if (isControlled) {
      triggerDiceAnimation();
      externalOnRoll?.();
    } else {
      void handleStandaloneRoll();
    }
  }, [canRoll, isControlled, triggerDiceAnimation, externalOnRoll, handleStandaloneRoll]);

  const handleStandaloneChatSend = useCallback(
    (payload: { text?: string; presetId?: ChatPresetId }) => {
      if (isControlled || !aiConfig.liveUserChatEnabled) return;
      const preset = payload.presetId ? CHAT_PRESETS.find((p) => p.id === payload.presetId) : undefined;
      const text = (payload.text || preset?.text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
      if (!text) return;

      const userMsg: RoomChatMessage = {
        id: `ludo_me_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        roomId: 'ludo_lobby',
        uid: 'local-human',
        senderName: playerName,
        presetId: preset?.id,
        text,
        createdAtMs: Date.now(),
        isFreeText: Boolean(payload.text),
      };
      const historySnapshot = ludoChatRef.current.filter((m) => !m.isSystem).slice(-10);
      setLudoChatMessages((prev) => [...prev.slice(-29), userMsg]);

      const rivalColors = internalState.activeColors.slice(1);
      if (rivalColors.length > 0 && aiConfig.aiEnabled && aiConfig.aiChatEnabled) {
        const lowerText = text.toLowerCase();
        const addressedIdx = rivalColors.findIndex((c) => {
          const oppName = opponentProfiles[c].name;
          const first = oppName.split(' ')[0] || '';
          return (
            lowerText.includes(oppName.toLowerCase()) ||
            (first.length >= 3 && new RegExp(`\\b${first}\\b`, 'i').test(text))
          );
        });
        const idx = addressedIdx >= 0 ? addressedIdx : 0;
        const responderColor = rivalColors[idx];
        const opp = opponentProfiles[responderColor];
        const botUid = `local-bot-${idx + 1}`;
        const roomSummary = `Ludo Master (${internalState.activeColors.length} players) · Turn: ${internalState.turnColor} · Last dice: ${internalState.diceValue ?? 'none'}`;
        const t1 = window.setTimeout(() => {
          const typingStartedAt = Date.now();
          setTypingUsers((prev) => [
            ...prev.filter((u) => u.uid !== botUid),
            { uid: botUid, senderName: opp.name, senderGender: opp.gender },
          ]);
          void requestSmartContenderReply({
            persona: opp.persona,
            senderName: playerName,
            text,
            context: 'ludo',
            gameType: 'ludo',
            roomSummary,
            history: historySnapshot.map((m) => ({
              senderName: m.senderName,
              text: m.text,
              isSelf: m.senderName === opp.name,
            })),
          }).then((replyText) => {
            const targetDuration = replyText
              ? Math.min(2100, Math.max(950, replyText.length * 22))
              : 0;
            const remaining = Math.max(0, targetDuration - (Date.now() - typingStartedAt));
            const t2 = window.setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u.uid !== botUid));
              if (!replyText) return;
              setLudoChatMessages((prev) => [
                ...prev.slice(-29),
                {
                  id: `ludo_ai_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                  roomId: 'ludo_lobby',
                  uid: botUid,
                  senderName: opp.name,
                  text: replyText,
                  createdAtMs: Date.now(),
                  isFreeText: true,
                  isAi: true,
                  senderGender: opp.gender,
                },
              ]);
            }, remaining);
            chatTimersRef.current.push(t2);
          });
        }, 380);
        chatTimersRef.current.push(t1);
      }
    },
    [isControlled, aiConfig, playerName, internalState.activeColors, internalState.turnColor, internalState.diceValue, opponentProfiles]
  );

  const handlePawnMoveClick = useCallback(
    (tokenIndex: number) => {
      if (!canMove) return;
      if (isControlled) {
        externalOnMoveToken?.(tokenIndex);
      } else {
        handleStandaloneMove(tokenIndex);
      }
    },
    [canMove, isControlled, externalOnMoveToken, handleStandaloneMove]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!canRoll) return;

      const isR = e.key.toLowerCase() === 'r';
      const isSpace = e.key === ' ';
      const insideBoard = containerRef.current?.contains(document.activeElement);
      if (isR || (isSpace && (isControlled || insideBoard))) {
        e.preventDefault();
        handleRollClick();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canRoll, isControlled, handleRollClick]);

  const seatByColor = useMemo(() => {
    const map: Partial<Record<LudoColor, SanitizedSeatState>> = {};
    for (const s of activeSeats) {
      const c = activeLudoState.seatColors[s.uid];
      if (c) map[c] = s;
    }
    return map;
  }, [activeSeats, activeLudoState.seatColors]);

  const blockedPawnReasons = useMemo(() => {
    if (!canMove || activeLudoState.diceValue === null || activeLudoState.doubleSixUnlocked) {
      return [] as Array<{ tokenIndex: number; blockerClub: string }>;
    }
    const dice = activeLudoState.diceValue;
    const tokens = activeLudoState.tokensByColor[viewerColor] || [];
    const blocked: Array<{ tokenIndex: number; blockerClub: string }> = [];
    tokens.forEach((pos, idx) => {
      if (pos >= 0 && pos + dice <= 56 && !activeLudoState.legalTokenIndices.includes(idx)) {
        const blockerColor = getPathBlockadeColor(activeLudoState, viewerColor, pos, dice);
        if (blockerColor) {
          blocked.push({
            tokenIndex: idx,
            blockerClub: CLUB_BADGES[DEFAULT_CLUB_BY_COLOR[blockerColor]].name,
          });
        }
      }
    });
    return blocked;
  }, [canMove, activeLudoState, viewerColor]);

  const displayedDiceValue = isRolling ? rollingFace : activeLudoState.diceValue;
  const turnSeat = seatByColor[activeLudoState.turnColor];
  const viewerClub = CLUB_BADGES[DEFAULT_CLUB_BY_COLOR[viewerColor]];
  const turnClub = CLUB_BADGES[DEFAULT_CLUB_BY_COLOR[activeLudoState.turnColor]];

  const winnerClubName = activeLudoState.winnerColor
    ? CLUB_BADGES[DEFAULT_CLUB_BY_COLOR[activeLudoState.winnerColor]].name
    : null;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={
        !isControlled && standaloneFullscreen.isFullscreen
          ? 'fixed inset-0 z-50 h-dvh w-screen overflow-y-auto pro-arena-shell p-4 sm:p-6 focus:outline-none'
          : 'relative overflow-hidden rounded-2xl border border-[#D4AF37]/30 pro-table-bezel bg-gradient-to-b from-[#060E09]/94 to-[#040806]/98 p-4 sm:p-6 focus:outline-none'
      }
    >
      {!isControlled && standaloneFullscreen.isFullscreen && (
        <>
          <img
            src={proBgLudo}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-45"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#040806]/72 via-[#050A08]/54 to-[#030605]/86"
          />
        </>
      )}

      <div
        className={`relative z-10 grid grid-cols-1 gap-6 items-start ${
          effectiveFullscreen
            ? !isControlled
              ? 'mx-auto max-w-none'
              : ''
            : isControlled
            ? '2xl:grid-cols-[minmax(0,1fr)_305px]'
            : 'xl:grid-cols-[minmax(0,1fr)_315px]'
        }`}
      >
        <div className="flex flex-col items-center w-full">
          <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
            <div className="flex items-center gap-2 text-xs">
              <ClubBadge clubId={viewerClub.id} size="md" />
              <span className="font-semibold text-white">
                Your Club: <span className="text-[#FFD76A]">{viewerClub.name}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-bold ${COLOR_TEXT_CLASSES[activeLudoState.turnColor]} flex items-center gap-1.5`}
              >
                <ClubBadge clubId={turnClub.id} size="sm" />
                <span>
                  {activeGameStatus === 'completed'
                    ? `Winner: ${winnerClubName}`
                    : activeGameStatus === 'waiting'
                    ? 'Preview Mode · Stake to Start'
                    : `${turnClub.name}${turnSeat?.displayName ? ` (${turnSeat.displayName})` : ''} · ${
                        isRolling
                          ? 'Rolling…'
                          : activeLudoState.phase === 'roll'
                          ? 'Roll Dice'
                          : 'Choose Pawn'
                      }`}
                </span>
              </span>

              {isControlled && activeGameStatus === 'in_progress' && externalOnResign && (
                <button
                  type="button"
                  onClick={externalOnResign}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-950/35 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-900/50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Flag className="h-3 w-3" />
                  <span>Resign</span>
                </button>
              )}

              {!isControlled && (
                <button
                  type="button"
                  onClick={() => resetStandaloneMatch(playerCount, humanColor, stakeAmount)}
                  title={betStatus === 'locked' ? 'Forfeit current stake and start new match' : 'Reset board'}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/40 bg-[#062919] px-2.5 py-1 min-h-[36px] text-[11px] font-semibold text-[#FFD76A] hover:bg-[#094028] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>{betStatus === 'locked' ? 'Forfeit & Reset' : 'Reset'}</span>
                </button>
              )}
            </div>
          </div>

          {!isControlled && betStatus === 'pending' && (
            <div className="w-full mb-3 rounded-xl border border-[#FFD76A]/65 bg-[#04160D]/92 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-lg">
              <div className="flex items-center gap-2 text-xs text-neutral-200 min-w-0">
                <Lock className="h-3.5 w-3.5 text-[#FFD76A] shrink-0" />
                <span className="truncate">
                  Board locked in preview · Stake{' '}
                  <strong className="font-mono-tabular text-[#FFD76A]">
                    UGX {Math.max(0, stakeAmount).toLocaleString()}
                  </strong>{' '}
                  to roll
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                {bankroll < stakeAmount && (
                  <Link
                    to="/wallet?tab=deposit"
                    className="rounded-full border border-[#9CE800]/60 bg-[#0B2B17] px-3 py-1.5 text-[11px] font-bold text-[#9CE800] hover:bg-[#114223] whitespace-nowrap"
                  >
                    Deposit →
                  </Link>
                )}
                <button
                  type="button"
                  disabled={stakeBusy}
                  onClick={() => void handleLockStandaloneStake()}
                  className="gold-shimmer-btn rounded-full px-4 py-1.5 text-[11px] font-extrabold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {stakeBusy ? 'Staking…' : `Stake UGX ${Math.max(0, stakeAmount).toLocaleString()} & Play`}
                </button>
              </div>
            </div>
          )}

          <ThreeLudoBoard
            ludoState={activeLudoState}
            viewerColor={viewerColor}
            canRoll={canRoll}
            canMove={canMove}
            isRolling={isRolling}
            displayedDiceValue={displayedDiceValue}
            isFullscreen={effectiveFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onRoll={handleRollClick}
            onMoveToken={handlePawnMoveClick}
          />

          {!isControlled && (
            <p className="mt-2.5 text-xs text-neutral-300 text-center max-w-[560px]">
              {standaloneBanner}
            </p>
          )}
        </div>

        <div className="pro-panel-card rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 gap-2">
            <h3 className="text-xs font-bold tracking-wide text-[#FFD76A] uppercase flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 shrink-0" />
              <span>Ludo Master Clubs</span>
            </h3>
            <span className="text-[11px] font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
              <ClubBadge clubId={turnClub.id} size="sm" />
              <span>{turnClub.name}</span>
            </span>
          </div>

          {!isControlled && (
            <div className="space-y-2.5 rounded-xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#071810] to-[#040B07] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#FFD76A] flex items-center gap-1.5 uppercase tracking-wide">
                  <Receipt className="h-3.5 w-3.5" />
                  <span>Match Bet Slip</span>
                </span>
                <span className="text-[11px] font-mono-tabular font-bold text-white flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-[#9CE800]" />
                  <span>UGX {bankroll.toLocaleString()}</span>
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {STAKE_OPTIONS.map((amt) => {
                  const active = stakeAmount === amt;
                  const disabled = betStatus === 'locked';
                  return (
                    <button
                      key={amt}
                      type="button"
                      disabled={disabled}
                      onClick={() => setStakeInput(String(amt))}
                      className={`rounded-md border py-1.5 px-1 text-[10px] font-mono-tabular font-bold transition-colors whitespace-nowrap ${
                        active
                          ? 'border-[#FFD76A] bg-[#D4AF37] text-[#110C02]'
                          : 'border-white/10 bg-[#07110C] text-neutral-200 hover:border-white/30'
                      } ${disabled && !active ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-[#040B07] px-2.5 py-1.5">
                <label htmlFor="ludo-custom-stake" className="text-[10px] font-semibold text-neutral-300 whitespace-nowrap">
                  Edit Price (UGX):
                </label>
                <input
                  id="ludo-custom-stake"
                  type="number"
                  inputMode="numeric"
                  min={MIN_GAME_STAKE_UGX}
                  max={MAX_GAME_STAKE_UGX}
                  step={1}
                  disabled={betStatus === 'locked'}
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  className="w-28 bg-transparent text-right font-mono-tabular text-xs font-bold text-[#FFD76A] focus:outline-none disabled:opacity-50"
                />
              </div>
              {stakeAmount < MIN_GAME_STAKE_UGX && (
                <p className="text-[10px] text-amber-300">
                  Minimum entry price is UGX {MIN_GAME_STAKE_UGX.toLocaleString()}.
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-[#050C08] px-2.5 py-2 text-[10px]">
                <div>
                  <p className="text-neutral-400">Each Entry</p>
                  <p className="font-mono-tabular font-bold text-[#FFD76A]">
                    UGX {stakeAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400">Classic Pot</p>
                  <p className="font-mono-tabular font-bold text-white">
                    {grossPot.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-neutral-400">Entry KO</p>
                  <p className="font-mono-tabular font-bold text-[#9CE800]">
                    +{entryKoUnitBonus.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-mono-tabular text-neutral-400">
                  #{ticketId} ·{' '}
                  <span
                    className={
                      betStatus === 'locked'
                        ? 'text-[#9CE800] font-bold'
                        : betStatus === 'won'
                        ? 'text-[#FFD76A] font-bold'
                        : betStatus === 'lost'
                        ? 'text-red-400 font-bold'
                        : 'text-neutral-300'
                    }
                  >
                    {betStatus === 'locked'
                      ? `POT LIVE (+UGX ${potentialNetProfit.toLocaleString()} PROFIT)`
                      : betStatus === 'won'
                      ? 'POT WON & PAID'
                      : betStatus === 'lost'
                      ? 'SETTLED LOST'
                      : 'MIN ENTRY UGX 1,000'}
                  </span>
                </span>
                {bankroll < stakeAmount && betStatus !== 'locked' && (
                  <Link
                    to="/wallet?tab=deposit"
                    className="inline-flex items-center gap-1 rounded border border-[#9CE800]/50 bg-[#0B2B17] px-2 py-0.5 font-bold text-[#9CE800] hover:bg-[#103D21] whitespace-nowrap"
                  >
                    <Wallet className="h-3 w-3" />
                    <span>Deposit (Min 1K)</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {!isControlled && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#07130D] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-[#FFD76A]" />
                  <span>Select Your Club</span>
                </span>
                <span className="text-[10px] font-bold text-[#FFD76A]">{viewerClub.name}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {ALL_CLUB_IDS.map((cid) => {
                  const meta = CLUB_BADGES[cid];
                  const selected = viewerClub.id === cid;
                  const locked = betStatus === 'locked';
                  return (
                    <button
                      key={cid}
                      type="button"
                      disabled={locked}
                      onClick={() => handleSelectClub(cid)}
                      title={locked ? 'Bet locked for this match' : `Play as ${meta.name}`}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border py-2 px-1 transition-all ${
                        selected
                          ? 'border-[#FFD76A] bg-[#0F2F1E] shadow-[0_0_10px_rgba(255,215,106,0.22)]'
                          : 'border-white/10 bg-[#050C08] hover:border-white/30'
                      } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <ClubBadge clubId={cid} size="lg" />
                      <span className="text-[10px] font-bold text-neutral-200 whitespace-nowrap">
                        {meta.shortName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isControlled && (
            <div className="space-y-2.5 rounded-xl border border-white/10 bg-[#07130D] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[#FFD76A]" />
                  <span>Clubs Playing</span>
                </span>
                <div className="inline-flex rounded-lg border border-white/10 bg-[#040B07] p-0.5">
                  {([2, 3, 4] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={betStatus === 'locked'}
                      onClick={() => resetStandaloneMatch(cnt, humanColor, stakeAmount)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors whitespace-nowrap ${
                        playerCount === cnt
                          ? 'bg-[#D4AF37] text-[#110C02]'
                          : 'text-neutral-300 hover:text-white'
                      } ${betStatus === 'locked' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {cnt} Clubs
                    </button>
                  ))}
                </div>
              </div>

              {playerCount === 2 && (
                <div className="space-y-1.5 pt-1 border-t border-white/10">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-neutral-300">Bet Opponent (1v1 Entry)</span>
                    <span className="font-bold text-[#9CE800]">
                      vs {CLUB_BADGES[DEFAULT_CLUB_BY_COLOR[opponentColor]].shortName}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ALL_CLUB_IDS.filter((cid) => CLUB_BADGES[cid].defaultColor !== humanColor).map(
                      (cid) => {
                        const meta = CLUB_BADGES[cid];
                        const activeRival = opponentColor === meta.defaultColor;
                        const locked = betStatus === 'locked';
                        return (
                          <button
                            key={cid}
                            type="button"
                            disabled={locked}
                            onClick={() => handleSelectOpponent(cid)}
                            className={`flex items-center justify-center gap-1 rounded-lg border py-1 px-1.5 text-[10px] font-bold transition-colors ${
                              activeRival
                                ? 'border-[#9CE800] bg-[#0B2D18] text-[#9CE800]'
                                : 'border-white/10 bg-[#050C08] text-neutral-300 hover:border-white/30'
                            } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <ClubBadge clubId={cid} size="sm" />
                            <span className="truncate">{meta.shortName}</span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
              {onLaunchFullMatch && (
                <button
                  type="button"
                  disabled={launchingFullMatch}
                  onClick={() => onLaunchFullMatch(playerCount, Math.max(MIN_GAME_STAKE_UGX, stakeAmount))}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D4AF37]/45 bg-[#0A2618] py-1.5 px-3 text-[11px] font-bold text-[#FFD76A] hover:bg-[#0E3622] cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  <Gamepad2 className="h-3.5 w-3.5" />
                  <span>
                    {launchingFullMatch
                      ? 'Opening Arena Room…'
                      : `Open Full ${playerCount}-Club Arena Match`}
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="rounded-xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#06150E] via-[#071A11] to-[#040C08] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs text-neutral-300">
              <div className="flex items-center gap-1.5">
                {renderDiceIcon(displayedDiceValue)}
                <span className="font-mono-tabular font-bold text-white">
                  {isRolling
                    ? 'Rolling on board…'
                    : activeLudoState.diceValue
                    ? `Rolled: ${activeLudoState.diceValue}`
                    : 'Tap Die on Board'}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[#FFD76A]">
                {activeLudoState.doubleSixUnlocked
                  ? '2x Sixes: Can Pass/Leave'
                  : canRoll
                  ? 'Your Roll'
                  : canMove
                  ? 'Move Pawn'
                  : turnClub.shortName}
              </span>
            </div>

            {activeLudoState.consecutiveSixes === 1 && !activeLudoState.doubleSixUnlocked && (
              <p className="text-[10px] font-semibold text-[#9CE800]">
                1st Six rolled — another 6 unlocks passing 2-button blockades!
              </p>
            )}

            {activeLudoState.doubleSixUnlocked && (
              <p className="text-[10px] font-bold text-[#FFD76A]">
                2x Sixes active — you may pass opponent pairs or leave them!
              </p>
            )}

            {!isControlled && betStatus === 'pending' ? (
              <button
                type="button"
                disabled={stakeBusy}
                onClick={() => void handleLockStandaloneStake()}
                className="w-full rounded-lg py-2.5 px-4 text-xs font-extrabold whitespace-nowrap transition-transform gold-shimmer-btn cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              >
                {stakeBusy
                  ? 'Locking Stake…'
                  : `Stake UGX ${Math.max(0, stakeAmount).toLocaleString()} & Unlock Board`}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canRoll}
                onClick={handleRollClick}
                className={`w-full rounded-lg py-2.5 px-4 text-xs font-extrabold whitespace-nowrap transition-transform ${
                  canRoll
                    ? 'gold-shimmer-btn cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-white/10 text-neutral-400 cursor-not-allowed'
                }`}
              >
                {isRolling
                  ? 'Rolling…'
                  : canRoll
                  ? 'Roll 3D Dice'
                  : canMove
                  ? 'Pick a Pawn'
                  : activeGameStatus === 'waiting'
                  ? 'Stake Required Above'
                  : activeGameStatus === 'completed'
                  ? 'Match Finished'
                  : `${turnClub.shortName} Thinking…`}
              </button>
            )}
          </div>

          {!isControlled && activeGameStatus === 'completed' && settlementInfo && (
            <div
              className={`rounded-xl border p-3.5 space-y-3 ${
                settlementInfo.won
                  ? 'border-[#FFD76A] bg-gradient-to-b from-[#0A301C] to-[#05180E]'
                  : 'border-red-500/50 bg-gradient-to-b from-[#2A0B0E] to-[#120608]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy
                    className={`h-4 w-4 shrink-0 ${
                      settlementInfo.won ? 'text-[#FFD76A]' : 'text-red-400'
                    }`}
                  />
                  <span
                    className={`text-xs font-extrabold uppercase tracking-wide ${
                      settlementInfo.won ? 'text-[#FFD76A]' : 'text-red-300'
                    }`}
                  >
                    {settlementInfo.won ? 'Bet Won · Paid Out' : 'Bet Lost · Settled'}
                  </span>
                </div>
                <span className="font-mono-tabular text-[10px] text-neutral-300">
                  #{settlementInfo.ticketId}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/35 p-2.5 text-[11px]">
                <div>
                  <p className="text-neutral-400 text-[10px]">Winner</p>
                  <p className="font-bold text-white truncate">{settlementInfo.winnerClub}</p>
                </div>
                <div className="text-right">
                  <p className="text-neutral-400 text-[10px]">Entry Pot ({settlementInfo.players} Clubs)</p>
                  <p className="font-mono-tabular font-bold text-[#FFD76A]">
                    UGX {(settlementInfo.stake * settlementInfo.players).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400 text-[10px]">Your Entry / KOs</p>
                  <p className="font-mono-tabular font-semibold text-neutral-200">
                    UGX {settlementInfo.stake.toLocaleString()} · {settlementInfo.entryKos} KO
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-neutral-400 text-[10px]">
                    {settlementInfo.won ? 'Total Payout' : 'Net Result'}
                  </p>
                  <p
                    className={`font-mono-tabular font-extrabold ${
                      settlementInfo.won ? 'text-[#9CE800]' : 'text-red-400'
                    }`}
                  >
                    {settlementInfo.won
                      ? `+UGX ${(settlementInfo.payout + settlementInfo.entryKoBonus).toLocaleString()}`
                      : settlementInfo.netProfit >= 0
                      ? `+UGX ${settlementInfo.netProfit.toLocaleString()}`
                      : `-UGX ${Math.abs(settlementInfo.netProfit).toLocaleString()}`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => resetStandaloneMatch(playerCount, humanColor, stakeAmount)}
                  className="gold-shimmer-btn rounded-lg py-2 px-3 text-xs font-extrabold cursor-pointer whitespace-nowrap"
                >
                  Play Again
                </button>
                <button
                  type="button"
                  disabled={bankroll < Math.min(25000, stakeAmount * 2)}
                  onClick={() =>
                    resetStandaloneMatch(
                      playerCount,
                      humanColor,
                      Math.min(25000, stakeAmount * 2)
                    )
                  }
                  className="rounded-lg border border-[#D4AF37]/50 bg-[#082417] py-2 px-3 text-xs font-bold text-[#FFD76A] hover:bg-[#0D3824] cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  2x Double Stake
                </button>
              </div>
            </div>
          )}

          {canMove && activeLudoState.legalTokenIndices.length > 0 && (
            <div className="rounded-xl border border-[#9CE800]/45 bg-[#092313] p-3 space-y-2">
              <p className="text-[11px] font-bold text-[#9CE800] flex items-center gap-1.5">
                <ClubBadge clubId={viewerClub.id} size="sm" />
                <span>
                  Move {viewerClub.name} +{activeLudoState.diceValue}:
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {activeLudoState.legalTokenIndices.map((idx) => {
                  const pos = activeLudoState.tokensByColor[viewerColor][idx];
                  const willPassBlock =
                    pos >= 0 &&
                    getPathBlockadeColor(
                      activeLudoState,
                      viewerColor,
                      pos,
                      activeLudoState.diceValue || 0
                    ) !== null;
                  const label =
                    pos === -1
                      ? 'Deploy'
                      : pos + (activeLudoState.diceValue || 0) === 56
                      ? 'Home!'
                      : willPassBlock
                      ? 'Pass Pair!'
                      : `Tile ${pos}`;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePawnMoveClick(idx)}
                      className="rounded-lg border border-[#9CE800]/60 bg-[#05140C] px-2.5 py-2 text-xs font-bold text-white hover:bg-[#113D23] flex items-center justify-between gap-1.5 cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <ClubBadge clubId={viewerClub.id} size="sm" />
                        <span>#{idx + 1}</span>
                      </span>
                      <span className="text-[10px] font-mono-tabular text-[#FFD76A]">{label}</span>
                    </button>
                  );
                })}
              </div>
              {blockedPawnReasons.length > 0 && (
                <p className="text-[10px] text-amber-300 leading-snug">
                  {blockedPawnReasons
                    .map((b) => `Pawn #${b.tokenIndex + 1} blocked by ${b.blockerClub} pair`)
                    .join(' · ')}{' '}
                  (need two 6s to pass).
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Club Standings (Home Crown)
            </p>
            {activeLudoState.activeColors.map((color) => {
              const seat = seatByColor[color];
              const club = CLUB_BADGES[DEFAULT_CLUB_BY_COLOR[color]];
              const tokens = activeLudoState.tokensByColor[color] || [];
              const homeCount = tokens.filter((p) => p === 56).length;
              const activeTurn =
                activeLudoState.turnColor === color && activeGameStatus === 'in_progress';
              return (
                <div
                  key={color}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs ${
                    activeTurn
                      ? 'border-[#FFD76A]/65 bg-[#0A2618]'
                      : 'border-white/10 bg-[#0B0E14]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ClubBadge clubId={club.id} size="md" />
                    <span className="font-semibold text-white truncate">
                      {club.name}
                      {seat?.displayName ? ` · ${seat.displayName}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isControlled && (
                      <span className="font-mono-tabular text-[10px] text-neutral-400">
                        {stakeAmount >= 1000 ? `${stakeAmount / 1000}K` : stakeAmount}
                      </span>
                    )}
                    <span className="font-mono-tabular font-bold text-[#FFD76A]">
                      {homeCount}/4
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Classic Rules: Every player matches the entry stake into the Winner-Takes-All pot. Entry tiles are NOT safe — beat opponents right on their entry for a +20% Entry KO bonus! Stack 2 buttons to block rivals (need two 6s to pass). Press <span className="font-mono-tabular text-neutral-200">R</span> to roll.
          </p>

          <div className="max-h-36 overflow-y-auto rounded-lg border border-white/10 bg-[#0B0E14] p-2 space-y-1 text-[11px]">
            {activeLudoState.moveHistory.length === 0 ? (
              <p className="text-neutral-500 text-center py-3">Roll the 3D die to kick off…</p>
            ) : (
              [...activeLudoState.moveHistory].reverse().map((m, idx) => (
                <div key={idx} className="px-2 py-1 rounded hover:bg-white/5 flex items-start gap-2">
                  <span className="font-mono-tabular text-neutral-500 shrink-0">#{m.turn}</span>
                  <span className="text-neutral-200 leading-snug">{m.text}</span>
                </div>
              ))
            )}
          </div>

          {!isControlled && (
            <TableChatPanel
              title="Live Chat with Opponents"
              messages={ludoChatMessages}
              currentUid="local-human"
              disabled={!aiConfig.liveUserChatEnabled}
              typingUsers={typingUsers}
              opponents={activeSeats
                .filter((s) => s.uid !== 'local-human')
                .map((s) => ({
                  uid: s.uid,
                  name: s.displayName,
                  connected: s.connected,
                  isBot: s.isBot,
                  gender: s.gender,
                }))}
              onSendPreset={(presetId) => handleStandaloneChatSend({ presetId })}
              onSendText={(text) => handleStandaloneChatSend({ text })}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LudoMaster;
