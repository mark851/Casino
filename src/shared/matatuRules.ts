import type { MatatuRulesConfig, PlayingCard, Rank, Suit } from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
};

export const SUIT_LABELS: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  clubs: 'Clubs',
  diamonds: 'Diamonds',
};

export const DEFAULT_MATATU_RULES: MatatuRulesConfig = {
  initialHandSize: 7,
  allowStackingTwos: true,
  sevenOfDiamondsCutter: true,
  jackSkipsTurn: true,
  kingReversesDirection: true,
  eightPlaysAgain: true,
  aceWildOnAnyCard: true,
  threeDrawPenalty: false,
  allowFinishOnSpecialCard: false,
  turnTimeoutSeconds: 30,
};

export function createShuffledDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}_${suit}`,
        rank,
        suit,
      });
    }
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

export function isSpecialMatatuRank(rank: Rank, rules: MatatuRulesConfig): boolean {
  if (rank === '2' || rank === 'A') return true;
  if (rank === 'J' && rules.jackSkipsTurn) return true;
  if (rank === 'K' && rules.kingReversesDirection) return true;
  if (rank === '8' && rules.eightPlaysAgain) return true;
  if (rank === '3' && rules.threeDrawPenalty) return true;
  return false;
}

export function isCardPlayable(
  card: PlayingCard,
  topCard: PlayingCard | null,
  activeSuit: Suit,
  pendingDrawCount: number,
  rules: MatatuRulesConfig,
  handSize?: number
): boolean {
  if (!topCard) return true;

  if (
    handSize === 1 &&
    !rules.allowFinishOnSpecialCard &&
    isSpecialMatatuRank(card.rank, rules)
  ) {
    return false;
  }

  if (pendingDrawCount > 0) {
    if (rules.sevenOfDiamondsCutter && card.rank === '7' && card.suit === 'diamonds') {
      return true;
    }
    if (rules.allowStackingTwos && card.rank === '2') {
      return true;
    }
    return false;
  }

  if (rules.aceWildOnAnyCard && card.rank === 'A') {
    return true;
  }

  return card.suit === activeSuit || card.rank === topCard.rank;
}
