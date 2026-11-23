export type AiGender = 'female' | 'male';
export type AiPlayStyle = 'friendly' | 'competitive' | 'strategic' | 'calm';
export type AiDifficulty = 'casual' | 'balanced' | 'sharp';
export type AiChatFrequency = 'low' | 'normal' | 'lively';

export interface AiPersonaProfile {
  id: string;
  name: string;
  gender: AiGender;
  city: string;
  style: AiPlayStyle;
  rating: number;
  enabled: boolean;
  isCustom?: boolean;
}

export interface AiGovernanceConfig {
  aiEnabled: boolean;
  autoFillMultiplayer: boolean;
  autoFillDelaySeconds: number;
  maxAiPerRoom: number;
  difficulty: AiDifficulty;
  moveDelayMs: number;
  aiChatEnabled: boolean;
  aiGreetOnJoin: boolean;
  aiChatFrequency: AiChatFrequency;
  liveUserChatEnabled: boolean;
  roster: AiPersonaProfile[];
}

export const DEFAULT_AI_ROSTER: AiPersonaProfile[] = [
  { id: 'ai_sarah_n', name: 'Sarah Namukasa', gender: 'female', city: 'Kampala', style: 'friendly', rating: 1940, enabled: true },
  { id: 'ai_david_k', name: 'David Kato', gender: 'male', city: 'Entebbe', style: 'strategic', rating: 2010, enabled: true },
  { id: 'ai_grace_a', name: 'Grace Achieng', gender: 'female', city: 'Jinja', style: 'competitive', rating: 1985, enabled: true },
  { id: 'ai_brian_m', name: 'Brian Mugisha', gender: 'male', city: 'Mbarara', style: 'calm', rating: 1915, enabled: true },
  { id: 'ai_prossy_n', name: 'Prossy Nabwire', gender: 'female', city: 'Kampala', style: 'strategic', rating: 2060, enabled: true },
  { id: 'ai_ivan_s', name: 'Ivan Ssemwogerere', gender: 'male', city: 'Wakiso', style: 'competitive', rating: 1970, enabled: true },
  { id: 'ai_flavia_b', name: 'Flavia Babirye', gender: 'female', city: 'Mukono', style: 'friendly', rating: 1885, enabled: true },
  { id: 'ai_ronald_t', name: 'Ronald Tumusiime', gender: 'male', city: 'Gulu', style: 'calm', rating: 1930, enabled: true },
  { id: 'ai_rita_k', name: 'Rita Kyomuhendo', gender: 'female', city: 'Fort Portal', style: 'competitive', rating: 1995, enabled: true },
  { id: 'ai_moses_o', name: 'Moses Okello', gender: 'male', city: 'Lira', style: 'strategic', rating: 2025, enabled: true },
  { id: 'ai_sharon_n', name: 'Sharon Nakato', gender: 'female', city: 'Kampala', style: 'friendly', rating: 1955, enabled: true },
  { id: 'ai_denis_w', name: 'Denis Wasswa', gender: 'male', city: 'Masaka', style: 'calm', rating: 1920, enabled: true },
  { id: 'ai_patricia_a', name: 'Patricia Apio', gender: 'female', city: 'Soroti', style: 'strategic', rating: 1975, enabled: true },
  { id: 'ai_kenneth_b', name: 'Kenneth Byaruhanga', gender: 'male', city: 'Hoima', style: 'competitive', rating: 1960, enabled: true },
  { id: 'ai_diana_n', name: 'Diana Nansubuga', gender: 'female', city: 'Kampala', style: 'friendly', rating: 1910, enabled: true },
  { id: 'ai_samuel_m', name: 'Samuel Musoke', gender: 'male', city: 'Mbale', style: 'strategic', rating: 2005, enabled: true },
];

export const DEFAULT_AI_CONFIG: AiGovernanceConfig = {
  aiEnabled: true,
  autoFillMultiplayer: true,
  autoFillDelaySeconds: 18,
  maxAiPerRoom: 3,
  difficulty: 'balanced',
  moveDelayMs: 950,
  aiChatEnabled: true,
  aiGreetOnJoin: true,
  aiChatFrequency: 'normal',
  liveUserChatEnabled: true,
  roster: DEFAULT_AI_ROSTER,
};

