import type {
  DraftsColor,
  DraftsLegalMoveTarget,
  DraftsMoveRecord,
  DraftsPiece,
  SanitizedDraftsState,
} from './types';

export interface InternalDraftsState {
  board: (DraftsPiece | null)[][];
  turn: DraftsColor;
  seatColors: Record<string, DraftsColor>;
  activeChainSquare: { row: number; col: number } | null;
  lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null;
  moveCount: number;
  capturedByRed: number;
  capturedByBlack: number;
  moveHistory: DraftsMoveRecord[];
  winnerColor: DraftsColor | null;
  resultReason?: string;
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(b: (DraftsPiece | null)[][]): (DraftsPiece | null)[][] {
  return b.map((row) => row.map((p) => (p ? { ...p } : null)));
}

export function createInitialDraftsState(redUid: string, blackUid: string): InternalDraftsState {
  const board: (DraftsPiece | null)[][] = Array.from({ length: 8 }, () =>
    Array<DraftsPiece | null>(8).fill(null)
  );
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r][c] = { color: 'black', king: false };
        else if (r > 4) board[r][c] = { color: 'red', king: false };
      }
    }
  }
  return {
    board,
    turn: 'red',
    seatColors: { [redUid]: 'red', [blackUid]: 'black' },
    activeChainSquare: null,
    lastMove: null,
    moveCount: 0,
    capturedByRed: 0,
    capturedByBlack: 0,
    moveHistory: [],
    winnerColor: null,
  };
}

function captureMovesForPiece(
  board: (DraftsPiece | null)[][],
  r: number,
  c: number,
  piece: DraftsPiece
): DraftsLegalMoveTarget[] {
  const enemy: DraftsColor = piece.color === 'red' ? 'black' : 'red';
  const out: DraftsLegalMoveTarget[] = [];
  const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  if (!piece.king) {
    for (const [dr, dc] of dirs) {
      const mr = r + dr;
      const mc = c + dc;
      const lr = r + 2 * dr;
      const lc = c + 2 * dc;
      if (inBounds(lr, lc) && board[mr][mc]?.color === enemy && !board[lr][lc]) {
        out.push({ toRow: lr, toCol: lc, isCapture: true, capturedRow: mr, capturedCol: mc });
      }
    }
    return out;
  }

  for (const [dr, dc] of dirs) {
    let cr = r + dr;
    let cc = c + dc;
    let jumped: { row: number; col: number } | null = null;
    while (inBounds(cr, cc)) {
      const cell = board[cr][cc];
      if (!cell) {
        if (jumped) {
          out.push({
            toRow: cr,
            toCol: cc,
            isCapture: true,
            capturedRow: jumped.row,
            capturedCol: jumped.col,
          });
        }
      } else if (cell.color === piece.color) {
        break;
      } else {
        if (jumped) break;
        jumped = { row: cr, col: cc };
      }
      cr += dr;
      cc += dc;
    }
  }
  return out;
}

function stepMovesForPiece(
  board: (DraftsPiece | null)[][],
  r: number,
  c: number,
  piece: DraftsPiece
): DraftsLegalMoveTarget[] {
  const out: DraftsLegalMoveTarget[] = [];
  if (!piece.king) {
    const forward = piece.color === 'red' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const nr = r + forward;
      const nc = c + dc;
      if (inBounds(nr, nc) && !board[nr][nc]) {
        out.push({ toRow: nr, toCol: nc });
      }
    }
    return out;
  }

  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc) && !board[nr][nc]) {
      out.push({ toRow: nr, toCol: nc });
      nr += dr;
      nc += dc;
    }
  }
  return out;
}

export function computeDraftsLegalMoves(state: Pick<InternalDraftsState, 'board' | 'turn' | 'activeChainSquare'>): {
  legalMovesBySquare: Record<string, DraftsLegalMoveTarget[]>;
  mustCapture: boolean;
} {
  if (state.activeChainSquare) {
    const { row, col } = state.activeChainSquare;
    const p = state.board[row][col];
    const caps = p ? captureMovesForPiece(state.board, row, col, p) : [];
    return {
      legalMovesBySquare: caps.length > 0 ? { [`${row},${col}`]: caps } : {},
      mustCapture: true,
    };
  }

  const captures: Record<string, DraftsLegalMoveTarget[]> = {};
  const steps: Record<string, DraftsLegalMoveTarget[]> = {};
  let hasCapture = false;

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (!p || p.color !== state.turn) continue;
      const caps = captureMovesForPiece(state.board, r, c, p);
      if (caps.length > 0) {
        hasCapture = true;
        captures[`${r},${c}`] = caps;
      } else if (!hasCapture) {
        const st = stepMovesForPiece(state.board, r, c, p);
        if (st.length > 0) steps[`${r},${c}`] = st;
      }
    }
  }

  return {
    legalMovesBySquare: hasCapture ? captures : steps,
    mustCapture: hasCapture,
  };
}

