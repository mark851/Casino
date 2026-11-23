import React from 'react';

export interface TypingIndicatorUser {
  uid: string;
  senderName: string;
  senderGender?: 'male' | 'female';
}

interface ChatTypingBubbleProps {
  typingUsers: TypingIndicatorUser[];
  variant?: 'table' | 'lobby' | 'dm';
}

export const ChatTypingBubble: React.FC<ChatTypingBubbleProps> = ({
  typingUsers,
  variant = 'table',
}) => {
  if (!typingUsers || typingUsers.length === 0) return null;

  if (variant === 'dm') {
    const primary = typingUsers[0];
    return (
      <div
        className="flex justify-start animate-chat-typing-in"
        aria-live="polite"
        aria-label={`${primary.senderName} is typing`}
      >
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-[#071B11] px-3.5 py-2.5 text-xs text-neutral-300 shadow-sm">
          <span className="text-[11px] text-neutral-400 font-medium">typing</span>
          <span className="inline-flex items-center gap-1" aria-hidden="true">
            <span
              className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-[#FFD76A]"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-[#FFD76A]"
              style={{ animationDelay: '180ms' }}
            />
            <span
              className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-[#FFD76A]"
              style={{ animationDelay: '360ms' }}
            />
          </span>
        </div>
      </div>
    );
  }

  const label =
    typingUsers.length === 1
      ? `${typingUsers[0].senderName} is typing`
      : typingUsers.length === 2
      ? `${typingUsers[0].senderName.split(' ')[0]} and ${typingUsers[1].senderName.split(' ')[0]} are typing`
      : `${typingUsers[0].senderName.split(' ')[0]} and ${typingUsers.length - 1} others are typing`;

  const primaryGender = typingUsers[0]?.senderGender;
  const nameColor =
    primaryGender === 'female' ? 'text-amber-200' : 'text-sky-300';

  return (
    <div
      className="animate-chat-typing-in rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs flex items-center justify-between gap-2"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-semibold text-[11px] truncate ${nameColor}`}>
          {typingUsers.length === 1 ? typingUsers[0].senderName : label}
        </span>
        {typingUsers.length === 1 && (
          <span className="text-[11px] text-neutral-400 shrink-0">is typing</span>
        )}
      </div>
      <span className="inline-flex items-center gap-1 shrink-0 pr-0.5" aria-hidden="true">
        <span
          className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-[#FFD76A]"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-[#FFD76A]"
          style={{ animationDelay: '180ms' }}
        />
        <span
          className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-[#FFD76A]"
          style={{ animationDelay: '360ms' }}
        />
      </span>
    </div>
  );
};
