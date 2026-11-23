import { getStore } from './localStore';
import {
  createShuffledDeck,
  DEFAULT_MATATU_RULES,
  isCardPlayable,
  SUIT_LABELS,
} from '../shared/matatuRules';
import {
  applyLudoMove,
  chooseLudoBotToken,
  createInitialLudoState,
  rollLudoDice,
  toSanitizedLudoState,
  type InternalLudoState,
} from '../shared/ludoEngine';
import {
  applyChessMove,
  chooseChessBotMove,
  createInitialChessState,
  toSanitizedChessState,
  type InternalChessState,
} from '../shared/chessEngine';
import {
  applyDraftsMove,
  chooseDraftsBotMove,
  createInitialDraftsState,
  toSanitizedDraftsState,
  type InternalDraftsState,
} from '../shared/draftsEngine';
import {
  generateAiGameReaction,
  generateAiJoinGreeting,
  pickBalancedAiPersonas,
  type AiPersonaProfile,
} from '../shared/aiPersonas';
import { CHAT_PRESETS, type ChatPresetId, type RoomChatMessage } from '../shared/chatPresets';
import { requestSmartContenderReply } from './smartReplyClient';
import type { TypingIndicatorUser } from '../components/ChatTypingBubble';
import type {
  ChessPieceType,
  MatatuRulesConfig,
  PlayingCard,
  SanitizedGameState,
  SanitizedSeatState,
  Suit,
  TableGameType,
} from '../shared/types';

export interface LocalTableEngineOptions {
  roomId: string;
  roomCode: string;
  roomName: string;
  isPrivate: boolean;
  gameType: TableGameType;
  mode: 'multiplayer' | 'bot';
  maxPlayers: number;
  entryFeeUgx: number;
  playerUid: string;
  playerId: string;
  playerName: string;
  rules?: MatatuRulesConfig;
  startImmediately?: boolean;
  tournamentId?: string;
  tournamentMatchId?: string;
  onState: (state: SanitizedGameState) => void;
  onChat: (msg: RoomChatMessage) => void;
  onTyping?: (typing: TypingIndicatorUser & { isTyping: boolean }) => void;
}

export class LocalTableEngine {
  private opts: LocalTableEngineOptions;
  private rules: MatatuRulesConfig;
  private seats: SanitizedSeatState[] = [];
  private botPersonas: Record<string, AiPersonaProfile> = {};
  private gameId = `game_${Date.now().toString(36)}`;
  private status: 'waiting' | 'in_progress' | 'completed' = 'waiting';
  private turnIndex = 0;
  private direction: 1 | -1 = 1;
  private turnCount = 0;
  private turnDeadlineMs = 0;
  private winnerUid: string | null = null;
  private winnerName: string | null = null;
  private winReason?: string;
  private lastActionText = 'Table open — lock your UGX stake to deal.';

  // Matatu state
  private drawPile: PlayingCard[] = [];
  private discardPile: PlayingCard[] = [];
  private handsByUid: Record<string, PlayingCard[]> = {};
  private activeSuit: Suit = 'spades';
  private pendingDrawCount = 0;

  // Sub-game states
  private ludoInternal: InternalLudoState | null = null;
  private chessInternal: InternalChessState | null = null;
  private draftsInternal: InternalDraftsState | null = null;

  private timers: number[] = [];
  private disposed = false;

  constructor(opts: LocalTableEngineOptions) {
    this.opts = opts;
    this.rules = opts.rules || { ...DEFAULT_MATATU_RULES };
    this.initSeats();
    this.resetRound(Boolean(opts.startImmediately));
    this.scheduleGreeting();
  }