export function normalizeAiConfig(raw?: Partial<AiGovernanceConfig> | null): AiGovernanceConfig {
  return {
    aiEnabled: raw?.aiEnabled ?? DEFAULT_AI_CONFIG.aiEnabled,
    autoFillMultiplayer: raw?.autoFillMultiplayer ?? DEFAULT_AI_CONFIG.autoFillMultiplayer,
    autoFillDelaySeconds: Math.min(45, Math.max(3, raw?.autoFillDelaySeconds ?? DEFAULT_AI_CONFIG.autoFillDelaySeconds)),
    maxAiPerRoom: Math.min(3, Math.max(1, raw?.maxAiPerRoom ?? DEFAULT_AI_CONFIG.maxAiPerRoom)),
    difficulty: raw?.difficulty ?? DEFAULT_AI_CONFIG.difficulty,
    moveDelayMs: Math.min(3000, Math.max(400, raw?.moveDelayMs ?? DEFAULT_AI_CONFIG.moveDelayMs)),
    aiChatEnabled: raw?.aiChatEnabled ?? DEFAULT_AI_CONFIG.aiChatEnabled,
    aiGreetOnJoin: raw?.aiGreetOnJoin ?? DEFAULT_AI_CONFIG.aiGreetOnJoin,
    aiChatFrequency: raw?.aiChatFrequency ?? DEFAULT_AI_CONFIG.aiChatFrequency,
    liveUserChatEnabled: raw?.liveUserChatEnabled ?? DEFAULT_AI_CONFIG.liveUserChatEnabled,
    roster: Array.isArray(raw?.roster) && raw.roster.length > 0 ? raw.roster : DEFAULT_AI_ROSTER,
  };
}

export function pickBalancedAiPersonas(
  roster: AiPersonaProfile[],
  count: number
): AiPersonaProfile[] {
  const enabled = roster.filter((p) => p.enabled);
  const pool = enabled.length > 0 ? [...enabled] : [...DEFAULT_AI_ROSTER];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, count));
}

export function contenderPlayerId(id: string): string {
  const clean = id.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-6).padStart(6, '0');
  return `CR-${clean}`;
}

export function generateAiJoinGreeting(
  persona: AiPersonaProfile,
  playerName: string,
  context: 'lobby' | 'matatu' | 'ludo' | 'chess' | 'drafts' = 'lobby'
): string {
  const first = playerName.split(/\s+/)[0] || 'Friend';
  if (context === 'ludo') return `Webale ${first}! Ready for a sharp Ludo Master race from ${persona.city}?`;
  if (context === 'chess') return `Good luck ${first} — let us see a clean Kampala Chess opening.`;
  if (context === 'drafts') return `Welcome ${first}! Watch those diagonal captures on Uganda Drafts.`;
  if (context === 'matatu') return `Hello ${first}, good luck! Keep an eye on that 7 of Diamonds.`;
  return `Welcome to the Arena Lounge, ${first}! Who is ready for a table?`;
}

export function generateAiGameReaction(
  persona: AiPersonaProfile,
  event: 'win' | 'loss' | 'victory' | 'capture' | 'ludo_capture' | 'six' | 'cut' | 'good_move' | 'matatu_draw_two' | 'matatu_last_card',
  subjectName?: string,
  _recentTexts?: string[]
): string {
  const who = subjectName ? subjectName.split(/\s+/)[0] : '';
  if (event === 'win' || event === 'victory') {
    return who
      ? `Well played ${who}! ${persona.name} sends regards from ${persona.city}.`
      : `Well played! ${persona.name} sends regards from ${persona.city}.`;
  }
  if (event === 'loss') return 'Nice victory! Rematch whenever you are ready.';
  if (event === 'capture' || event === 'ludo_capture') {
    return who
      ? `Ooh! ${who} landed a sharp capture right on the track!`
      : 'Oh! Clean capture right on the track!';
  }
  if (event === 'six') return 'Rolling 6s like a true Kampala champion!';
  if (event === 'cut') return '7 of Diamonds cut! What a save!';
  if (event === 'matatu_draw_two') {
    return who ? `Eeh ${who}, +2 on the table — do you have a cutter?` : '+2 on the table! Careful!';
  }
  if (event === 'matatu_last_card') {
    return who ? `${who} is down to Last Card! Stay sharp.` : 'Kadi Moja! Almost there!';
  }
  return 'Sharp tactical play!';
}
