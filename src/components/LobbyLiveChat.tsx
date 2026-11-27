import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useSocial } from '../lib/socialContext';
import { getStore, notifyStore, subscribeStore } from '../lib/localStore';
import {
  generateAiJoinGreeting,
  normalizeAiConfig,
  pickBalancedAiPersonas,
  type AiGovernanceConfig,
} from '../shared/aiPersonas';
import { requestSmartContenderReply } from '../lib/smartReplyClient';
import { CHAT_PRESETS, type ChatPresetId, type RoomChatMessage } from '../shared/chatPresets';
import { ChatTypingBubble, type TypingIndicatorUser } from './ChatTypingBubble';
import { soundFx } from '../utils/sound';

export const LobbyLiveChat: React.FC = () => {
  const { firebaseUser, userDoc, playerProfile } = useAuth();
  const { onlinePlayers } = useSocial();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const greetedRef = useRef(false);
  const prevCountRef = useRef(0);

  const [messages, setMessages] = useState<RoomChatMessage[]>(() => [...getStore().lobbyChat]);
  const [typingUsers, setTypingUsers] = useState<TypingIndicatorUser[]>([]);
  const timersRef = useRef<number[]>([]);
  const [aiConfig, setAiConfig] = useState<AiGovernanceConfig>(() => normalizeAiConfig(getStore().aiConfig));
  const [draft, setDraft] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const myUid = firebaseUser?.uid || 'guest';
  const myName =
    userDoc?.fullName ||
    playerProfile?.displayName ||
    firebaseUser?.displayName ||
    'Casino Royale Player';

  useEffect(() => {
    const sync = () => {
      const store = getStore();
      setMessages([...store.lobbyChat]);
      setAiConfig(normalizeAiConfig(store.aiConfig));
    };
    sync();
    return subscribeStore(sync);
  }, []);

  useEffect(() => {
    if (!firebaseUser || greetedRef.current) return;
    greetedRef.current = true;
    const store = getStore();
    if (store.lobbyChat.length === 0) {
      const now = Date.now();
      store.lobbyChat.push({
        id: `lchat_sys_${now}`,
        roomId: 'lobby',
        uid: 'system',
        senderName: 'Arena Lounge',
        text: `${myName} joined the Casino Royale arena.`,
        createdAtMs: now,
        isSystem: true,
      });
      notifyStore();

      const cfg = normalizeAiConfig(store.aiConfig);
      const persona = pickBalancedAiPersonas(cfg.roster, 1)[0];
      if (persona && cfg.aiEnabled && cfg.aiChatEnabled && cfg.aiGreetOnJoin) {
        const t = window.setTimeout(() => {
          getStore().lobbyChat.push({
            id: `lchat_greet_${Date.now()}`,
            roomId: 'lobby',
            uid: persona.id,
            senderName: persona.name,
            text: generateAiJoinGreeting(persona, myName, 'lobby'),
            createdAtMs: Date.now(),
            isFreeText: true,
            isAi: true,
            senderGender: persona.gender,
          });
          notifyStore();
        }, 700);
        timersRef.current.push(t);
      }
    }

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [firebaseUser, myName]);

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const latest = messages[messages.length - 1];
      if (latest && latest.uid !== myUid && !latest.isSystem) {
        soundFx.play('chat-pop');
      }
    }
    prevCountRef.current = messages.length;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, myUid, typingUsers.length]);

  const sendMessage = (payload: { text?: string; presetId?: ChatPresetId }) => {
    setErrorMsg('');
    if (!aiConfig.liveUserChatEnabled) {
      setErrorMsg('Live lounge chat is temporarily paused by an administrator.');
      return;
    }

    const preset = payload.presetId ? CHAT_PRESETS.find((p) => p.id === payload.presetId) : undefined;
    const text = (payload.text || preset?.text || '').trim();
    if (!text) return;

    const store = getStore();
    const msg: RoomChatMessage = {
      id: `lchat_local_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      roomId: 'lobby',
      uid: myUid,
      senderName: myName,
      presetId: preset?.id,
      text,
      createdAtMs: Date.now(),
      isFreeText: Boolean(payload.text),
    };
    const historySnapshot = store.lobbyChat.filter((m) => !m.isSystem).slice(-10);
    store.lobbyChat = [...store.lobbyChat.slice(-49), msg];
    notifyStore();

    if (aiConfig.aiEnabled && aiConfig.aiChatEnabled) {
      const lowerText = text.toLowerCase();
      const mentioned = aiConfig.roster.find((item) => {
        if (item.enabled === false) return false;
        const first = item.name.split(' ')[0] || '';
        return (
          lowerText.includes(item.name.toLowerCase()) ||
          (first.length >= 3 && new RegExp(`\\b${first}\\b`, 'i').test(text))
        );
      });
      const persona = mentioned || pickBalancedAiPersonas(aiConfig.roster, 1)[0];
      if (persona) {
        const t1 = window.setTimeout(() => {
          const typingStartedAt = Date.now();
          setTypingUsers((prev) => [
            ...prev.filter((u) => u.uid !== persona.id),
            { uid: persona.id, senderName: persona.name, senderGender: persona.gender },
          ]);
          void requestSmartContenderReply({
            persona,
            senderName: myName,
            text,
            context: 'lobby',
            history: historySnapshot.map((m) => ({
              senderName: m.senderName,
              text: m.text,
              isSelf: m.uid === persona.id,
            })),
          }).then((replyText) => {
            const targetDuration = replyText
              ? Math.min(1800, Math.max(850, replyText.length * 20))
              : 0;
            const remaining = Math.max(0, targetDuration - (Date.now() - typingStartedAt));
            const t2 = window.setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u.uid !== persona.id));
              if (!replyText) return;
              const s = getStore();
              s.lobbyChat = [
                ...s.lobbyChat.slice(-49),
                {
                  id: `lchat_ai_${Date.now()}`,
                  roomId: 'lobby',
                  uid: persona.id,
                  senderName: persona.name,
                  text: replyText,
                  createdAtMs: Date.now(),
                  isFreeText: true,
                  isAi: true,
                  senderGender: persona.gender,
                },
              ];
              notifyStore();
            }, remaining);
            timersRef.current.push(t2);
          });
        }, 380);
        timersRef.current.push(t1);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    sendMessage({ text: cleaned });
    setDraft('');
  };

  const activeRosterPreview = onlinePlayers.slice(0, 6);

  return (
    <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#063B24] text-[#FFD76A]">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
              <span>Live Arena Chat</span>
              <span className="inline-block h-2 w-2 rounded-full bg-[#9CE800]" />
            </h3>
            <p className="text-[11px] text-neutral-400">
              Chat live with active players in the arena ready to play.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-neutral-300">
          <Users className="h-3.5 w-3.5 text-[#FFD76A]" />
          <span className="truncate max-w-[260px]">
            {activeRosterPreview.length > 0
              ? `Online: ${activeRosterPreview.map((p) => p.displayName.split(' ')[0]).join(', ')}`
              : 'No players online'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/35 bg-red-950/50 px-3 py-1.5 text-xs text-red-200">
          {errorMsg}
        </div>
      )}

      <div
        ref={scrollRef}
        className="h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#041009] p-3 space-y-2"
      >
        {messages.length === 0 && typingUsers.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-8">
            Entering the arena lounge…
          </p>
        ) : (
          <>
            {messages.slice(-40).map((m) => {
              const mine = m.uid === myUid;
              if (m.isSystem) {
                return (
                  <div key={m.id} className="text-center text-[11px] text-neutral-400 italic py-0.5">
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
                  className={`rounded-xl px-3 py-2 text-xs ${
                    m.isAdmin
                      ? 'bg-[#092C19] border border-[#9CE800]/35 text-white'
                      : mine
                      ? 'bg-[#073A22]/85 border border-[#D4AF37]/35 text-white'
                      : 'bg-white/5 border border-white/10 text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`font-semibold text-[11px] inline-flex items-center gap-1 ${nameColor}`}>
                      {m.isAdmin && <ShieldCheck className="h-3 w-3 shrink-0" />}
                      <span>{m.senderName}</span>
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono-tabular">
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
            <ChatTypingBubble typingUsers={typingUsers} variant="lobby" />
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!aiConfig.liveUserChatEnabled}
          maxLength={220}
          placeholder={
            aiConfig.liveUserChatEnabled
              ? 'Chat with joined players or challenge someone to Matatu, Ludo, Chess…'
              : 'Live chat is paused by admin'
          }
          className="flex-1 min-w-0 rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#FFD76A] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!aiConfig.liveUserChatEnabled || !draft.trim()}
          className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-45 shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {CHAT_PRESETS.slice(0, 5).map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={!aiConfig.liveUserChatEnabled}
            onClick={() => sendMessage({ presetId: preset.id })}
            className="rounded-lg border border-white/10 bg-[#071810] px-2.5 py-1 text-[11px] text-neutral-300 hover:border-[#D4AF37]/60 hover:text-[#FFD76A] cursor-pointer disabled:opacity-45"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </section>
  );
};
