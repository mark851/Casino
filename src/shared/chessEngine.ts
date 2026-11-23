import type {
  ChessColor,
  ChessLegalMoveTarget,
  ChessMoveRecord,
  ChessPiece,
  ChessPieceType,
  SanitizedChessState,
} from './types';

export interface InternalChessState {
  board: (ChessPiece | null)[][];
  turn: ChessColor;
  seatColors: Record<string, ChessColor>;
  enPassantTarget: { row: number; col: number } | null;
  lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null;
  moveHistory: ChessMoveRecord[];
  capturedByWhite: ChessPieceType[];
  capturedByBlack: ChessPieceType[];
  winnerColor: ChessColor | null;
  isDraw: boolean;
  resultReason?: string;
}

const PIECE_VALUES: Record<ChessPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(board: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function createInitialChessState(whiteUid: string, blackUid: string): InternalChessState {
  const board: (ChessPiece | null)[][] = Array.from({ length: 8 }, () =>
    Array<ChessPiece | null>(8).fill(null)
  );
  const backRank: ChessPieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c += 1) {
    board[0][c] = { type: backRank[c], color: 'b', hasMoved: false };
    board[1][c] = { type: 'p', color: 'b', hasMoved: false };
    board[6][c] = { type: 'p', color: 'w', hasMoved: false };
    board[7][c] = { type: backRank[c], color: 'w', hasMoved: false };
  }
  return {
    board,
    turn: 'w',
    seatColors: { [whiteUid]: 'w', [blackUid]: 'b' },
    enPassantTarget: null,
    lastMove: null,
    moveHistory: [],
    capturedByWhite: [],
    capturedByBlack: [],
    winnerColor: null,
    isDraw: false,
  };
}

function isSquareAttacked(
  board: (ChessPiece | null)[][],
  targetRow: number,
  targetCol: number,
  attackerColor: ChessColor
): boolean {
  const pawnDir = attackerColor === 'w' ? -1 : 1;
  for (const dc of [-1, 1]) {
    const pr = targetRow - pawnDir;
    const pc = targetCol + dc;
    if (inBounds(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.color === attackerColor && p.type === 'p') return true;
    }
  }
  const knightJumps = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [dr, dc] of knightJumps) {
    const nr = targetRow + dr;
    const nc = targetCol + dc;
    if (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.color === attackerColor && p.type === 'n') return true;
    }
  }
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const kr = targetRow + dr;
      const kc = targetCol + dc;
      if (inBounds(kr, kc)) {
        const p = board[kr][kc];
        if (p && p.color === attackerColor && p.type === 'k') return true;
      }
    }
  }
  const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of straightDirs) {
    let r = targetRow + dr;
    let c = targetCol + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === attackerColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of diagDirs) {
    let r = targetRow + dr;
    let c = targetCol + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === attackerColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

function findKing(board: (ChessPiece | null)[][], color: ChessColor): { row: number; col: number } | null {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') return { row: r, col: c };
    }
  }
  return null;
}

function isInCheck(board: (ChessPiece | null)[][], color: ChessColor): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  return isSquareAttacked(board, kingPos.row, kingPos.col, color === 'w' ? 'b' : 'w');
}

