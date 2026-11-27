import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Copy,
  Lock,
  MessageSquare,
  Play,
  RotateCcw,
  ShieldCheck,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { getStore, notifyStore } from '../lib/localStore';
import { useAuth } from '../lib/authContext';
import { useSocial } from '../lib/socialContext';
import { LocalTableEngine } from '../lib/localTableEngine';
import { loadLocalRoomConfig } from '../lib/roomFallbackService';
import { recordMatchResultAndAdvance } from '../lib/tournamentService';
import {
  creditMatchWinnings,
  extractWalletErrorMessage,
  MAX_GAME_STAKE_UGX,
  MIN_GAME_STAKE_UGX,
  payGameEntryStake,
} from '../lib/walletService';
import { SeatMedallion } from '../components/SeatMedallion';
import { TableChatPanel } from '../components/TableChatPanel';
import type { TypingIndicatorUser } from '../components/ChatTypingBubble';
import { GlobalSoundToggle } from '../components/GlobalSoundToggle';
import { FullscreenToggleButton } from '../components/FullscreenToggleButton';
import { SendPlayInviteModal } from '../components/LiveSocialOverlay';
import { useGameFullscreen } from '../hooks/useGameFullscreen';
import { ChessTableView } from '../components/ChessTableView';
import { DraftsTableView } from '../components/DraftsTableView';
import { LudoTableView } from '../components/LudoTableView';
import { MatatuTableView } from '../components/MatatuTableView';
import { isCardPlayable, SUIT_LABELS, SUIT_SYMBOLS, SUITS } from '../shared/matatuRules';
import { soundFx } from '../utils/sound';
import proBgMatatu from '../assets/images/pro_bg_matatu_1794922549602.jpg';
import proBgChess from '../assets/images/pro_bg_chess_1794922550558.jpg';
import proBgDrafts from '../assets/images/pro_bg_drafts_1794922550631.jpg';
import proBgLudo from '../assets/images/pro_bg_ludo_1794922550828.jpg';
import type { ChatPresetId, RoomChatMessage } from '../shared/chatPresets';
import type {
  ChessPieceType,
  PlayingCard as PlayingCardType,
  SanitizedGameState,
  Suit,
} from '../shared/types';

