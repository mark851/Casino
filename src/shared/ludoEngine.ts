import type { LudoColor, LudoMoveRecord, SanitizedLudoState } from './types';

export const LUDO_COLOR_ORDER: LudoColor[] = ['green', 'yellow', 'blue', 'red'];

export const LUDO_COLOR_LABELS: Record<LudoColor, string> = {
  green: 'Green (Liverpool)',
  yellow: 'Yellow (Arsenal)',
  red: 'Red (Man Utd)',
  blue: 'Blue (Chelsea)',
};

export const START_RING_INDEX: Record<LudoColor, number> = {
  green: 0,
  yellow: 13,
  blue: 26,
  red: 39,
};

// Classic star tiles are safe; Entry tiles (0, 13, 26, 39) are NOT safe so Entry KOs apply!
export const SAFE_RING_INDICES = new Set<number>([8, 21, 34, 47]);

// 52-cell outer track clockwise around 15x15 Ludo grid
const OUTER_RING_COORDS: Array<{ row: number; col: number }> = [
  { row: 6, col: 1 }, // 0: Green start
  { row: 6, col: 2 },
  { row: 6, col: 3 },
  { row: 6, col: 4 },
  { row: 6, col: 5 },
  { row: 5, col: 6 },
  { row: 4, col: 6 },
  { row: 3, col: 6 },
  { row: 2, col: 6 }, // 8: Star
  { row: 1, col: 6 },
  { row: 0, col: 6 },
  { row: 0, col: 7 },
  { row: 0, col: 8 },
  { row: 1, col: 8 }, // 13: Yellow start
  { row: 2, col: 8 },
  { row: 3, col: 8 },
  { row: 4, col: 8 },
  { row: 5, col: 8 },
  { row: 6, col: 9 },
  { row: 6, col: 10 },
  { row: 6, col: 11 },
  { row: 6, col: 12 }, // 21: Star
  { row: 6, col: 13 },
  { row: 6, col: 14 },
  { row: 7, col: 14 },
  { row: 8, col: 14 },
  { row: 8, col: 13 }, // 26: Blue start
  { row: 8, col: 12 },
  { row: 8, col: 11 },
  { row: 8, col: 10 },
  { row: 8, col: 9 },
  { row: 9, col: 8 },
  { row: 10, col: 8 },
  { row: 11, col: 8 },
  { row: 12, col: 8 }, // 34: Star
  { row: 13, col: 8 },
  { row: 14, col: 8 },
  { row: 14, col: 7 },
  { row: 14, col: 6 },
  { row: 13, col: 6 }, // 39: Red start
  { row: 12, col: 6 },
  { row: 11, col: 6 },
  { row: 10, col: 6 },
  { row: 9, col: 6 },
  { row: 8, col: 5 },
  { row: 8, col: 4 },
  { row: 8, col: 3 },
  { row: 8, col: 2 }, // 47: Star
  { row: 8, col: 1 },
  { row: 8, col: 0 },
  { row: 7, col: 0 },
  { row: 6, col: 0 },
];

const HOME_STRETCH_COORDS: Record<LudoColor, Array<{ row: number; col: number }>> = {
  green: [
    { row: 7, col: 1 },
    { row: 7, col: 2 },
    { row: 7, col: 3 },
    { row: 7, col: 4 },
    { row: 7, col: 5 },
    { row: 7, col: 6 },
  ],
  yellow: [
    { row: 1, col: 7 },
    { row: 2, col: 7 },
    { row: 3, col: 7 },
    { row: 4, col: 7 },
    { row: 5, col: 7 },
    { row: 6, col: 7 },
  ],
  blue: [
    { row: 7, col: 13 },
    { row: 7, col: 12 },
    { row: 7, col: 11 },
    { row: 7, col: 10 },
    { row: 7, col: 9 },
    { row: 7, col: 8 },
  ],
  red: [
    { row: 13, col: 7 },
    { row: 12, col: 7 },
    { row: 11, col: 7 },
    { row: 10, col: 7 },
    { row: 9, col: 7 },
    { row: 8, col: 7 },
  ],
};