function pseudoMovesForSquare(
  board: (ChessPiece | null)[][],
  r: number,
  c: number,
  enPassantTarget: { row: number; col: number } | null
): ChessLegalMoveTarget[] {
  const piece = board[r][c];
  if (!piece) return [];
  const moves: ChessLegalMoveTarget[] = [];
  const enemy: ChessColor = piece.color === 'w' ? 'b' : 'w';

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? -1 : 1;
    const startRow = piece.color === 'w' ? 6 : 1;
    const promoRow = piece.color === 'w' ? 0 : 7;

    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push({ toRow: r + dir, toCol: c, isPromotion: r + dir === promoRow });
      if (r === startRow && inBounds(r + 2 * dir, c) && !board[r + 2 * dir][c]) {
        moves.push({ toRow: r + 2 * dir, toCol: c });
      }
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (target && target.color === enemy) {
        moves.push({ toRow: nr, toCol: nc, isCapture: true, isPromotion: nr === promoRow });
      } else if (enPassantTarget && enPassantTarget.row === nr && enPassantTarget.col === nc) {
        moves.push({ toRow: nr, toCol: nc, isCapture: true, isEnPassant: true });
      }
    }
    return moves;
  }

  if (piece.type === 'n') {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || target.color === enemy) {
        moves.push({ toRow: nr, toCol: nc, isCapture: Boolean(target) });
      }
    }
    return moves;
  }

  if (piece.type === 'k') {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr][nc];
        if (!target || target.color === enemy) {
          moves.push({ toRow: nr, toCol: nc, isCapture: Boolean(target) });
        }
      }
    }
    if (!piece.hasMoved && !isInCheck(board, piece.color)) {
      const kRook = board[r][7];
      if (kRook && kRook.type === 'r' && !kRook.hasMoved && !board[r][5] && !board[r][6]) {
        if (!isSquareAttacked(board, r, 5, enemy) && !isSquareAttacked(board, r, 6, enemy)) {
          moves.push({ toRow: r, toCol: 6, isCastle: true });
        }
      }
      const qRook = board[r][0];
      if (qRook && qRook.type === 'r' && !qRook.hasMoved && !board[r][1] && !board[r][2] && !board[r][3]) {
        if (!isSquareAttacked(board, r, 3, enemy) && !isSquareAttacked(board, r, 2, enemy)) {
          moves.push({ toRow: r, toCol: 2, isCastle: true });
        }
      }
    }
    return moves;
  }

  const dirs: number[][] = [];
  if (piece.type === 'r' || piece.type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
  if (piece.type === 'b' || piece.type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  for (const [dr, dc] of dirs) {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const target = board[nr][nc];
      if (!target) {
        moves.push({ toRow: nr, toCol: nc });
      } else {
        if (target.color === enemy) moves.push({ toRow: nr, toCol: nc, isCapture: true });
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  return moves;
}

export function computeLegalChessMoves(
  state: Pick<InternalChessState, 'board' | 'turn' | 'enPassantTarget'>
): Record<string, ChessLegalMoveTarget[]> {
  const out: Record<string, ChessLegalMoveTarget[]> = {};
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== state.turn) continue;
      const pseudo = pseudoMovesForSquare(state.board, r, c, state.enPassantTarget);
      const legal = pseudo.filter((mv) => {
        const sim = cloneBoard(state.board);
        sim[mv.toRow][mv.toCol] = { ...piece, hasMoved: true };
        sim[r][c] = null;
        if (mv.isEnPassant) sim[r][mv.toCol] = null;
        if (mv.isCastle) {
          if (mv.toCol === 6) {
            sim[r][5] = sim[r][7];
            sim[r][7] = null;
          } else {
            sim[r][3] = sim[r][0];
            sim[r][0] = null;
          }
        }
        return !isInCheck(sim, state.turn);
      });
      if (legal.length > 0) {
        out[`${r},${c}`] = legal;
      }
    }
  }
  return out;
}