  private scheduleTimer(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      if (!this.disposed) fn();
    }, ms);
    this.timers.push(id);
  }

  public dispose(): void {
    this.disposed = true;
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
  }

  private initSeats(): void {
    const aiCfg = getStore().aiConfig;
    const targetPlayers =
      this.opts.gameType === 'chess' || this.opts.gameType === 'drafts'
        ? 2
        : Math.max(2, Math.min(4, this.opts.maxPlayers || 2));
    const botsNeeded = Math.max(1, targetPlayers - 1);
    const picked = pickBalancedAiPersonas(aiCfg.roster, botsNeeded);

    this.seats = [
      {
        uid: this.opts.playerUid,
        playerId: this.opts.playerId,
        displayName: this.opts.playerName,
        seatIndex: 0,
        connected: true,
        isBot: false,
        cardCount: 0,
        calledLastCard: false,
        score: 0,
      },
    ];

    for (let i = 0; i < botsNeeded; i += 1) {
      const persona = picked[i % picked.length];
      const botUid = `bot_${persona.id}_${i + 1}`;
      this.botPersonas[botUid] = persona;
      this.seats.push({
        uid: botUid,
        playerId: persona.id.toUpperCase(),
        displayName: persona.name,
        seatIndex: i + 1,
        connected: true,
        isBot: true,
        gender: persona.gender,
        cardCount: 0,
        calledLastCard: false,
        score: 0,
      });
    }
  }

  private scheduleGreeting(): void {
    const firstBot = this.seats.find((s) => s.isBot);
    if (!firstBot) return;
    const persona = this.botPersonas[firstBot.uid];
    if (!persona) return;
    const aiCfg = getStore().aiConfig;
    if (!aiCfg.aiEnabled || !aiCfg.aiChatEnabled || !aiCfg.aiGreetOnJoin) return;

    this.scheduleTimer(() => {
      this.opts.onChat({
        id: `chat_greet_${Date.now()}`,
        roomId: this.opts.roomId,
        uid: firstBot.uid,
        senderName: firstBot.displayName,
        text: generateAiJoinGreeting(persona, this.opts.playerName, this.opts.gameType),
        createdAtMs: Date.now(),
        isAi: true,
        isFreeText: true,
        senderGender: persona.gender,
      });
    }, 650);
  }

  private resetRound(startNow: boolean): void {
    this.gameId = `game_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    this.status = startNow ? 'in_progress' : 'waiting';
    this.winnerUid = null;
    this.winnerName = null;
    this.winReason = undefined;
    this.turnIndex = 0;
    this.direction = 1;
    this.turnCount = 0;
    this.pendingDrawCount = 0;
    this.turnDeadlineMs = startNow ? Date.now() + this.rules.turnTimeoutSeconds * 1000 : 0;

    if (this.opts.gameType === 'ludo') {
      const ludo = createInitialLudoState(this.seats.map((s) => s.uid), 'green');
      this.ludoInternal = ludo;
      this.seats.forEach((s) => {
        s.cardCount = 0;
      });
      this.lastActionText = startNow
        ? 'Ludo Master started — roll the dice!'
        : 'Preview Mode — lock UGX stake to start Ludo Master.';
    } else if (this.opts.gameType === 'chess') {
      const chess = createInitialChessState(this.seats[0].uid, this.seats[1].uid);
      this.chessInternal = chess;
      this.seats.forEach((s) => {
        s.cardCount = 16;
      });
      this.lastActionText = startNow
        ? 'Kampala Chess started — White to move!'
        : 'Preview Mode — lock UGX stake to begin Chess.';
    } else if (this.opts.gameType === 'drafts') {
      const drafts = createInitialDraftsState(this.seats[0].uid, this.seats[1].uid);
      this.draftsInternal = drafts;
      this.seats.forEach((s) => {
        s.cardCount = 12;
      });
      this.lastActionText = startNow
        ? 'Uganda Drafts started — Red moves first!'
        : 'Preview Mode — lock UGX stake to begin Uganda Drafts.';
    } else {
      const deck = createShuffledDeck();
      this.handsByUid = {};
      const handSize = this.rules.initialHandSize || 7;
      for (const seat of this.seats) {
        this.handsByUid[seat.uid] = deck.splice(0, handSize);
        seat.cardCount = handSize;
        seat.calledLastCard = false;
      }
      const starter = deck.pop()!;
      this.discardPile = [starter];
      this.drawPile = deck;
      this.activeSuit = starter.suit;
      this.lastActionText = startNow
        ? `Cards dealt! Opening card: ${starter.rank} of ${SUIT_LABELS[starter.suit]}.`
        : 'Preview Mode — lock UGX stake to deal cards.';
    }

    this.emitState();
    if (startNow) {
      this.maybeScheduleBotTurn();
    }
  }

  private emitState(): void {
    const topCard =
      this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null;
    const myHand = this.handsByUid[this.opts.playerUid] || [];

    let currentTurnUid: string | null = null;
    if (this.status === 'in_progress') {
      if (this.opts.gameType === 'ludo' && this.ludoInternal) {
        const entry = Object.entries(this.ludoInternal.seatColors).find(
          ([, c]) => c === this.ludoInternal?.turnColor
        );
        currentTurnUid = entry?.[0] || this.seats[0]?.uid || null;
      } else if (this.opts.gameType === 'chess' && this.chessInternal) {
        const entry = Object.entries(this.chessInternal.seatColors).find(
          ([, c]) => c === this.chessInternal?.turn
        );
        currentTurnUid = entry?.[0] || this.seats[0]?.uid || null;
      } else if (this.opts.gameType === 'drafts' && this.draftsInternal) {
        const entry = Object.entries(this.draftsInternal.seatColors).find(
          ([, c]) => c === this.draftsInternal?.turn
        );
        currentTurnUid = entry?.[0] || this.seats[0]?.uid || null;
      } else {
        currentTurnUid = this.seats[this.turnIndex]?.uid || null;
      }
    }

    const sanitizedSeats = this.seats.map((s) => ({
      ...s,
      hand: s.uid === this.opts.playerUid ? myHand : undefined,
    }));

    const state: SanitizedGameState = {
      roomId: this.opts.roomId,
      roomCode: this.opts.roomCode,
      roomName: this.opts.roomName,
      gameId: this.gameId,
      gameType: this.opts.gameType,
      mode: this.opts.mode,
      status: this.status,
      isPrivate: this.opts.isPrivate,
      hostUid: this.opts.playerUid,
      maxPlayers: this.seats.length,
      entryFeeUgx: this.opts.entryFeeUgx,
      tournamentId: this.opts.tournamentId,
      tournamentMatchId: this.opts.tournamentMatchId,
      seats: sanitizedSeats,
      currentTurnUid,
      direction: this.direction,
      turnDirection: this.direction,
      turnDeadlineMs: this.turnDeadlineMs,
      turnCount: this.turnCount,
      deckCount: this.drawPile.length,
      drawPileCount: this.drawPile.length,
      discardCount: this.discardPile.length,
      topDiscard: topCard,
      topDiscardCard: topCard,
      yourHand: myHand,
      activeSuit: this.activeSuit,
      pendingDrawCount: this.pendingDrawCount,
      pendingCutCard: null,
      winnerUid: this.winnerUid,
      winnerName: this.winnerName,
      winReason: this.winReason,
      lastActionText: this.lastActionText,
      rules: this.rules,
      ludoState: this.ludoInternal ? toSanitizedLudoState(this.ludoInternal) : undefined,
      chessState: this.chessInternal ? toSanitizedChessState(this.chessInternal) : undefined,
      draftsState: this.draftsInternal ? toSanitizedDraftsState(this.draftsInternal) : undefined,
    };

    this.opts.onState(state);
  }

  public handleCommand(payload: Record<string, unknown>): void {
    const type = String(payload.type || '');
    if (type === 'START_GAME') {
      if (typeof payload.entryFeeUgx === 'number' && payload.entryFeeUgx >= 1000) {
        this.opts.entryFeeUgx = Math.round(payload.entryFeeUgx);
      }
      if (this.status === 'waiting') {
        this.status = 'in_progress';
        this.turnDeadlineMs = Date.now() + this.rules.turnTimeoutSeconds * 1000;
        this.lastActionText = `${this.opts.playerName} locked the stake and started the match!`;
        this.emitState();
        this.maybeScheduleBotTurn();
      }
      return;
    }

    if (type === 'REMATCH') {
      if (typeof payload.entryFeeUgx === 'number' && payload.entryFeeUgx >= 1000) {
        this.opts.entryFeeUgx = Math.round(payload.entryFeeUgx);
      }
      this.resetRound(true);
      return;
    }

    if (type === 'RESIGN_GAME') {
      if (this.status !== 'in_progress') return;
      const rival = this.seats.find((s) => s.uid !== this.opts.playerUid);
      this.status = 'completed';
      this.winnerUid = rival?.uid || null;
      this.winnerName = rival?.displayName || 'Opponent';
      this.winReason = `${this.opts.playerName} resigned the match.`;
      this.lastActionText = this.winReason;
      this.emitState();
      return;
    }

    if (type === 'SEND_CHAT') {
      this.handleChatSend(payload);
      return;
    }

    if (this.status !== 'in_progress') return;

    if (type === 'PLAY_CARD' && this.opts.gameType === 'matatu') {
      this.playMatatuCard(
        this.opts.playerUid,
        String(payload.cardId || ''),
        payload.chosenSuit as Suit | undefined
      );
      return;
    }
    if (type === 'DRAW_CARD' && this.opts.gameType === 'matatu') {
      this.drawMatatuCard(this.opts.playerUid);
      return;
    }
    if (type === 'CALL_LAST_CARD' && this.opts.gameType === 'matatu') {
      const seat = this.seats.find((s) => s.uid === this.opts.playerUid);
      if (seat) {
        seat.calledLastCard = true;
        this.lastActionText = `${seat.displayName} called Kadi Moja (Last Card)!`;
        this.emitState();
      }
      return;
    }
    if (type === 'LUDO_ROLL' && this.opts.gameType === 'ludo') {
      this.handleLudoRoll(this.opts.playerUid);
      return;
    }
    if (type === 'LUDO_MOVE' && this.opts.gameType === 'ludo') {
      this.handleLudoMove(this.opts.playerUid, Number(payload.tokenIndex));
      return;
    }
    if (type === 'CHESS_MOVE' && this.opts.gameType === 'chess') {
      this.handleChessMove(
        this.opts.playerUid,
        Number(payload.fromRow),
        Number(payload.fromCol),
        Number(payload.toRow),
        Number(payload.toCol),
        payload.promotion as ChessPieceType | undefined
      );
      return;
    }
    if (type === 'DRAFTS_MOVE' && this.opts.gameType === 'drafts') {
      this.handleDraftsMove(
        this.opts.playerUid,
        Number(payload.fromRow),
        Number(payload.fromCol),
        Number(payload.toRow),
        Number(payload.toCol)
      );
    }
  }

  private handleChatSend(payload: Record<string, unknown>): void {
    const presetId = payload.presetId as ChatPresetId | undefined;
    const preset = presetId ? CHAT_PRESETS.find((p) => p.id === presetId) : undefined;
    const text = String(payload.text || preset?.text || '').trim().slice(0, 220);
    if (!text) return;

    this.opts.onChat({
      id: `room_msg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      roomId: this.opts.roomId,
      uid: this.opts.playerUid,
      senderName: this.opts.playerName,
      presetId: preset?.id,
      text,
      createdAtMs: Date.now(),
      isFreeText: Boolean(payload.text),
    });

    const firstBot = this.seats.find((s) => s.isBot);
    const persona = firstBot ? this.botPersonas[firstBot.uid] : undefined;
    const aiCfg = getStore().aiConfig;
    if (firstBot && persona && aiCfg.aiEnabled && aiCfg.aiChatEnabled) {
      this.scheduleTimer(() => {
        this.opts.onTyping?.({
          uid: firstBot.uid,
          senderName: firstBot.displayName,
          senderGender: persona.gender,
          isTyping: true,
        });
        void requestSmartContenderReply({
          persona,
          senderName: this.opts.playerName,
          text,
          context: this.opts.gameType,
          gameType: this.opts.gameType,
        }).then((reply) => {
          this.scheduleTimer(() => {
            this.opts.onTyping?.({
              uid: firstBot.uid,
              senderName: firstBot.displayName,
              senderGender: persona.gender,
              isTyping: false,
            });
            if (reply) {
              this.opts.onChat({
                id: `room_ai_${Date.now()}`,
                roomId: this.opts.roomId,
                uid: firstBot.uid,
                senderName: firstBot.displayName,
                text: reply,
                createdAtMs: Date.now(),
                isAi: true,
                isFreeText: true,
                senderGender: persona.gender,
              });
            }
          }, 800);
        });
      }, 350);
    }
  }

  private advanceMatatuTurn(steps = 1): void {
    const n = this.seats.length;
    this.turnIndex = (((this.turnIndex + steps * this.direction) % n) + n) % n;
    this.turnDeadlineMs = Date.now() + this.rules.turnTimeoutSeconds * 1000;
  }

  private replenishDrawPileIfNeeded(): void {
    if (this.drawPile.length > 0 || this.discardPile.length <= 1) return;
    const top = this.discardPile.pop()!;
    const recycled = [...this.discardPile];
    for (let i = recycled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [recycled[i], recycled[j]] = [recycled[j], recycled[i]];
    }
    this.drawPile = recycled;
    this.discardPile = [top];
  }

  private playMatatuCard(actorUid: string, cardId: string, chosenSuit?: Suit): void {
    const currentSeat = this.seats[this.turnIndex];
    if (!currentSeat || currentSeat.uid !== actorUid) return;
    const hand = this.handsByUid[actorUid] || [];
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx < 0) return;

    const card = hand[idx];
    const topCard = this.discardPile[this.discardPile.length - 1] || null;
    if (
      !isCardPlayable(
        card,
        topCard,
        this.activeSuit,
        this.pendingDrawCount,
        this.rules,
        hand.length
      )
    ) {
      return;
    }

    hand.splice(idx, 1);
    this.discardPile.push(card);
    currentSeat.cardCount = hand.length;
    if (hand.length !== 1) currentSeat.calledLastCard = false;
    this.turnCount += 1;

    if (hand.length === 0) {
      this.status = 'completed';
      this.winnerUid = currentSeat.uid;
      this.winnerName = currentSeat.displayName;
      this.winReason = `${currentSeat.displayName} emptied their hand on ${card.rank} of ${SUIT_LABELS[card.suit]}!`;
      this.lastActionText = this.winReason;
      this.emitState();
      return;
    }

    if (card.rank === '7' && card.suit === 'diamonds' && this.pendingDrawCount > 0 && this.rules.sevenOfDiamondsCutter) {
      this.pendingDrawCount = 0;
      this.activeSuit = card.suit;
      this.lastActionText = `${currentSeat.displayName} cut the penalty with 7♦!`;
      this.advanceMatatuTurn(1);
    } else if (card.rank === '2') {
      this.pendingDrawCount += 2;
      this.activeSuit = card.suit;
      this.lastActionText = `${currentSeat.displayName} played 2 of ${SUIT_LABELS[card.suit]} (+${this.pendingDrawCount} penalty)!`;
      this.advanceMatatuTurn(1);
    } else if (card.rank === 'A' && this.rules.aceWildOnAnyCard) {
      this.activeSuit = chosenSuit || card.suit;
      this.lastActionText = `${currentSeat.displayName} played Ace and called ${SUIT_LABELS[this.activeSuit]}!`;
      this.advanceMatatuTurn(1);
    } else if (card.rank === 'J' && this.rules.jackSkipsTurn) {
      this.activeSuit = card.suit;
      this.lastActionText = `${currentSeat.displayName} played Jack — next player skipped!`;
      this.advanceMatatuTurn(2);
    } else if (card.rank === '8' && this.rules.eightPlaysAgain) {
      this.activeSuit = card.suit;
      this.turnDeadlineMs = Date.now() + this.rules.turnTimeoutSeconds * 1000;
      this.lastActionText = `${currentSeat.displayName} played 8 and plays again!`;
    } else if (card.rank === 'K' && this.rules.kingReversesDirection) {
      this.activeSuit = card.suit;
      this.direction = this.direction === 1 ? -1 : 1;
      if (this.seats.length === 2) {
        this.turnDeadlineMs = Date.now() + this.rules.turnTimeoutSeconds * 1000;
      } else {
        this.advanceMatatuTurn(1);
      }
      this.lastActionText = `${currentSeat.displayName} played King — direction reversed!`;
    } else {
      this.activeSuit = card.suit;
      this.lastActionText = `${currentSeat.displayName} played ${card.rank} of ${SUIT_LABELS[card.suit]}.`;
      this.advanceMatatuTurn(1);
    }

    this.emitState();
    this.maybeScheduleBotTurn();
  }

  private drawMatatuCard(actorUid: string): void {
    const currentSeat = this.seats[this.turnIndex];
    if (!currentSeat || currentSeat.uid !== actorUid) return;

    const hand = this.handsByUid[actorUid] || [];
    const count = this.pendingDrawCount > 0 ? this.pendingDrawCount : 1;
    this.pendingDrawCount = 0;

    for (let i = 0; i < count; i += 1) {
      this.replenishDrawPileIfNeeded();
      const drawn = this.drawPile.pop();
      if (drawn) hand.push(drawn);
    }
    currentSeat.cardCount = hand.length;
    currentSeat.calledLastCard = false;
    this.turnCount += 1;
    this.lastActionText = `${currentSeat.displayName} drew ${count} card${count > 1 ? 's' : ''}.`;
    this.advanceMatatuTurn(1);
    this.emitState();
    this.maybeScheduleBotTurn();
  }

  private handleLudoRoll(actorUid: string): void {
    if (!this.ludoInternal) return;
    const expectedColor = this.ludoInternal.seatColors[actorUid];
    if (expectedColor !== this.ludoInternal.turnColor || this.ludoInternal.phase !== 'roll') return;
    const outcome = rollLudoDice(this.ludoInternal);
    this.ludoInternal = outcome.nextState;
    this.turnCount += 1;
    this.lastActionText = outcome.nextState.lastEventText || `Rolled ${outcome.diceValue}`;
    this.turnDeadlineMs = Date.now() + this.rules.turnTimeoutSeconds * 1000;
    this.emitState();
    this.maybeScheduleBotTurn();
  }

  private handleLudoMove(actorUid: string, tokenIndex: number): void {
    if (!this.ludoInternal) return;
    const expectedColor = this.ludoInternal.seatColors[actorUid];
    if (expectedColor !== this.ludoInternal.turnColor || this.ludoInternal.phase !== 'move') return;
    const outcome = applyLudoMove(this.ludoInternal, tokenIndex);
    this.ludoInternal = outcome.nextState;
    this.turnCount += 1;
    this.lastActionText = outcome.moveSummary;

    this.seats.forEach((s) => {
      const c = this.ludoInternal!.seatColors[s.uid];
      if (c) s.cardCount = this.ludoInternal!.finishedCountByColor[c] || 0;
    });

    if (outcome.winnerColor) {
      const winEntry = Object.entries(this.ludoInternal.seatColors).find(
        ([, c]) => c === outcome.winnerColor
      );
      const winSeat = this.seats.find((s) => s.uid === winEntry?.[0]);
      this.status = 'completed';
      this.winnerUid = winSeat?.uid || null;
      this.winnerName = winSeat?.displayName || 'Winner';
      this.winReason = outcome.moveSummary;
    } else {
      this.turnDeadlineMs = Date.now() + this.rules.turnTimeoutSeconds * 1000;
    }

    this.emitState();
    this.maybeScheduleBotTurn();
  }

  private handleChessMove(
    actorUid: string,
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    promotion?: ChessPieceType
  ): void {
    if (!this.chessInternal) return;
    if (this.chessInternal.seatColors[actorUid] !== this.chessInternal.turn) return;
    const next = applyChessMove(this.chessInternal, fromRow, fromCol, toRow, toCol, promotion);
    if (!next) return;
    this.chessInternal = next;
    this.turnCount += 1;

    let whiteCount = 0;
    let blackCount = 0;
    next.board.forEach((row) =>
      row.forEach((p) => {
        if (p?.color === 'w') whiteCount += 1;
        if (p?.color === 'b') blackCount += 1;
      })
    );
    this.seats.forEach((s) => {
      s.cardCount = next.seatColors[s.uid] === 'w' ? whiteCount : blackCount;
    });

    if (next.winnerColor || next.isDraw) {
      this.status = 'completed';
      if (next.winnerColor) {
        const winUid = Object.entries(next.seatColors).find(([, c]) => c === next.winnerColor)?.[0] || null;
        this.winnerUid = winUid;
        this.winnerName = this.seats.find((s) => s.uid === winUid)?.displayName || 'Winner';
      } else {
        this.winnerUid = null;
        this.winnerName = 'Draw';
      }
      this.winReason = next.resultReason;
      this.lastActionText = next.resultReason || 'Match finished.';
    } else {
      const lastSan = next.moveHistory[next.moveHistory.length - 1]?.san || 'Move';
      this.lastActionText = `${this.seats.find((s) => s.uid === actorUid)?.displayName || 'Player'} played ${lastSan}.`;
      this.turnDeadlineMs = Date.now() + this.rules.turnTimeoutSeconds * 1000;
    }

    this.emitState();
    this.maybeScheduleBotTurn();
  }

  private handleDraftsMove(
    actorUid: string,
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number
  ): void {
    if (!this.draftsInternal) return;
    if (this.draftsInternal.seatColors[actorUid] !== this.draftsInternal.turn) return;
    const next = applyDraftsMove(this.draftsInternal, fromRow, fromCol, toRow, toCol);
    if (!next) return;
    this.draftsInternal = next;
    this.turnCount += 1;

    let redCount = 0;
    let blackCount = 0;
    next.board.forEach((row) =>
      row.forEach((p) => {
        if (p?.color === 'red') redCount += 1;
        if (p?.color === 'black') blackCount += 1;
      })
    );
    this.seats.forEach((s) => {
      s.cardCount = next.seatColors[s.uid] === 'red' ? redCount : blackCount;
    });

    if (next.winnerColor) {
      this.status = 'completed';
      const winUid = Object.entries(next.seatColors).find(([, c]) => c === next.winnerColor)?.[0] || null;
      this.winnerUid = winUid;
      this.winnerName = this.seats.find((s) => s.uid === winUid)?.displayName || 'Winner';
      this.winReason = next.resultReason;
      this.lastActionText = next.resultReason || 'Match complete.';
    } else {
      const lastNote = next.moveHistory[next.moveHistory.length - 1]?.notation || 'Move';
      this.lastActionText = `${this.seats.find((s) => s.uid === actorUid)?.displayName || 'Player'} moved ${lastNote}.`;
      this.turnDeadlineMs = Date.now() + this.rules.turnTimeoutSeconds * 1000;
    }

    this.emitState();
    this.maybeScheduleBotTurn();
  }

  private maybeScheduleBotTurn(): void {
    if (this.status !== 'in_progress') return;
    const delay = getStore().aiConfig.moveDelayMs || 750;

    if (this.opts.gameType === 'ludo' && this.ludoInternal) {
      const turnEntry = Object.entries(this.ludoInternal.seatColors).find(
        ([, c]) => c === this.ludoInternal?.turnColor
      );
      const seat = this.seats.find((s) => s.uid === turnEntry?.[0]);
      if (!seat?.isBot) return;
      this.scheduleTimer(() => {
        if (!this.ludoInternal || this.status !== 'in_progress') return;
        if (this.ludoInternal.phase === 'roll') {
          this.handleLudoRoll(seat.uid);
        } else {
          const tokenIdx = chooseLudoBotToken(this.ludoInternal);
          if (tokenIdx !== null) this.handleLudoMove(seat.uid, tokenIdx);
        }
      }, Math.min(700, delay));
      return;
    }

    if (this.opts.gameType === 'chess' && this.chessInternal) {
      const turnEntry = Object.entries(this.chessInternal.seatColors).find(
        ([, c]) => c === this.chessInternal?.turn
      );
      const seat = this.seats.find((s) => s.uid === turnEntry?.[0]);
      if (!seat?.isBot) return;
      this.scheduleTimer(() => {
        if (!this.chessInternal || this.status !== 'in_progress') return;
        const mv = chooseChessBotMove(this.chessInternal);
        if (mv) this.handleChessMove(seat.uid, mv.fromRow, mv.fromCol, mv.toRow, mv.toCol, mv.promotion);
      }, delay);
      return;
    }

    if (this.opts.gameType === 'drafts' && this.draftsInternal) {
      const turnEntry = Object.entries(this.draftsInternal.seatColors).find(
        ([, c]) => c === this.draftsInternal?.turn
      );
      const seat = this.seats.find((s) => s.uid === turnEntry?.[0]);
      if (!seat?.isBot) return;
      this.scheduleTimer(() => {
        if (!this.draftsInternal || this.status !== 'in_progress') return;
        const mv = chooseDraftsBotMove(this.draftsInternal);
        if (mv) this.handleDraftsMove(seat.uid, mv.fromRow, mv.fromCol, mv.toRow, mv.toCol);
      }, Math.min(650, delay));
      return;
    }

    // Matatu bot turn
    const seat = this.seats[this.turnIndex];
    if (!seat?.isBot) return;
    this.scheduleTimer(() => {
      if (this.status !== 'in_progress' || this.seats[this.turnIndex]?.uid !== seat.uid) return;
      const hand = this.handsByUid[seat.uid] || [];
      const topCard = this.discardPile[this.discardPile.length - 1] || null;
      const playable = hand.find((c) =>
        isCardPlayable(c, topCard, this.activeSuit, this.pendingDrawCount, this.rules, hand.length)
      );
      if (playable) {
        const chosenSuit = playable.rank === 'A' ? hand[0]?.suit || 'spades' : undefined;
        if (hand.length === 2 && seat.isBot) {
          seat.calledLastCard = true;
        }
        this.playMatatuCard(seat.uid, playable.id, chosenSuit);
        const persona = this.botPersonas[seat.uid];
        if (persona && playable.rank === '2' && Math.random() < 0.35) {
          this.opts.onChat({
            id: `chat_react_${Date.now()}`,
            roomId: this.opts.roomId,
            uid: seat.uid,
            senderName: seat.displayName,
            text: generateAiGameReaction(persona, 'matatu_draw_two', this.opts.playerName),
            createdAtMs: Date.now(),
            isAi: true,
            isFreeText: true,
            senderGender: persona.gender,
          });
        }
      } else {
        this.drawMatatuCard(seat.uid);
      }
    }, delay);
  }
}