const YARD_COORDS: Record<LudoColor, Array<{ row: number; col: number }>> = {
  green: [
    { row: 1.8, col: 1.8 },
    { row: 1.8, col: 3.2 },
    { row: 3.2, col: 1.8 },
    { row: 3.2, col: 3.2 },
  ],
  yellow: [
    { row: 1.8, col: 10.8 },
    { row: 1.8, col: 12.2 },
    { row: 3.2, col: 10.8 },
    { row: 3.2, col: 12.2 },
  ],
  blue: [
    { row: 10.8, col: 10.8 },
    { row: 10.8, col: 12.2 },
    { row: 12.2, col: 10.8 },
    { row: 12.2, col: 12.2 },
  ],
  red: [
    { row: 10.8, col: 1.8 },
    { row: 10.8, col: 3.2 },
    { row: 12.2, col: 1.8 },
    { row: 12.2, col: 3.2 },
  ],
};

export function getRingIndex(color: LudoColor, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  return (START_RING_INDEX[color] + progress) % 52;
}

export function getTokenBoardCoord(
  color: LudoColor,
  tokenIndex: number,
  progress: number
): { row: number; col: number } {
  if (progress < 0) {
    return YARD_COORDS[color][tokenIndex % 4];
  }
  if (progress <= 50) {
    const idx = (START_RING_INDEX[color] + progress) % 52;
    return OUTER_RING_COORDS[idx];
  }
  const homeIdx = Math.min(5, progress - 51);
  return HOME_STRETCH_COORDS[color][homeIdx];
}

export interface InternalLudoState extends SanitizedLudoState {
  turnCounter: number;
}

export function getPathBlockadeColor(
  state: Pick<InternalLudoState, 'activeColors' | 'tokensByColor' | 'doubleSixUnlocked'>,
  moverColor: LudoColor,
  fromProgress: number,
  steps: number
): LudoColor | null {
  if (state.doubleSixUnlocked) return null;
  const startProg = fromProgress < 0 ? 0 : fromProgress + 1;
  const endProg = fromProgress < 0 ? 0 : fromProgress + steps;
  for (let p = startProg; p <= endProg; p += 1) {
    const ringIdx = getRingIndex(moverColor, p);
    if (ringIdx === null || SAFE_RING_INDICES.has(ringIdx)) continue;
    for (const other of state.activeColors) {
      if (other === moverColor) continue;
      const count = (state.tokensByColor[other] || []).filter(
        (op) => getRingIndex(other, op) === ringIdx
      ).length;
      if (count >= 2) {
        return other;
      }
    }
  }
  return null;
}

export function computeMovableTokens(
  state: Pick<InternalLudoState, 'activeColors' | 'tokensByColor' | 'doubleSixUnlocked'>,
  color: LudoColor,
  diceValue: number
): number[] {
  const tokens = state.tokensByColor[color] || [];
  const movable: number[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const prog = tokens[i];
    if (prog === 56) continue;
    if (prog === -1) {
      if (diceValue === 6 && !getPathBlockadeColor(state, color, -1, 6)) {
        movable.push(i);
      }
      continue;
    }
    const next = prog + diceValue;
    if (next <= 56 && !getPathBlockadeColor(state, color, prog, diceValue)) {
      movable.push(i);
    }
  }
  return movable;
}

function defaultOppositeColor(c: LudoColor): LudoColor {
  if (c === 'green') return 'blue';
  if (c === 'yellow') return 'red';
  if (c === 'red') return 'yellow';
  return 'green';
}

