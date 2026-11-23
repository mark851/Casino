import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { CHAT_PRESETS, type ChatPresetId, type RoomChatMessage } from '../shared/chatPresets';
import { ChatTypingBubble, type TypingIndicatorUser } from './ChatTypingBubble';
import { soundFx } from '../utils/sound';

interface OpponentBadge {
  uid: string;
  name: string;
  connected?: boolean;
  isBot?: boolean;
  gender?: 'female' | 'male';
}

interface TableChatPanelProps {
  messages: RoomChatMessage[];
  currentUid: string;
  onSendPreset: (presetId: ChatPresetId) => void;
  onSendText?: (text: string) => void;
  disabled?: boolean;
  title?: string;
  opponents?: OpponentBadge[];
  typingUsers?: TypingIndicatorUser[];
  onTypingChange?: (isTyping: boolean) => void;
}

export const TableChatPanel: React.FC<TableChatPanelProps> = ({
  messages,
  currentUid,
  onSendPreset,
  onSendText,
  disabled = false,
  title = 'Live Chat with Opponents',
  opponents = [],
  typingUsers = [],
  onTypingChange,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef<number>(messages.length);
  const typingIdleTimerRef = useRef<number | null>(null);
  const isLocalTypingRef = useRef(false);

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const added = messages.slice(prevCountRef.current);
      const fromOthers = added.filter((m) => m.uid !== currentUid && !m.isSystem);
      if (fromOthers.length > 0) {
        soundFx.play('chat-pop');
        if (!expanded) {
          setUnreadCount((c) => c + fromOthers.length);
        }
      }
    }
    prevCountRef.current = messages.length;
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentUid, expanded, typingUsers.length]);

  useEffect(() => {
    return () => {
      if (typingIdleTimerRef.current !== null) {
        window.clearTimeout(typingIdleTimerRef.current);
      }
      if (isLocalTypingRef.current) {
        onTypingChange?.(false);
      }
    };
  }, [onTypingChange]);

  const handleToggleExpand = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!onTypingChange) return;
    if (typingIdleTimerRef.current !== null) {
      window.clearTimeout(typingIdleTimerRef.current);
    }
    if (value.trim()) {
      if (!isLocalTypingRef.current) {
        isLocalTypingRef.current = true;
        onTypingChange(true);
      }
      typingIdleTimerRef.current = window.setTimeout(() => {
        isLocalTypingRef.current = false;
        onTypingChange(false);
      }, 2200);
    } else if (isLocalTypingRef.current) {
      isLocalTypingRef.current = false;
      onTypingChange(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || !onSendText) return;
    const text = draft.replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (typingIdleTimerRef.current !== null) {
      window.clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    if (isLocalTypingRef.current) {
      isLocalTypingRef.current = false;
      onTypingChange?.(false);
    }
    onSendText(text);
    setDraft('');
  };

  return (
    <div className="pro-panel-card rounded-xl overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={handleToggleExpand}
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 text-left hover:bg-white/5 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-white uppercase">
          <MessageSquare className="h-3.5 w-3.5 text-[#FFD76A]" />
          <span>{title}</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-[#9CE800] px-1.5 py-0.5 text-[10px] font-extrabold text-[#04140C]">
              {unreadCount}
            </span>
          )}
          {typingUsers.length > 0 && !expanded && (
            <span className="text-[10px] font-medium lowercase text-[#FFD76A]">
              {typingUsers[0].senderName.split(' ')[0]} typing…
            </span>
          )}
        </span>
        <span className="text-[11px] text-neutral-400">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <div className="p-3.5 space-y-3">
          {opponents.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-[#04120B] px-2.5 py-1.5 text-[10px]">
              <span className="text-neutral-400 font-semibold mr-0.5">Opponents:</span>
              {opponents.map((opp) => (
                <span
                  key={opp.uid}
                  className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 font-medium text-neutral-200"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      opp.connected === false ? 'bg-neutral-500' : 'bg-[#9CE800]'
                    }`}
                  />
                  <span>{opp.name}</span>
                </span>
              ))}
            </div>
          )}

          {/* Live Message Stream */}
          <div ref={scrollRef} className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            {messages.length === 0 && typingUsers.length === 0 ? (
              <p className="text-[11px] text-neutral-500 py-3 text-center">
                Say hello — chat live with your opponents at this table!
              </p>
            ) : (
              <>
                {messages.slice(-30).map((m) => {
                  const mine = m.uid === currentUid;
                  if (m.isSystem) {
                    return (
                      <div
                        key={m.id}
                        className="text-center text-[10px] text-neutral-400 py-0.5 italic"
                      >
                        {m.text}
                      </div>
                    );
                  }
                  const nameColor = m.isAdmin
                    ? 'text-[#9CE800]'
                    : mine
                    ? 'text-[#FFD76A]'
                    : m.senderGender === 'female'
                    ? 'text-amber-200'
                    : 'text-sky-300';
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg px-2.5 py-1.5 text-xs ${
                        m.isAdmin
                          ? 'bg-[#092C19] border border-[#9CE800]/35 text-white'
                          : mine
                          ? 'bg-[#073A22]/80 border border-[#D4AF37]/30 text-white'
                          : 'bg-white/5 border border-white/10 text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`font-semibold text-[11px] inline-flex items-center gap-1 ${nameColor}`}>
                          {m.isAdmin && <ShieldCheck className="h-3 w-3 shrink-0" />}
                          <span>{m.senderName}</span>
                        </span>
                        <span className="text-[9px] text-neutral-500 font-mono-tabular">
                          {new Date(m.createdAtMs).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="leading-snug break-words">{m.text}</p>
                    </div>
                  );
                })}
                <ChatTypingBubble typingUsers={typingUsers} variant="table" />
              </>
            )}
          </div>

          {/* Live Free-Text Chat Input */}
          {onSendText && (
            <form onSubmit={handleSubmit} className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                disabled={disabled}
                maxLength={220}
                placeholder="Message opponents live…"
                className="flex-1 min-w-0 rounded-lg border border-white/15 bg-[#04120B] px-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#FFD76A] focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={disabled || !draft.trim()}
                className="gold-shimmer-btn inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-45 shrink-0"
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          )}

          {/* Quick Chat Chips */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
            {CHAT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => onSendPreset(preset.id)}
                className="flex items-center justify-between gap-1 rounded-lg border border-white/10 bg-[#0D1318] px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 hover:border-[#D4AF37]/60 hover:text-[#FFD76A] disabled:opacity-40 transition-colors cursor-pointer truncate"
              >
                <span className="truncate">{preset.label}</span>
                <Send className="h-2.5 w-2.5 shrink-0 text-[#D4AF37]/70" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