export function applyChessMove(
  state: InternalChessState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  promotion: ChessPieceType = 'q'
): InternalChessState | null {
  if (state.winnerColor || state.isDraw) return null;
  const legalMap = computeLegalChessMoves(state);
  const candidate = (legalMap[`${fromRow},${fromCol}`] || []).find(
    (m) => m.toRow === toRow && m.toCol === toCol
  );
  const piece = state.board[fromRow][fromCol];
  if (!candidate || !piece) return null;

  const board = cloneBoard(state.board);
  const capturedPiece = board[toRow][toCol];
  const capturedByWhite = [...state.capturedByWhite];
  const capturedByBlack = [...state.capturedByBlack];

  if (candidate.isEnPassant) {
    const epVictim = board[fromRow][toCol];
    if (epVictim) {
      if (piece.color === 'w') capturedByWhite.push(epVictim.type);
      else capturedByBlack.push(epVictim.type);
    }
    board[fromRow][toCol] = null;
  } else if (capturedPiece) {
    if (piece.color === 'w') capturedByWhite.push(capturedPiece.type);
    else capturedByBlack.push(capturedPiece.type);
  }

  const finalType = candidate.isPromotion ? promotion : piece.type;
  board[toRow][toCol] = { type: finalType, color: piece.color, hasMoved: true };
  board[fromRow][fromCol] = null;

  if (candidate.isCastle) {
    if (toCol === 6 && board[fromRow][7]) {
      board[fromRow][5] = { ...board[fromRow][7]!, hasMoved: true };
      board[fromRow][7] = null;
    } else if (toCol === 2 && board[fromRow][0]) {
      board[fromRow][3] = { ...board[fromRow][0]!, hasMoved: true };
      board[fromRow][0] = null;
    }
  }

  const nextEp =
    piece.type === 'p' && Math.abs(toRow - fromRow) === 2
      ? { row: (fromRow + toRow) / 2, col: fromCol }
      : null;
  const nextTurn: ChessColor = state.turn === 'w' ? 'b' : 'w';
  const nextInCheck = isInCheck(board, nextTurn);
  const nextLegal = computeLegalChessMoves({ board, turn: nextTurn, enPassantTarget: nextEp });
  const hasAnyNextMove = Object.keys(nextLegal).length > 0;

  let winnerColor: ChessColor | null = null;
  let isDraw = false;
  let resultReason: string | undefined;
  if (!hasAnyNextMove) {
    if (nextInCheck) {
      winnerColor = state.turn;
      resultReason = `Checkmate! ${state.turn === 'w' ? 'White' : 'Black'} wins.`;
    } else {
      isDraw = true;
      resultReason = 'Stalemate draw.';
    }
  }

  const sqName = `${FILES[toCol]}${8 - toRow}`;
  const prefix = piece.type === 'p' ? (candidate.isCapture ? `${FILES[fromCol]}x` : '') : `${piece.type.toUpperCase()}${candidate.isCapture ? 'x' : ''}`;
  const san = candidate.isCastle
    ? toCol === 6 ? 'O-O' : 'O-O-O'
    : `${prefix}${sqName}${candidate.isPromotion ? `=${finalType.toUpperCase()}` : ''}${!hasAnyNextMove && nextInCheck ? '#' : nextInCheck ? '+' : ''}`;

  return {
    board,
    turn: nextTurn,
    seatColors: state.seatColors,
    enPassantTarget: nextEp,
    lastMove: { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } },
    moveHistory: [...state.moveHistory, { san, color: state.turn }],
    capturedByWhite,
    capturedByBlack,
    winnerColor,
    isDraw,
    resultReason,
  };
}

export function chooseChessBotMove(
  state: InternalChessState
): { fromRow: number; fromCol: number; toRow: number; toCol: number; promotion?: ChessPieceType } | null {
  const legal = computeLegalChessMoves(state);
  const allMoves: Array<{
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    score: number;
    isPromotion?: boolean;
  }> = [];

  for (const [key, targets] of Object.entries(legal)) {
    const [fr, fc] = key.split(',').map(Number);
    for (const t of targets) {
      let score = Math.random() * 0.4;
      const victim = state.board[t.toRow][t.toCol];
      if (victim) score += PIECE_VALUES[victim.type] * 10;
      if (t.isPromotion) score += 8;
      if (t.toRow >= 2 && t.toRow <= 5 && t.toCol >= 2 && t.toCol <= 5) score += 0.8;
      allMoves.push({ fromRow: fr, fromCol: fc, toRow: t.toRow, toCol: t.toCol, score, isPromotion: t.isPromotion });
    }
  }
  if (allMoves.length === 0) return null;
  allMoves.sort((a, b) => b.score - a.score);
  const best = allMoves[0];
  return {
    fromRow: best.fromRow,
    fromCol: best.fromCol,
    toRow: best.toRow,
    toCol: best.toCol,
    promotion: best.isPromotion ? 'q' : undefined,
  };
}

export function toSanitizedChessState(state: InternalChessState): SanitizedChessState {
  let whiteMat = 0;
  let blackMat = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (!p) continue;
      if (p.color === 'w') whiteMat += PIECE_VALUES[p.type];
      else blackMat += PIECE_VALUES[p.type];
    }
  }
  const inCheckColor = isInCheck(state.board, state.turn) ? state.turn : null;
  const legalMovesBySquare =
    state.winnerColor || state.isDraw ? {} : computeLegalChessMoves(state);

  return {
    board: state.board,
    turn: state.turn,
    seatColors: state.seatColors,
    legalMovesBySquare,
    inCheckColor,
    lastMove: state.lastMove,
    moveHistory: state.moveHistory,
    capturedByWhite: state.capturedByWhite,
    capturedByBlack: state.capturedByBlack,
    materialAdvantageWhite: whiteMat - blackMat,
    resultReason: state.resultReason,
  };
}