export function createInitialLudoState(
  seatUidsOrCount: string[] | number,
  preferredFirstColor: LudoColor = 'green',
  explicitSecondColor?: LudoColor
): InternalLudoState {
  const isCount = typeof seatUidsOrCount === 'number';
  const count = isCount
    ? Math.max(2, Math.min(4, seatUidsOrCount))
    : Math.max(2, Math.min(4, seatUidsOrCount.length));

  let activeColors: LudoColor[];
  if (count === 2) {
    const second =
      explicitSecondColor && explicitSecondColor !== preferredFirstColor
        ? explicitSecondColor
        : defaultOppositeColor(preferredFirstColor);
    activeColors = [preferredFirstColor, second];
  } else if (count === 3) {
    const others = LUDO_COLOR_ORDER.filter((c) => c !== preferredFirstColor).slice(0, 2);
    activeColors = [preferredFirstColor, ...others];
  } else {
    const idx = LUDO_COLOR_ORDER.indexOf(preferredFirstColor);
    activeColors = [
      ...LUDO_COLOR_ORDER.slice(idx),
      ...LUDO_COLOR_ORDER.slice(0, idx),
    ];
  }

  const seatColors: Record<string, LudoColor> = {};
  if (!isCount) {
    seatUidsOrCount.forEach((uid, idx) => {
      seatColors[uid] = activeColors[idx % activeColors.length];
    });
  } else {
    seatColors['local-human'] = activeColors[0];
    activeColors.slice(1).forEach((c, idx) => {
      seatColors[`local-bot-${idx + 1}`] = c;
    });
  }

  return {
    activeColors,
    seatColors,
    turnColor: activeColors[0],
    phase: 'roll',
    diceValue: null,
    legalTokenIndices: [],
    movableTokenIndices: [],
    consecutiveSixes: 0,
    doubleSixUnlocked: false,
    tokensByColor: {
      red: [-1, -1, -1, -1],
      green: [-1, -1, -1, -1],
      yellow: [-1, -1, -1, -1],
      blue: [-1, -1, -1, -1],
    },
    finishedCountByColor: {
      red: 0,
      green: 0,
      yellow: 0,
      blue: 0,
    },
    winnerColor: null,
    turnCounter: 1,
    moveHistory: [{ turn: 0, text: 'Ludo Master board initialized.' }],
    lastEventText: 'Roll the dice to deploy your first button!',
  };
}

function advanceTurnColor(state: InternalLudoState): LudoColor {
  const idx = state.activeColors.indexOf(state.turnColor);
  return state.activeColors[(idx + 1) % state.activeColors.length];
}

