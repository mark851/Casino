import type { AiPersonaProfile } from '../shared/aiPersonas';

export async function requestSmartContenderReply(params: {
  persona: AiPersonaProfile;
  senderName: string;
  text: string;
  context: 'lobby' | 'matatu' | 'ludo' | 'chess' | 'drafts';
  gameType?: string;
  roomSummary?: string;
  history?: Array<{ senderName: string; text: string; isSelf: boolean }>;
}): Promise<string | null> {
  const first = params.senderName.split(/\s+/)[0] || 'Friend';
  const lower = params.text.toLowerCase();

  if (/hi|hello|hey|mambo|sasa|oli otya|webale/.test(lower)) {
    return `Oli otya ${first}! Ready for a clean match here in ${params.persona.city}.`;
  }
  if (/luck|gg|well played|nice/.test(lower)) {
    return `Appreciate that ${first}! Good luck at the table — may the sharper strategy take the pot.`;
  }
  if (/rematch|again|play/.test(lower)) {
    return `Always ready for another round, ${first}! Lock your stake and let us go.`;
  }
  if (params.context === 'ludo') {
    return `Watching your pawns closely, ${first} — one six changes everything!`;
  }
  if (params.context === 'matatu') {
    return `Careful ${first}, I might have a 7 of Diamonds waiting if you drop a +2!`;
  }
  if (params.context === 'chess') {
    return `Strong positional idea, ${first}. Let us see how the center holds.`;
  }
  if (params.context === 'drafts') {
    return `Watch the diagonal chain, ${first} — flying kings are dangerous!`;
  }
  return `Copy that ${first}! Drop a table invite whenever you want a live match.`;
}