export const GameTablePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { firebaseUser, userDoc, playerProfile, wallet, systemSettings } = useAuth();
  const { players, friends, onlinePlayers } = useSocial();

  const localEngineRef = useRef<LocalTableEngine | null>(null);
  const arenaContainerRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggleFullscreen } = useGameFullscreen(arenaContainerRef);
  const recordedWinGameIdRef = useRef<string | null>(null);
  const pendingPaidRematchRef = useRef<boolean>(false);
  const prevTurnUidRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const prevLudoSignalRef = useRef<string>('');
  const prevLudoTokensRef = useRef<Record<string, number[]> | null>(null);
  const profileIdentityRef = useRef({
    displayName: 'Matatu Player',
    playerId: 'PLAYER',
  });
  profileIdentityRef.current = {
    displayName:
      userDoc?.fullName ||
      playerProfile?.displayName ||
      firebaseUser?.displayName ||
      'Matatu Player',
    playerId: userDoc?.playerId || playerProfile?.playerId || 'PLAYER',
  };

  const [gameState, setGameState] = useState<SanitizedGameState | null>(null);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingIndicatorUser[]>([]);
  const typingExpireTimersRef = useRef<Record<string, number>>({});
  const [tableError, setTableError] = useState('');
  const [rematchError, setRematchError] = useState('');
  const [rematchBusy, setRematchBusy] = useState(false);
  const [stakeBusy, setStakeBusy] = useState(false);
  const [stakeError, setStakeError] = useState('');
  const [stakedKeys, setStakedKeys] = useState<Record<string, boolean>>({});
  const [stakeInput, setStakeInput] = useState<string>(String(MIN_GAME_STAKE_UGX));
  const [connecting, setConnecting] = useState(true);
  const [pendingAceCard, setPendingAceCard] = useState<PlayingCardType | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<{
    uid: string;
    displayName: string;
    playerId: string;
  } | null>(null);
  const [inviteSearch, setInviteSearch] = useState('');

  useEffect(() => {
    if (gameState?.entryFeeUgx) {
      setStakeInput(String(Math.max(MIN_GAME_STAKE_UGX, gameState.entryFeeUgx)));
    }
  }, [gameState?.entryFeeUgx]);

  useEffect(() => {
    if (
      gameState &&
      pendingPaidRematchRef.current &&
      gameState.status === 'in_progress'
    ) {
      const key = `${gameState.roomId}:${gameState.gameId}`;
      pendingPaidRematchRef.current = false;
      setStakedKeys((prev) => ({ ...prev, [key]: true }));
      try {
        window.sessionStorage.setItem(`casino_royale_staked_${key}`, '1');
      } catch {
        // Ignore storage errors
      }
    }
  }, [gameState]);

  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    let closed = false;

    void (async () => {
      const cfg = await loadLocalRoomConfig(roomId);
      if (closed) return;
      const engine = new LocalTableEngine({
        roomId,
        roomCode: cfg?.roomCode || roomId.slice(-6).toUpperCase(),
        roomName: cfg?.name || 'Kampala Arena Table',
        isPrivate: cfg?.isPrivate ?? false,
        gameType: cfg?.gameType || 'matatu',
        mode: 'bot',
        maxPlayers: cfg?.maxPlayers || 2,
        entryFeeUgx: cfg?.entryFeeUgx || MIN_GAME_STAKE_UGX,
        playerUid: firebaseUser.uid,
        playerId: profileIdentityRef.current.playerId,
        playerName: profileIdentityRef.current.displayName,
        rules: systemSettings.matatuRules,
        startImmediately: Boolean(cfg?.tournamentId),
        tournamentId: cfg?.tournamentId,
        tournamentMatchId: cfg?.tournamentMatchId,
        preferredAiUids: cfg?.aiSeats?.map((s) => s.uid),
        onState: (nextState) => {
          if (!closed) {
            setGameState(nextState);
            setTableError('');
            setConnecting(false);
          }
        },
        onChat: (msg) => {
          if (!closed) {
            setTypingUsers((prev) => prev.filter((u) => u.uid !== msg.uid));
            setChatMessages((prev) => [...prev.slice(-39), msg]);
          }
        },
        onTyping: (typing) => {
          if (closed) return;
          const prevTimer = typingExpireTimersRef.current[typing.uid];
          if (prevTimer) window.clearTimeout(prevTimer);
          if (typing.isTyping) {
            setTypingUsers((prev) => {
              const filtered = prev.filter((u) => u.uid !== typing.uid);
              return [
                ...filtered,
                {
                  uid: typing.uid,
                  senderName: typing.senderName,
                  senderGender: typing.senderGender,
                },
              ];
            });
            typingExpireTimersRef.current[typing.uid] = window.setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u.uid !== typing.uid));
            }, 12000);
          } else {
            delete typingExpireTimersRef.current[typing.uid];
            setTypingUsers((prev) => prev.filter((u) => u.uid !== typing.uid));
          }
        },
      });
      localEngineRef.current = engine;
    })();

    return () => {
      closed = true;
      Object.values(typingExpireTimersRef.current).forEach((t) => window.clearTimeout(t));
      typingExpireTimersRef.current = {};
      if (localEngineRef.current) {
        localEngineRef.current.dispose();
        localEngineRef.current = null;
      }
    };
  }, [roomId, firebaseUser, systemSettings.matatuRules]);

  // Audio feedback on state transitions
  useEffect(() => {
    if (!gameState) return;
    if (gameState.gameType === 'ludo' && gameState.ludoState) {
      const ludo = gameState.ludoState;
      const sig = `${ludo.turnColor}:${ludo.phase}:${ludo.diceValue}:${ludo.moveHistory.length}`;
      if (prevLudoSignalRef.current && prevLudoSignalRef.current !== sig) {
        const prevTokens = prevLudoTokensRef.current;
        let captured = false;
        let reachedHome = false;
        let moved = false;

        if (prevTokens) {
          for (const c of ludo.activeColors) {
            const cur = ludo.tokensByColor[c] || [];
            const prev = prevTokens[c] || [];
            for (let i = 0; i < cur.length; i += 1) {
              if (cur[i] !== prev[i]) {
                moved = true;
                if (prev[i] >= 0 && cur[i] === -1) captured = true;
                if (prev[i] < 56 && cur[i] === 56) reachedHome = true;
              }
            }
          }
        }

        if (gameState.status === 'completed') {
          soundFx.play('win');
        } else if (captured) {
          soundFx.play('ludo-capture');
        } else if (reachedHome) {
          soundFx.play('ludo-home');
        } else if (moved) {
          soundFx.play('ludo-move');
        } else if (ludo.diceValue === 6 && ludo.phase === 'move') {
          soundFx.play('ludo-six');
        }
      }
      prevLudoSignalRef.current = sig;
      prevLudoTokensRef.current = {
        red: [...(ludo.tokensByColor.red || [])],
        green: [...(ludo.tokensByColor.green || [])],
        yellow: [...(ludo.tokensByColor.yellow || [])],
        blue: [...(ludo.tokensByColor.blue || [])],
      };
    } else {
      if (prevTurnUidRef.current && prevTurnUidRef.current !== gameState.currentTurnUid) {
        soundFx.play('card-flip');
      }
      if (prevStatusRef.current !== 'completed' && gameState.status === 'completed') {
        soundFx.play('win');
      }
    }
    prevTurnUidRef.current = gameState.currentTurnUid;
    prevStatusRef.current = gameState.status;
  }, [gameState]);

  // Turn countdown clock
  useEffect(() => {
    if (!gameState || gameState.status !== 'in_progress' || !gameState.turnDeadlineMs) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((gameState.turnDeadlineMs - Date.now()) / 1000));
      setSecondsLeft(rem);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [gameState?.status, gameState?.turnDeadlineMs]);

  // Record match outcome to localStore profile & history once per completed game
  useEffect(() => {
    if (
      !gameState ||
      gameState.status !== 'completed' ||
      !firebaseUser ||
      !playerProfile ||
      recordedWinGameIdRef.current === gameState.gameId
    ) {
      return;
    }
    recordedWinGameIdRef.current = gameState.gameId;

    const mySeat = gameState.seats.find((s) => s.uid === firebaseUser.uid);
    if (!mySeat) return;

    const s = getStore();
    const won = gameState.winnerUid === firebaseUser.uid;
    const isDraw = gameState.winnerUid === null;
    const profile = s.playerProfiles[firebaseUser.uid];
    if (profile) {
      const nextTotal = (profile.totalGames || 0) + 1;
      const nextWon = (profile.gamesWon || 0) + (won ? 1 : 0);
      const nextLost = (profile.gamesLost || 0) + (!won && !isDraw ? 1 : 0);
      profile.totalGames = nextTotal;
      profile.gamesWon = nextWon;
      profile.gamesLost = nextLost;
      profile.winRate = nextTotal > 0 ? Number(((nextWon / nextTotal) * 100).toFixed(1)) : 0;
      profile.points = (profile.points || 0) + (won ? 50 : 10);
      profile.updatedAt = Date.now();
    }

    const historyId = `hist_${gameState.gameId}`;
    s.gameHistory = [
      {
        historyId,
        gameId: gameState.gameId,
        roomId: gameState.roomId,
        mode: gameState.mode,
        playerUids: gameState.seats.map((seat) => seat.uid),
        winnerUid: gameState.winnerUid,
        winnerName: gameState.winnerName || (won ? mySeat.displayName : 'Draw'),
        durationSeconds: Math.max(15, gameState.turnCount * 4),
        summary: `${gameState.roomName} (${gameState.gameType || 'matatu'})`,
        createdAt: Date.now(),
      },
      ...s.gameHistory,
    ].slice(0, 100);

    if (won && !gameState.tournamentId) {
      const entryStake = Math.max(MIN_GAME_STAKE_UGX, Number(gameState.entryFeeUgx || MIN_GAME_STAKE_UGX));
      const winPayout = Math.round(entryStake * 1.8);
      void creditMatchWinnings({
        uid: firebaseUser.uid,
        playerId: userDoc?.playerId,
        amountUgx: winPayout,
        gameLabel: `${gameState.roomName} (${gameState.gameType || 'matatu'})`,
      }).catch(() => {});
    }

    if (gameState.tournamentId && gameState.tournamentMatchId && gameState.winnerUid) {
      const t = s.tournaments[gameState.tournamentId];
      const matches = s.tournamentMatches[gameState.tournamentId] || [];
      const match = matches.find((m) => m.matchId === gameState.tournamentMatchId);
      if (t && match) {
        const winnerUid =
          gameState.winnerUid === firebaseUser.uid
            ? firebaseUser.uid
            : match.player1Uid === firebaseUser.uid
            ? match.player2Uid || gameState.winnerUid
            : match.player1Uid || gameState.winnerUid;
        void recordMatchResultAndAdvance({
          tournament: t,
          matches,
          match,
          winnerUid,
          winnerName: gameState.winnerName || 'Winner',
        }).catch(() => {});
      }
    }

    notifyStore();
  }, [gameState, firebaseUser, playerProfile, userDoc?.playerId]);

  const sendCommand = (payload: Record<string, unknown>) => {
    if (localEngineRef.current) {
      localEngineRef.current.handleCommand(payload);
    }
  };

  const myUid = firebaseUser?.uid || '';
  const availableBalance = Number(wallet?.availableBalance ?? 0);
  const isHost = gameState?.hostUid === myUid;
  const matchStakeKey = gameState ? `${gameState.roomId}:${gameState.gameId}` : '';
  const isTournamentMatch = Boolean(gameState?.tournamentId);
  const hasStaked = Boolean(
    gameState &&
      (isTournamentMatch ||
        stakedKeys[matchStakeKey] ||
        (typeof window !== 'undefined' &&
          window.sessionStorage.getItem(`casino_royale_staked_${matchStakeKey}`) === '1'))
  );
  const canCustomizeEntryStake = Boolean(
    gameState &&
      !isTournamentMatch &&
      !hasStaked &&
      (gameState.mode === 'bot' || (isHost && gameState.status === 'waiting'))
  );
  const parsedStakeAmount = Math.round(Number(stakeInput));
  const selectedStakeUgx = canCustomizeEntryStake
    ? Number.isFinite(parsedStakeAmount)
      ? parsedStakeAmount
      : 0
    : Math.max(MIN_GAME_STAKE_UGX, Number(gameState?.entryFeeUgx || MIN_GAME_STAKE_UGX));

  const effectiveViewStatus: 'waiting' | 'in_progress' | 'completed' = !gameState
    ? 'waiting'
    : gameState.status === 'completed'
    ? 'completed'
    : hasStaked
    ? gameState.status
    : 'waiting';
  const isYourTurn = Boolean(
    hasStaked && gameState?.status === 'in_progress' && gameState?.currentTurnUid === myUid
  );
  const mySeat = gameState?.seats.find((s) => s.uid === myUid);

  const markMatchStaked = (key: string) => {
    setStakedKeys((prev) => ({ ...prev, [key]: true }));
    try {
      window.sessionStorage.setItem(`casino_royale_staked_${key}`, '1');
    } catch {
      // Ignore storage errors
    }
  };

  const handleStakeAndStart = async () => {
    if (!gameState || !firebaseUser || stakeBusy || hasStaked) return;
    setStakeError('');

    const amountToPay = canCustomizeEntryStake
      ? Math.round(Number(stakeInput))
      : Math.max(MIN_GAME_STAKE_UGX, Number(gameState.entryFeeUgx || MIN_GAME_STAKE_UGX));

    if (!Number.isFinite(amountToPay) || amountToPay < MIN_GAME_STAKE_UGX || amountToPay > MAX_GAME_STAKE_UGX) {
      setStakeError(
        `Table stake must be between UGX ${MIN_GAME_STAKE_UGX.toLocaleString()} and UGX ${MAX_GAME_STAKE_UGX.toLocaleString()}.`
      );
      return;
    }

    setStakeBusy(true);
    try {
      await payGameEntryStake({
        uid: firebaseUser.uid,
        playerId: userDoc?.playerId,
        amountUgx: amountToPay,
        gameLabel: `${gameState.roomName} (${gameState.gameType || 'matatu'})`,
      });
      markMatchStaked(`${gameState.roomId}:${gameState.gameId}`);
      soundFx.play('match');
      if (gameState.status === 'waiting') {
        sendCommand({ type: 'START_GAME', entryFeeUgx: amountToPay });
      }
    } catch (err) {
      setStakeError(extractWalletErrorMessage(err, 'Unable to lock table stake.'));
    } finally {
      setStakeBusy(false);
    }
  };

  const handleRematch = async () => {
    if (!gameState || !firebaseUser || rematchBusy) return;
    setRematchError('');
    const parsed = Math.round(Number(stakeInput));
    if (!Number.isFinite(parsed) || parsed < MIN_GAME_STAKE_UGX || parsed > MAX_GAME_STAKE_UGX) {
      setRematchError(
        `Rematch stake must be between UGX ${MIN_GAME_STAKE_UGX.toLocaleString()} and UGX ${MAX_GAME_STAKE_UGX.toLocaleString()}.`
      );
      return;
    }
    setRematchBusy(true);
    try {
      await payGameEntryStake({
        uid: firebaseUser.uid,
        playerId: userDoc?.playerId,
        amountUgx: parsed,
        gameLabel: `${gameState.roomName} Rematch (${gameState.gameType || 'matatu'})`,
      });
      pendingPaidRematchRef.current = true;
      sendCommand({ type: 'REMATCH', entryFeeUgx: parsed });
    } catch (err) {
      pendingPaidRematchRef.current = false;
      setRematchError(extractWalletErrorMessage(err, 'Unable to pay rematch stake.'));
    } finally {
      setRematchBusy(false);
    }
  };

  const playableCardIds = useMemo(() => {
    if (!gameState || !isYourTurn || !gameState.topDiscard) return new Set<string>();
    const set = new Set<string>();
    for (const c of gameState.yourHand) {
      if (
        isCardPlayable(
          c,
          gameState.topDiscard,
          gameState.activeSuit,
          gameState.pendingDrawCount,
          gameState.rules
        )
      ) {
        set.add(c.id);
      }
    }
    return set;
  }, [gameState, isYourTurn]);

  const handleCardClick = (card: PlayingCardType) => {
    if (!hasStaked || !isYourTurn || !playableCardIds.has(card.id)) return;
    if (card.rank === 'A') {
      setPendingAceCard(card);
      return;
    }
    soundFx.play('match');
    sendCommand({ type: 'PLAY_CARD', cardId: card.id });
  };

  const handleCopyCode = () => {
    if (!gameState?.roomCode) return;
    void navigator.clipboard.writeText(gameState.roomCode);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 2000);
  };

  if (connecting && !gameState) {
    return (
      <div className="min-h-screen pro-arena-shell text-white flex items-center justify-center p-6">
        <div className="pro-panel-card rounded-2xl p-8 text-center space-y-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#FFD76A] border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#FFD76A]">Preparing 3D Arena Table…</p>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen pro-arena-shell text-white flex items-center justify-center p-6">
        <div className="pro-panel-card rounded-2xl p-8 max-w-md text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-[#FFD76A]">Table Unavailable</h1>
          <p className="text-xs text-neutral-300">{tableError || 'This room could not be joined or has closed.'}</p>
          <Link
            to="/play"
            className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Lobby</span>
          </Link>
        </div>
      </div>
    );
  }

  const opponentSeats = gameState.seats.filter((s) => s.uid !== myUid);
  const arenaBackdropImg =
    gameState.gameType === 'chess'
      ? proBgChess
      : gameState.gameType === 'drafts'
      ? proBgDrafts
      : gameState.gameType === 'ludo'
      ? proBgLudo
      : proBgMatatu;

  return (
    <div
      ref={arenaContainerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 h-dvh w-screen overflow-y-auto pro-arena-shell text-white flex flex-col'
          : 'relative min-h-screen pro-arena-shell text-white flex flex-col'
      }
    >
      <img
        src={arenaBackdropImg}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-45"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#040806]/72 via-[#050A08]/54 to-[#030605]/86"
      />
      {/* Top Compact Arena HUD */}
      <header
        className={`relative z-10 border-b border-white/10 bg-[#0B0E13]/95 px-4 sm:px-6 shrink-0 ${
          isFullscreen ? 'py-2' : 'py-3'
        }`}
      >
        <div
          className={`mx-auto flex flex-wrap items-center justify-between gap-3 ${
            isFullscreen ? 'max-w-none' : 'max-w-[1640px]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/play')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[#141820] text-neutral-200 hover:text-[#FFD76A] cursor-pointer"
              aria-label="Leave table"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base sm:text-lg font-bold text-white truncate">
                  {gameState.roomName}
                </h1>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 rounded-md border border-[#D4AF37]/40 bg-[#072617] px-2 py-0.5 font-mono-tabular text-[11px] font-bold text-[#FFD76A] cursor-pointer"
                  title="Copy invite code"
                >
                  <Copy className="h-3 w-3" />
                  <span>{copiedCode ? 'Copied!' : gameState.roomCode}</span>
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 truncate">{gameState.lastActionText}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div className="hidden sm:inline-flex items-center rounded-lg border border-[#D4AF37]/35 bg-[#072617] px-3 py-1.5 font-mono-tabular text-xs font-bold text-[#FFD76A]">
              {hasStaked
                ? `Staked: UGX ${(gameState.entryFeeUgx || MIN_GAME_STAKE_UGX).toLocaleString()}`
                : `Entry: UGX ${Math.max(0, selectedStakeUgx).toLocaleString()} (Locked)`}
            </div>
            {effectiveViewStatus === 'in_progress' && secondsLeft > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#141820] px-3 py-1.5 font-mono-tabular text-xs font-bold text-[#FFD76A]">
                <Clock className="h-3.5 w-3.5" />
                <span>{secondsLeft}s</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('table-opponent-chat');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#072617] px-3 py-1.5 text-xs font-bold text-[#FFD76A] hover:bg-[#0B3923] cursor-pointer ${
                isFullscreen ? '' : 'lg:hidden'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat ({chatMessages.filter((m) => !m.isSystem).length})</span>
            </button>
            {gameState.status !== 'completed' &&
              gameState.seats.length < gameState.maxPlayers && (
                <button
                  type="button"
                  onClick={() => setShowInvitePicker(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#9CE800]/50 bg-[#0A2F1D] px-3 py-1.5 text-xs font-bold text-[#9CE800] hover:bg-[#114A2E] cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Invite Friend</span>
                </button>
              )}
            <FullscreenToggleButton
              isFullscreen={isFullscreen}
              onToggle={() => void toggleFullscreen()}
            />
            <GlobalSoundToggle variant="compact" />
            {hasStaked && gameState.status === 'waiting' && isHost && gameState.seats.length >= 2 && (
              <button
                type="button"
                onClick={() => sendCommand({ type: 'START_GAME' })}
                className="pro-lime-btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-extrabold cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start Match</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {tableError && (
        <div className="mx-auto max-w-[1640px] w-full px-4 sm:px-6 pt-3">
          <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-2.5 text-xs text-red-200">
            {tableError}
          </div>
        </div>
      )}

      {/* Main Arena Grid */}
      <main
        className={`relative z-10 flex-1 mx-auto w-full grid grid-cols-1 gap-5 items-start ${
          isFullscreen
            ? 'max-w-none px-2 sm:px-3 py-2'
            : gameState.gameType === 'matatu'
            ? 'max-w-[1840px] px-2.5 sm:px-4 py-3 lg:grid-cols-[minmax(0,1fr)_270px]'
            : 'max-w-[1640px] p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]'
        }`}
      >
        <div className="space-y-5">
          {/* Stake-to-Start Lock Bar */}
          {!hasStaked && gameState.status !== 'completed' && (
            <div className="emerald-card-surface rounded-2xl border-2 border-[#FFD76A]/75 p-4 sm:p-5 space-y-3.5 shadow-[0_18px_40px_rgba(0,0,0,0.75)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#FFD76A] flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Preview Mode · Stake Required to Play</span>
                  </p>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                    Inspect the 3D Table — Lock Your UGX Stake to Start
                  </h2>
                  <p className="text-xs text-neutral-300">
                    You can rotate the 3D board, check opponents, and chat before staking. Moves and rolls unlock once your entry stake is confirmed.
                  </p>
                </div>

                <div className="rounded-xl border border-[#D4AF37]/40 bg-[#04140C]/90 px-4 py-2 text-xs shrink-0">
                  <p className="text-neutral-400">Your Wallet Available</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono-tabular text-sm font-extrabold text-[#FFD76A] flex items-center gap-1">
                      <Wallet className="h-3.5 w-3.5 text-[#9CE800]" />
                      UGX {availableBalance.toLocaleString()}
                    </span>
                    <Link
                      to="/wallet?tab=deposit"
                      className="text-emerald-400 font-bold hover:underline whitespace-nowrap"
                    >
                      Deposit →
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/10">
                {canCustomizeEntryStake ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-neutral-300 font-semibold mr-1">Stake:</span>
                    {[1000, 2000, 5000, 10000, 25000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={stakeBusy}
                        onClick={() => {
                          setStakeError('');
                          setStakeInput(String(amt));
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 font-mono-tabular text-xs font-bold cursor-pointer transition-colors ${
                          selectedStakeUgx === amt
                            ? 'border-[#FFD76A] bg-[#0B4128] text-[#FFD76A]'
                            : 'border-white/15 bg-[#04120B] text-neutral-300 hover:border-white/35'
                        }`}
                      >
                        {amt >= 1000 ? `${amt / 1000}K` : amt}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 rounded-lg border border-[#D4AF37]/45 bg-[#04120B] px-2.5 py-1">
                      <span className="text-[11px] font-semibold text-[#FFD76A]">UGX</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={MIN_GAME_STAKE_UGX}
                        max={MAX_GAME_STAKE_UGX}
                        step={1}
                        disabled={stakeBusy}
                        aria-label="Table entry stake in UGX"
                        value={stakeInput}
                        onChange={(e) => {
                          setStakeError('');
                          setStakeInput(e.target.value);
                        }}
                        className="w-24 bg-transparent font-mono-tabular text-xs font-bold text-white focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-200">
                    Fixed Table Entry:{' '}
                    <span className="font-mono-tabular font-bold text-[#FFD76A]">
                      UGX {selectedStakeUgx.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 ml-auto">
                  {availableBalance < Math.max(MIN_GAME_STAKE_UGX, selectedStakeUgx) && (
                    <Link
                      to="/wallet?tab=deposit"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#9CE800]/60 bg-[#0B2B17] px-4 py-2.5 text-xs font-bold text-[#9CE800] hover:bg-[#114223] whitespace-nowrap"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      <span>Deposit UGX (Min 1,000)</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={stakeBusy}
                    onClick={() => void handleStakeAndStart()}
                    className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-extrabold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>
                      {stakeBusy
                        ? 'Locking Stake…'
                        : `Stake UGX ${Math.max(0, selectedStakeUgx).toLocaleString()} & Start Playing`}
                    </span>
                  </button>
                </div>
              </div>

              {stakeError && (
                <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-2.5 text-xs text-red-200 flex flex-wrap items-center justify-between gap-2">
                  <span>{stakeError}</span>
                  <Link
                    to="/wallet?tab=deposit"
                    className="font-bold text-[#FFD76A] hover:underline whitespace-nowrap"
                  >
                    Deposit UGX (Min 1,000) →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Waiting for Friend Banner when multiplayer table has open seats */}
          {gameState.mode === 'multiplayer' &&
            gameState.status === 'waiting' &&
            gameState.seats.length < 2 && (
              <div className="rounded-2xl border border-[#9CE800]/40 bg-[#062214]/90 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-[#9CE800] shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-white">
                      Waiting for an online friend or player to join ({gameState.seats.length}/{gameState.maxPlayers} seated)
                    </p>
                    <p className="text-neutral-300">
                      Send a direct table request to any online player or share code{' '}
                      <span className="font-mono-tabular font-bold text-[#FFD76A]">{gameState.roomCode}</span>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvitePicker(true)}
                  className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Invite Online Friend</span>
                </button>
              </div>
            )}

          {/* Opponents Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {opponentSeats.map((seat) => (
              <SeatMedallion
                key={seat.uid}
                seat={seat}
                isCurrentTurn={
                  effectiveViewStatus === 'in_progress' && gameState.currentTurnUid === seat.uid
                }
                isYou={false}
                isWinner={gameState.winnerUid === seat.uid}
                labelSuffix={
                  gameState.gameType === 'chess' || gameState.gameType === 'drafts'
                    ? `${seat.cardCount} pieces`
                    : gameState.gameType === 'ludo'
                    ? `${seat.cardCount}/4 home`
                    : `${seat.cardCount} cards`
                }
              />
            ))}
          </div>

          {/* Center Table Surface by Game Type */}
          {gameState.gameType === 'chess' && gameState.chessState ? (
            <ChessTableView
              chessState={gameState.chessState}
              seats={gameState.seats}
              viewerUid={myUid}
              isYourTurn={isYourTurn}
              gameStatus={effectiveViewStatus}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => void toggleFullscreen()}
              onMove={(fromRow, fromCol, toRow, toCol, promotion?: ChessPieceType) => {
                if (!hasStaked) return;
                sendCommand({ type: 'CHESS_MOVE', fromRow, fromCol, toRow, toCol, promotion });
              }}
              onResign={() => {
                if (!hasStaked) return;
                sendCommand({ type: 'RESIGN_GAME' });
              }}
            />
          ) : gameState.gameType === 'drafts' && gameState.draftsState ? (
            <DraftsTableView
              draftsState={gameState.draftsState}
              seats={gameState.seats}
              viewerUid={myUid}
              isYourTurn={isYourTurn}
              gameStatus={effectiveViewStatus}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => void toggleFullscreen()}
              onMove={(fromRow, fromCol, toRow, toCol) => {
                if (!hasStaked) return;
                sendCommand({ type: 'DRAFTS_MOVE', fromRow, fromCol, toRow, toCol });
              }}
              onResign={() => {
                if (!hasStaked) return;
                sendCommand({ type: 'RESIGN_GAME' });
              }}
            />
          ) : gameState.gameType === 'ludo' && gameState.ludoState ? (
            <LudoTableView
              ludoState={gameState.ludoState}
              seats={gameState.seats}
              viewerUid={myUid}
              isYourTurn={isYourTurn}
              gameStatus={effectiveViewStatus}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => void toggleFullscreen()}
              onRoll={() => {
                if (!hasStaked) return;
                soundFx.play('ludo-roll');
                sendCommand({ type: 'LUDO_ROLL' });
              }}
              onMoveToken={(tokenIndex) => {
                if (!hasStaked) return;
                soundFx.play('ludo-move');
                sendCommand({ type: 'LUDO_MOVE', tokenIndex });
              }}
              onResign={() => {
                if (!hasStaked) return;
                sendCommand({ type: 'RESIGN_GAME' });
              }}
            />
          ) : (
            /* Matatu Royale Felt Table */
            <MatatuTableView
              gameState={{ ...gameState, status: effectiveViewStatus }}
              viewerUid={myUid}
              isYourTurn={isYourTurn}
              isHost={isHost}
              stakeLocked={!hasStaked}
              playableCardIds={playableCardIds}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => void toggleFullscreen()}
              onCardClick={handleCardClick}
              onDrawCard={() => {
                if (!hasStaked) return;
                soundFx.play('card-flip');
                sendCommand({ type: 'DRAW_CARD' });
              }}
              onStartGame={() => {
                if (!hasStaked) {
                  void handleStakeAndStart();
                } else {
                  sendCommand({ type: 'START_GAME' });
                }
              }}
              onCallLastCard={() => {
                if (!hasStaked) return;
                sendCommand({ type: 'CALL_LAST_CARD' });
              }}
            />
          )}

          {/* Completed Match Summary Banner */}
          {gameState.status === 'completed' && (
            <div className="emerald-card-surface rounded-2xl border-2 border-[#FFD76A]/70 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Trophy className="h-10 w-10 text-[#FFD76A] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#FFD76A] uppercase tracking-wider">
                      Match Complete
                    </p>
                    <h3 className="font-display text-2xl font-bold text-white">
                      {gameState.winnerUid === myUid
                        ? `Victory! +UGX ${Math.round((gameState.entryFeeUgx || MIN_GAME_STAKE_UGX) * 1.8).toLocaleString()} Credited`
                        : gameState.winnerUid === null
                        ? 'Draw — Honour Split'
                        : `${gameState.winnerName || 'Opponent'} Wins`}
                    </h3>
                    <p className="text-xs text-neutral-300">{gameState.winReason}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {isHost && (
                    <button
                      type="button"
                      disabled={rematchBusy}
                      onClick={() => void handleRematch()}
                      className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>
                        {rematchBusy
                          ? 'Starting Rematch…'
                          : `Play Again (UGX ${Math.max(MIN_GAME_STAKE_UGX, Number(stakeInput) || MIN_GAME_STAKE_UGX).toLocaleString()})`}
                      </span>
                    </button>
                  )}
                  <Link
                    to="/play"
                    className="rounded-full border border-white/20 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    Return to Lobby
                  </Link>
                </div>
              </div>
              {rematchError && (
                <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-2.5 text-xs text-red-200 flex flex-wrap items-center justify-between gap-2">
                  <span>{rematchError}</span>
                  <Link
                    to="/wallet?tab=deposit"
                    className="font-bold text-[#FFD76A] hover:underline whitespace-nowrap"
                  >
                    Deposit UGX (Min 1,000) →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Your Seat, Quick Chat & Governance */}
        <aside className="space-y-4">
          {mySeat && (
            <SeatMedallion
              seat={mySeat}
              isCurrentTurn={isYourTurn}
              isYou={true}
              isWinner={gameState.winnerUid === myUid}
              labelSuffix={
                gameState.gameType === 'chess' || gameState.gameType === 'drafts'
                  ? `${mySeat.cardCount} pieces`
                  : gameState.gameType === 'ludo'
                  ? `${mySeat.cardCount}/4 home`
                  : `${mySeat.cardCount} cards`
              }
            />
          )}

          <div id="table-opponent-chat">
            <TableChatPanel
              title="Live Chat with Opponents"
              messages={chatMessages}
              currentUid={myUid}
              typingUsers={typingUsers}
              opponents={opponentSeats.map((s) => ({
                uid: s.uid,
                name: s.displayName,
                connected: s.connected,
                isBot: s.isBot,
                gender: s.gender,
              }))}
              onSendPreset={(presetId: ChatPresetId) => sendCommand({ type: 'SEND_CHAT', presetId })}
              onSendText={(text: string) => sendCommand({ type: 'SEND_CHAT', text })}
              onTypingChange={() => {}}
            />
          </div>

          <div className="pro-panel-card rounded-xl p-4 space-y-2 text-xs text-neutral-400">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#FFD76A]" />
              <span>Fair Play Governance</span>
            </p>
            <p className="leading-relaxed">
              Moves, shuffles, and turn clocks are enforced deterministically by the CASINO ROYALE game rules engine.
            </p>
          </div>
        </aside>
      </main>

      {/* Ace Wild Suit Selector Modal */}
      {pendingAceCard && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="emerald-card-surface rounded-2xl border border-[#FFD76A]/65 p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <h3 className="font-display text-xl font-bold text-[#FFD76A]">Declare Active Suit</h3>
            <p className="text-xs text-neutral-300">
              You played an Ace! Choose the suit that the next player must match.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {SUITS.map((s: Suit) => {
                const isRed = s === 'hearts' || s === 'diamonds';
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      soundFx.play('match');
                      sendCommand({
                        type: 'PLAY_CARD',
                        cardId: pendingAceCard.id,
                        chosenSuit: s,
                      });
                      setPendingAceCard(null);
                    }}
                    className="rounded-xl border border-[#D4AF37]/45 bg-[#052315] py-3.5 px-4 flex items-center justify-center gap-2 hover:border-[#FFD76A] hover:bg-[#093D25] transition-colors cursor-pointer"
                  >
                    <span className={`text-2xl ${isRed ? 'text-red-400' : 'text-white'}`}>
                      {SUIT_SYMBOLS[s]}
                    </span>
                    <span className="text-sm font-bold text-white">{SUIT_LABELS[s]}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPendingAceCard(null)}
              className="text-xs text-neutral-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Friend Picker Modal for Inviting into Current Table */}
      {showInvitePicker && gameState && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="emerald-card-surface rounded-2xl border border-[#FFD76A]/65 p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CE800]">
                  {onlinePlayers.length} Online Now · {friends.length} Friends
                </p>
                <h3 className="font-display text-xl font-bold text-white">
                  Invite Player to {gameState.roomName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInvitePicker(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
                aria-label="Close friend picker"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <input
              type="text"
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              placeholder="Search friend name or Player ID…"
              className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#FFD76A] focus:outline-none"
            />

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {players
                .filter((p) => {
                  if (gameState.seats.some((s) => s.uid === p.uid)) return false;
                  const q = inviteSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    p.displayName.toLowerCase().includes(q) ||
                    p.playerId.toLowerCase().includes(q)
                  );
                })
                .map((p) => (
                  <div
                    key={p.uid}
                    className="rounded-xl border border-white/10 bg-[#04140C] px-3.5 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            p.isOnline ? 'bg-[#9CE800]' : 'bg-neutral-600'
                          }`}
                        />
                        <p className="text-xs font-bold text-white truncate">{p.displayName}</p>
                        {p.friendship?.status === 'accepted' && (
                          <span className="text-[10px] font-bold text-[#FFD76A]">Friend</span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono-tabular text-neutral-400 pl-4">
                        {p.playerId} · {p.isOnline ? (p.presence?.status === 'in_game' ? 'In Table' : 'Online') : 'Offline'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInvitePicker(false);
                        setInviteTarget({
                          uid: p.uid,
                          displayName: p.displayName,
                          playerId: p.playerId,
                        });
                      }}
                      className="gold-shimmer-btn inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-extrabold cursor-pointer shrink-0"
                    >
                      <Swords className="h-3 w-3" />
                      <span>Invite</span>
                    </button>
                  </div>
                ))}
              {players.filter((p) => !gameState.seats.some((s) => s.uid === p.uid)).length === 0 && (
                <div className="rounded-xl border border-white/10 bg-[#04140C] p-4 text-center space-y-2">
                  <p className="text-xs text-neutral-300">
                    No other verified players discovered yet.
                  </p>
                  <Link
                    to="/friends"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FFD76A] hover:underline"
                  >
                    Open Friends &amp; Online Directory →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {inviteTarget && gameState && (
        <SendPlayInviteModal
          target={inviteTarget}
          fixedRoom={{
            roomId: gameState.roomId,
            roomName: gameState.roomName,
            gameType: gameState.gameType || 'matatu',
            maxPlayers: gameState.maxPlayers,
            entryFeeUgx: Math.max(MIN_GAME_STAKE_UGX, gameState.entryFeeUgx || MIN_GAME_STAKE_UGX),
          }}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </div>
  );
};