export function rollLudoDice(state: InternalLudoState): {
  nextState: InternalLudoState;
  diceValue: number;
  rolledValue: number;
  autoSkipped: boolean;
  forfeitedByThreeSixes: boolean;
  noLegalMoves: boolean;
  unlockedDoubleSix: boolean;
} {
  const diceValue = 1 + Math.floor(Math.random() * 6);
  const nextSixes = diceValue === 6 ? state.consecutiveSixes + 1 : 0;
  const unlockedDoubleSix = diceValue === 6 && nextSixes === 2;
  const nextDoubleUnlocked = unlockedDoubleSix ? true : Boolean(state.doubleSixUnlocked && diceValue === 6);

  if (nextSixes >= 3) {
    const nextTurn = advanceTurnColor(state);
    const msg = `${LUDO_COLOR_LABELS[state.turnColor]} rolled a third consecutive 6 — turn forfeited.`;
    const nextTurnNum = (state.turnCounter || 1) + 1;
    const entry: LudoMoveRecord = { turn: state.turnCounter || 1, text: msg };
    return {
      diceValue,
      rolledValue: diceValue,
      autoSkipped: true,
      forfeitedByThreeSixes: true,
      noLegalMoves: true,
      unlockedDoubleSix: false,
      nextState: {
        ...state,
        diceValue,
        consecutiveSixes: 0,
        doubleSixUnlocked: false,
        legalTokenIndices: [],
        movableTokenIndices: [],
        phase: 'roll',
        turnColor: nextTurn,
        turnCounter: nextTurnNum,
        lastEventText: msg,
        moveHistory: [...state.moveHistory.slice(-29), entry],
      },
    };
  }

  const stateForLegal = { ...state, doubleSixUnlocked: nextDoubleUnlocked };
  const movable = computeMovableTokens(stateForLegal, state.turnColor, diceValue);
  if (movable.length === 0) {
    const keepsRollForSix = diceValue === 6;
    const nextTurn = keepsRollForSix ? state.turnColor : advanceTurnColor(state);
    const msg = keepsRollForSix
      ? `${LUDO_COLOR_LABELS[state.turnColor]} rolled 6 with no deployable pawns — roll again!`
      : `${LUDO_COLOR_LABELS[state.turnColor]} rolled ${diceValue} — no legal moves.`;
    const entry: LudoMoveRecord = { turn: state.turnCounter || 1, text: msg };
    return {
      diceValue,
      rolledValue: diceValue,
      autoSkipped: !keepsRollForSix,
      forfeitedByThreeSixes: false,
      noLegalMoves: true,
      unlockedDoubleSix,
      nextState: {
        ...state,
        diceValue,
        consecutiveSixes: keepsRollForSix ? nextSixes : 0,
        doubleSixUnlocked: keepsRollForSix ? nextDoubleUnlocked : false,
        legalTokenIndices: [],
        movableTokenIndices: [],
        phase: 'roll',
        turnColor: nextTurn,
        turnCounter: keepsRollForSix ? state.turnCounter || 1 : (state.turnCounter || 1) + 1,
        lastEventText: msg,
        moveHistory: [...state.moveHistory.slice(-29), entry],
      },
    };
  }

  const rollMsg = `${LUDO_COLOR_LABELS[state.turnColor]} rolled ${diceValue}! Select a highlighted button.`;
  return {
    diceValue,
    rolledValue: diceValue,
    autoSkipped: false,
    forfeitedByThreeSixes: false,
    noLegalMoves: false,
    unlockedDoubleSix,
    nextState: {
      ...state,
      diceValue,
      consecutiveSixes: nextSixes,
      doubleSixUnlocked: nextDoubleUnlocked,
      legalTokenIndices: movable,
      movableTokenIndices: movable,
      phase: 'move',
      lastEventText: rollMsg,
    },
  };
}

export function applyLudoMove(
  state: InternalLudoState,
  tokenIndex: number
): {
  nextState: InternalLudoState;
  captured: boolean;
  capturedColors: LudoColor[];
  entryCapturedColors: LudoColor[];
  reachedHome: boolean;
  moveSummary: string;
  winnerColor: LudoColor | null;
} {
  const color = state.turnColor;
  const dice = state.diceValue || 1;
  if (!state.legalTokenIndices.includes(tokenIndex) && !state.movableTokenIndices.includes(tokenIndex)) {
    return {
      nextState: state,
      captured: false,
      capturedColors: [],
      entryCapturedColors: [],
      reachedHome: false,
      moveSummary: state.lastEventText || '',
      winnerColor: state.winnerColor,
    };
  }

  const tokensByColor: Record<LudoColor, number[]> = {
    red: [...state.tokensByColor.red],
    green: [...state.tokensByColor.green],
    yellow: [...state.tokensByColor.yellow],
    blue: [...state.tokensByColor.blue],
  };

  const curProg = tokensByColor[color][tokenIndex];
  const nextProg = curProg < 0 ? 0 : curProg + dice;
  tokensByColor[color][tokenIndex] = nextProg;

  const capturedColors: LudoColor[] = [];
  const entryCapturedColors: LudoColor[] = [];
  const landedRing = getRingIndex(color, nextProg);

  if (landedRing !== null && !SAFE_RING_INDICES.has(landedRing)) {
    for (const other of state.activeColors) {
      if (other === color) continue;
      const otherTokens = tokensByColor[other];
      const matches = otherTokens
        .map((p, idx) => (getRingIndex(other, p) === landedRing ? idx : -1))
        .filter((idx) => idx >= 0);
      if (matches.length === 1) {
        otherTokens[matches[0]] = -1;
        capturedColors.push(other);
        if (landedRing === START_RING_INDEX[other]) {
          entryCapturedColors.push(other);
        }
      }
    }
  }

  const captured = capturedColors.length > 0;
  const reachedHome = nextProg === 56;
  const finishedCountByColor: Record<LudoColor, number> = {
    red: tokensByColor.red.filter((p) => p === 56).length,
    green: tokensByColor.green.filter((p) => p === 56).length,
    yellow: tokensByColor.yellow.filter((p) => p === 56).length,
    blue: tokensByColor.blue.filter((p) => p === 56).length,
  };

  const winnerColor = finishedCountByColor[color] >= 4 ? color : null;
  const bonusTurn = dice === 6 || captured || reachedHome;
  const nextTurn = bonusTurn && !winnerColor ? color : advanceTurnColor(state);
  const label = LUDO_COLOR_LABELS[color];
  const eventText = winnerColor
    ? `${label} brought all 4 buttons home and won!`
    : entryCapturedColors.length > 0
    ? `${label} scored an Entry KO capture and earned a bonus roll!`
    : captured
    ? `${label} captured an opponent button and earned a bonus roll!`
    : reachedHome
    ? `${label} reached Home Center and earned a bonus roll!`
    : dice === 6
    ? `${label} rolled 6 and keeps the dice!`
    : `${label} advanced button #${tokenIndex + 1}.`;

  const entry: LudoMoveRecord = { turn: state.turnCounter || 1, text: eventText };
  return {
    captured,
    capturedColors,
    entryCapturedColors,
    reachedHome,
    moveSummary: eventText,
    winnerColor,
    nextState: {
      ...state,
      tokensByColor,
      finishedCountByColor,
      turnColor: nextTurn,
      phase: 'roll',
      diceValue: null,
      legalTokenIndices: [],
      movableTokenIndices: [],
      consecutiveSixes: bonusTurn ? state.consecutiveSixes : 0,
      doubleSixUnlocked: false,
      turnCounter: bonusTurn ? state.turnCounter || 1 : (state.turnCounter || 1) + 1,
      lastEventText: eventText,
      moveHistory: [...state.moveHistory.slice(-29), entry],
      winnerColor,
    },
  };
}