export function applyDraftsMove(
  state: InternalDraftsState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): InternalDraftsState | null {
  if (state.winnerColor) return null;
  const { legalMovesBySquare } = computeDraftsLegalMoves(state);
  const target = (legalMovesBySquare[`${fromRow},${fromCol}`] || []).find(
    (m) => m.toRow === toRow && m.toCol === toCol
  );
  const piece = state.board[fromRow][fromCol];
  if (!target || !piece) return null;

  const board = cloneBoard(state.board);
  let capturedByRed = state.capturedByRed;
  let capturedByBlack = state.capturedByBlack;

  if (target.isCapture && target.capturedRow !== undefined && target.capturedCol !== undefined) {
    board[target.capturedRow][target.capturedCol] = null;
    if (piece.color === 'red') capturedByRed += 1;
    else capturedByBlack += 1;
  }

  const promoted =
    !piece.king && ((piece.color === 'red' && toRow === 0) || (piece.color === 'black' && toRow === 7));
  const movedPiece: DraftsPiece = { color: piece.color, king: piece.king || promoted };
  board[toRow][toCol] = movedPiece;
  board[fromRow][fromCol] = null;

  let nextChain: { row: number; col: number } | null = null;
  if (target.isCapture && !promoted) {
    const moreCaps = captureMovesForPiece(board, toRow, toCol, movedPiece);
    if (moreCaps.length > 0) {
      nextChain = { row: toRow, col: toCol };
    }
  }

  const nextTurn: DraftsColor = nextChain ? state.turn : state.turn === 'red' ? 'black' : 'red';
  const nextMoveCount = state.moveCount + 1;
  const notation = `${COLS[fromCol]}${8 - fromRow}${target.isCapture ? 'x' : '-'}${COLS[toCol]}${8 - toRow}${promoted ? 'K' : ''}`;
  const entry: DraftsMoveRecord = { turn: nextMoveCount, color: state.turn, notation };

  let redCount = 0;
  let blackCount = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const cell = board[r][c];
      if (cell?.color === 'red') redCount += 1;
      if (cell?.color === 'black') blackCount += 1;
    }
  }

  let winnerColor: DraftsColor | null = null;
  let resultReason: string | undefined;
  if (redCount === 0) {
    winnerColor = 'black';
    resultReason = 'Black captured all Red pieces!';
  } else if (blackCount === 0) {
    winnerColor = 'red';
    resultReason = 'Red captured all Black pieces!';
  } else {
    const nextLegal = computeDraftsLegalMoves({ board, turn: nextTurn, activeChainSquare: nextChain });
    if (Object.keys(nextLegal.legalMovesBySquare).length === 0) {
      winnerColor = nextTurn === 'red' ? 'black' : 'red';
      resultReason = `${winnerColor === 'red' ? 'Red' : 'Black'} wins (no legal moves remaining)!`;
    }
  }

  return {
    board,
    turn: nextTurn,
    seatColors: state.seatColors,
    activeChainSquare: nextChain,
    lastMove: { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } },
    moveCount: nextMoveCount,
    capturedByRed,
    capturedByBlack,
    moveHistory: [...state.moveHistory.slice(-39), entry],
    winnerColor,
    resultReason,
  };
}

export function chooseDraftsBotMove(
  state: InternalDraftsState
): { fromRow: number; fromCol: number; toRow: number; toCol: number } | null {
  const { legalMovesBySquare } = computeDraftsLegalMoves(state);
  const candidates: Array<{ fromRow: number; fromCol: number; toRow: number; toCol: number; score: number }> = [];
  for (const [k, targets] of Object.entries(legalMovesBySquare)) {
    const [fr, fc] = k.split(',').map(Number);
    for (const t of targets) {
      let score = Math.random();
      if (t.isCapture) score += 20;
      if (state.turn === 'black' && t.toRow === 7) score += 10;
      if (state.turn === 'red' && t.toRow === 0) score += 10;
      candidates.push({ fromRow: fr, fromCol: fc, toRow: t.toRow, toCol: t.toCol, score });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export function toSanitizedDraftsState(state: InternalDraftsState): SanitizedDraftsState {
  let redCount = 0;
  let blackCount = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (p?.color === 'red') redCount += 1;
      if (p?.color === 'black') blackCount += 1;
    }
  }
  const { legalMovesBySquare, mustCapture } = state.winnerColor
    ? { legalMovesBySquare: {}, mustCapture: false }
    : computeDraftsLegalMoves(state);

  return {
    board: state.board,
    turn: state.turn,
    seatColors: state.seatColors,
    legalMovesBySquare,
    activeChainSquare: state.activeChainSquare,
    mustCapture,
    lastMove: state.lastMove,
    moveCount: state.moveCount,
    redRemaining: redCount,
    blackRemaining: blackCount,
    redCount,
    blackCount,
    capturedByRed: state.capturedByRed,
    capturedByBlack: state.capturedByBlack,
    moveHistory: state.moveHistory,
    resultReason: state.resultReason,
  };
}
