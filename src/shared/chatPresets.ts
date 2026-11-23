export type ChatPresetId =
  | 'good_luck'
  | 'nice_move'
  | 'matatu_alert'
  | 'rematch'
  | 'well_played'
  | 'watch_out';

export interface RoomChatMessage {
  id: string;
  roomId: string;
  uid: string;
  senderName: string;
  text: string;
  createdAtMs: number;
  presetId?: ChatPresetId;
  isSystem?: boolean;
  isFreeText?: boolean;
  isAdmin?: boolean;
  isAi?: boolean;
  senderGender?: 'male' | 'female';
}

export const CHAT_PRESETS: Array<{ id: ChatPresetId; label: string; text: string }> = [
  { id: 'good_luck', label: 'Good Luck!', text: 'Good luck everyone at the table!' },
  { id: 'nice_move', label: 'Nice Move', text: 'Sharp move! Respect.' },
  { id: 'matatu_alert', label: 'Last Card!', text: 'Watch out — getting close to Last Card!' },
  { id: 'watch_out', label: 'Hold On!', text: 'Careful on that turn!' },
  { id: 'well_played', label: 'Well Played', text: 'Well played match!' },
  { id: 'rematch', label: 'Rematch?', text: 'Up for another round?' },
];