export function chooseLudoBotToken(state: InternalLudoState): number | null {
  const movable = state.legalTokenIndices.length > 0 ? state.legalTokenIndices : state.movableTokenIndices;
  if (movable.length === 0) return null;
  const color = state.turnColor;
  const dice = state.diceValue || 1;
  const tokens = state.tokensByColor[color];

  for (const idx of movable) {
    if (tokens[idx] + dice === 56) return idx;
  }
  for (const idx of movable) {
    const nextProg = tokens[idx] < 0 ? 0 : tokens[idx] + dice;
    const ringIdx = getRingIndex(color, nextProg);
    if (ringIdx !== null && !SAFE_RING_INDICES.has(ringIdx)) {
      for (const other of state.activeColors) {
        if (other === color) continue;
        const hits = state.tokensByColor[other].filter((p) => getRingIndex(other, p) === ringIdx);
        if (hits.length === 1) return idx;
      }
    }
  }
  const yardIdx = movable.find((idx) => tokens[idx] === -1);
  if (yardIdx !== undefined) return yardIdx;

  return movable.reduce((best, cur) => (tokens[cur] > tokens[best] ? cur : best), movable[0]);
}

export function toSanitizedLudoState(
  state: InternalLudoState,
  seatColorsOverride?: Record<string, LudoColor>
): SanitizedLudoState {
  const movable = state.legalTokenIndices.length > 0 ? state.legalTokenIndices : state.movableTokenIndices;
  return {
    activeColors: state.activeColors,
    seatColors: seatColorsOverride || state.seatColors,
    turnColor: state.turnColor,
    phase: state.phase,
    diceValue: state.diceValue,
    legalTokenIndices: movable,
    movableTokenIndices: movable,
    consecutiveSixes: state.consecutiveSixes,
    doubleSixUnlocked: Boolean(state.doubleSixUnlocked),
    tokensByColor: state.tokensByColor,
    finishedCountByColor: state.finishedCountByColor,
    winnerColor: state.winnerColor,
    moveHistory: state.moveHistory,
    lastEventText: state.lastEventText,
  };
}
