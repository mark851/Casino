import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { useAuth } from '../../lib/authContext';
import {
  getStore,
  listPublicRoomsFromStore,
  notifyStore,
  subscribeStore,
} from '../../lib/localStore';
import {
  contenderPlayerId,
  DEFAULT_AI_CONFIG,
  DEFAULT_AI_ROSTER,
  normalizeAiConfig,
  type AiChatFrequency,
  type AiDifficulty,
  type AiGender,
  type AiGovernanceConfig,
  type AiPersonaProfile,
  type AiPlayStyle,
} from '../../shared/aiPersonas';
import type { RoomChatMessage } from '../../shared/chatPresets';
import type { PublicRoomSummary } from '../../shared/types';
import { writeAdminLog } from '../adminHelpers';

interface AdminRoomSummary extends PublicRoomSummary {
  aiSeats?: Array<{ uid: string; displayName: string; gender?: AiGender }>;
}

export const AdminAiControlPage: React.FC = () => {
  const { firebaseUser } = useAuth();

  const [config, setConfig] = useState<AiGovernanceConfig>(DEFAULT_AI_CONFIG);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [genderFilter, setGenderFilter] = useState<'all' | AiGender | 'online' | 'offline'>('all');
  const [rosterSearch, setRosterSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<AiGender>('female');
  const [newCity, setNewCity] = useState('Kampala');
  const [newStyle, setNewStyle] = useState<AiPlayStyle>('friendly');

  const [lobbyChat, setLobbyChat] = useState<RoomChatMessage[]>([]);
  const [lobbyDraft, setLobbyDraft] = useState('');
  const [lobbySpeakerId, setLobbySpeakerId] = useState('admin');

  const [rooms, setRooms] = useState<AdminRoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [roomChat, setRoomChat] = useState<RoomChatMessage[]>([]);
  const [roomDraft, setRoomDraft] = useState('');
  const [roomSpeakerId, setRoomSpeakerId] = useState('admin');
  const [seatPersonaId, setSeatPersonaId] = useState('');
  const [liveBusy, setLiveBusy] = useState(false);

  const syncFromStore = useCallback(() => {
    const s = getStore();
    setConfig(normalizeAiConfig(s.aiConfig));
    setLobbyChat([...s.lobbyChat]);

    const roomList: AdminRoomSummary[] = listPublicRoomsFromStore().map((summary) => ({
      ...summary,
      aiSeats: [...(s.rooms[summary.roomId]?.aiSeats || [])],
    }));
    setRooms(roomList);
    setSelectedRoomId((prev) => {
      const nextId =
        prev && roomList.some((r) => r.roomId === prev) ? prev : roomList[0]?.roomId || '';
      setRoomChat(nextId ? [...(s.roomChats[nextId] || [])] : []);
      return nextId;
    });
  }, []);

  useEffect(() => {
    syncFromStore();
    return subscribeStore(syncFromStore);
  }, [syncFromStore]);

  useEffect(() => {
    const s = getStore();
    setRoomChat(selectedRoomId ? [...(s.roomChats[selectedRoomId] || [])] : []);
  }, [selectedRoomId]);

  const persistAiConfig = async (nextRaw: AiGovernanceConfig, auditDetail: string) => {
    if (!firebaseUser) return;
    setSaving(true);
    setStatusMsg(null);
    const normalized = normalizeAiConfig(nextRaw);

    try {
      const s = getStore();
      s.aiConfig = normalized;
      notifyStore();

      await writeAdminLog({
        adminUid: firebaseUser.uid,
        adminEmail: firebaseUser.email || 'admin',
        action: 'UPDATE_AI_CHAT_GOVERNANCE',
        targetType: 'ai_settings',
        targetId: 'global',
        details: auditDetail,
      });

      setConfig(normalized);
      setStatusMsg({
        type: 'success',
        text: 'Online contenders, presence status & live chat settings saved and synced.',
      });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save contender & chat configuration.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    void persistAiConfig(
      config,
      `Updated AI governance (AI=${config.aiEnabled}, AutoFill=${config.autoFillMultiplayer}, Diff=${config.difficulty}, LiveChat=${config.liveUserChatEnabled})`
    );
  };

  const togglePersonaEnabled = (id: string) => {
    const target = config.roster.find((p) => p.id === id);
    const nextEnabled = !(target?.enabled ?? true);
    const nextRoster = config.roster.map((p) => (p.id === id ? { ...p, enabled: nextEnabled } : p));
    const nextCfg = {
      ...config,
      aiEnabled: nextEnabled ? true : config.aiEnabled,
      roster: nextRoster,
    };
    setConfig(nextCfg);
    void persistAiConfig(
      nextCfg,
      `Set ${target?.name || id} ${nextEnabled ? 'Online' : 'Offline'}`
    );
  };

  const setAllOnlineOffline = (online: boolean) => {
    const nextRoster = config.roster.map((p) => ({ ...p, enabled: online }));
    const nextCfg = {
      ...config,
      aiEnabled: online ? true : config.aiEnabled,
      roster: nextRoster,
    };
    setConfig(nextCfg);
    void persistAiConfig(
      nextCfg,
      `Set all ${nextRoster.length} contenders ${online ? 'Online' : 'Offline'}`
    );
  };

  const deletePersona = (id: string) => {
    if (config.roster.length <= 1) {
      setStatusMsg({ type: 'error', text: 'At least one contender must remain in the roster.' });
      return;
    }
    const target = config.roster.find((p) => p.id === id);
    const nextRoster = config.roster.filter((p) => p.id !== id);
    const nextCfg = { ...config, roster: nextRoster };
    setConfig(nextCfg);
    void persistAiConfig(nextCfg, `Removed contender ${target?.name || id} from roster`);
  };

  const handleAddPersona = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = newName.replace(/\s+/g, ' ').trim();
    if (cleanedName.length < 3) {
      setStatusMsg({ type: 'error', text: 'Enter a real full name (e.g. "Rebecca Namutebi").' });
      return;
    }
    if (config.roster.length >= 100) {
      setStatusMsg({ type: 'error', text: 'Maximum roster size of 100 contenders reached.' });
      return;
    }
    if (config.roster.some((p) => p.name.toLowerCase() === cleanedName.toLowerCase())) {
      setStatusMsg({ type: 'error', text: `${cleanedName} is already on the roster.` });
      return;
    }

    const slug = cleanedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32);
    const created: AiPersonaProfile = {
      id: `ai_custom_${slug}_${Date.now().toString(36)}`,
      name: cleanedName,
      gender: newGender,
      city: newCity.trim() || 'Kampala',
      style: newStyle,
      rating: 1900,
      enabled: true,
      isCustom: true,
    };
    const nextCfg = { ...config, roster: [created, ...config.roster] };
    setConfig(nextCfg);
    setNewName('');
    void persistAiConfig(
      nextCfg,
      `Added ${created.gender === 'female' ? 'Woman' : 'Man'} online player ${created.name} (${created.city})`
    );
  };

  const handleMergeDefault40 = () => {
    const existingIds = new Set(config.roster.map((p) => p.id));
    const existingNames = new Set(config.roster.map((p) => p.name.trim().toLowerCase()));
    const additions = DEFAULT_AI_ROSTER.filter(
      (p) => !existingIds.has(p.id) && !existingNames.has(p.name.trim().toLowerCase())
    );
    if (additions.length === 0) {
      setStatusMsg({
        type: 'success',
        text: `All ${DEFAULT_AI_ROSTER.length} default real-name contenders are already in your active roster.`,
      });
      return;
    }
    const nextCfg = {
      ...config,
      roster: [...config.roster, ...additions].slice(0, 100),
    };
    setConfig(nextCfg);
    void persistAiConfig(
      nextCfg,
      `Merged ${additions.length} default real-name contenders into online roster (${nextCfg.roster.length} total)`
    );
  };

  const handleSendLobbyMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = lobbyDraft.replace(/\s+/g, ' ').trim();
    if (!text) return;
    setLiveBusy(true);
    try {
      const s = getStore();
      const persona =
        lobbySpeakerId === 'admin'
          ? null
          : config.roster.find((p) => p.id === lobbySpeakerId) || null;
      const msg: RoomChatMessage = {
        id: `lchat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        roomId: 'lobby',
        uid: persona ? persona.id : firebaseUser?.uid || 'admin',
        senderName: persona ? persona.name : 'Casino Royale Host',
        text,
        createdAtMs: Date.now(),
        isFreeText: true,
        isAdmin: !persona,
        isAi: Boolean(persona),
        senderGender: persona?.gender,
      };
      s.lobbyChat = [...s.lobbyChat, msg].slice(-80);
      notifyStore();
      setLobbyDraft('');
    } finally {
      setLiveBusy(false);
    }
  };

  const handleSeatAiInRoom = async () => {
    if (!selectedRoomId) return;
    setLiveBusy(true);
    setStatusMsg(null);
    try {
      const s = getStore();
      const room = s.rooms[selectedRoomId];
      if (!room) throw new Error('Room is no longer active.');
      const totalSeated = room.playerUids.length + room.aiSeats.length;
      if (totalSeated >= room.maxPlayers) {
        throw new Error('This table is already full.');
      }
      const enabledRoster = config.roster.filter((p) => p.enabled);
      const alreadySeatedIds = new Set(room.aiSeats.map((a) => a.uid));
      const candidate = seatPersonaId
        ? enabledRoster.find((p) => p.id === seatPersonaId)
        : enabledRoster.find((p) => !alreadySeatedIds.has(p.id)) || enabledRoster[0];

      if (!candidate) throw new Error('No online contender available to seat.');
      if (alreadySeatedIds.has(candidate.id)) {
        throw new Error(`${candidate.name} is already seated at this table.`);
      }

      room.aiSeats = [
        ...room.aiSeats,
        { uid: candidate.id, displayName: candidate.name, gender: candidate.gender },
      ];
      room.updatedAt = Date.now();
      notifyStore();
      setStatusMsg({ type: 'success', text: `${candidate.name} seated at the live table.` });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not seat AI player in room.',
      });
    } finally {
      setLiveBusy(false);
    }
  };

  const handleRemoveAiFromRoom = async (botUid: string) => {
    if (!selectedRoomId) return;
    setLiveBusy(true);
    try {
      const s = getStore();
      const room = s.rooms[selectedRoomId];
      if (room) {
        room.aiSeats = room.aiSeats.filter((a) => a.uid !== botUid);
        room.updatedAt = Date.now();
        notifyStore();
      }
    } finally {
      setLiveBusy(false);
    }
  };

  const handleSendRoomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;
    const text = roomDraft.replace(/\s+/g, ' ').trim();
    if (!text) return;
    setLiveBusy(true);
    try {
      const s = getStore();
      const persona =
        roomSpeakerId === 'admin'
          ? null
          : config.roster.find((p) => p.id === roomSpeakerId) || null;
      const msg: RoomChatMessage = {
        id: `rchat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        roomId: selectedRoomId,
        uid: persona ? persona.id : firebaseUser?.uid || 'admin',
        senderName: persona ? persona.name : 'Casino Royale Host',
        text,
        createdAtMs: Date.now(),
        isFreeText: true,
        isAdmin: !persona,
        isAi: Boolean(persona),
        senderGender: persona?.gender,
      };
      s.roomChats[selectedRoomId] = [...(s.roomChats[selectedRoomId] || []), msg].slice(-80);
      notifyStore();
      setRoomDraft('');
    } finally {
      setLiveBusy(false);
    }
  };

  const handleClearRoomChat = async () => {
    if (!selectedRoomId) return;
    setLiveBusy(true);
    try {
      const s = getStore();
      s.roomChats[selectedRoomId] = [];
      notifyStore();
      setRoomChat([]);
    } finally {
      setLiveBusy(false);
    }
  };

  const enabledWomen = useMemo(
    () => config.roster.filter((p) => p.enabled && p.gender === 'female'),
    [config.roster]
  );
  const enabledMen = useMemo(
    () => config.roster.filter((p) => p.enabled && p.gender === 'male'),
    [config.roster]
  );
  const onlineCount = useMemo(
    () => (config.aiEnabled ? config.roster.filter((p) => p.enabled).length : 0),
    [config.aiEnabled, config.roster]
  );
  const offlineCount = useMemo(
    () => config.roster.length - onlineCount,
    [config.roster.length, onlineCount]
  );
  const filteredRoster = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return config.roster.filter((p) => {
      const isOnline = config.aiEnabled && p.enabled;
      if (genderFilter === 'female' && p.gender !== 'female') return false;
      if (genderFilter === 'male' && p.gender !== 'male') return false;
      if (genderFilter === 'online' && !isOnline) return false;
      if (genderFilter === 'offline' && isOnline) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        contenderPlayerId(p.id).toLowerCase().includes(q)
      );
    });
  }, [config.aiEnabled, config.roster, genderFilter, rosterSearch]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.roomId === selectedRoomId) || null,
    [rooms, selectedRoomId]
  );

  return (
    <AdminLayout title="Online Players & Live Chat Control">
      <div className="space-y-6">
        {statusMsg && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs font-medium ${
              statusMsg.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-950/60 text-emerald-200'
                : 'border-rose-400/40 bg-rose-950/60 text-rose-200'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* Summary Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-4">
            <p className="text-xs text-neutral-400">Online Roster Status</p>
            <p className="text-lg font-bold text-white mt-1">
              {config.aiEnabled
                ? `${enabledWomen.length + enabledMen.length} Online & Invitable`
                : 'Paused by Admin'}
            </p>
          </div>
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-4">
            <p className="text-xs text-neutral-400">Active Women / Men</p>
            <p className="text-lg font-bold font-mono-tabular text-[#FFD76A] mt-1">
              {enabledWomen.length} Women · {enabledMen.length} Men
            </p>
          </div>
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-4">
            <p className="text-xs text-neutral-400">Auto-Join Open Tables</p>
            <p className="text-lg font-bold text-white mt-1">
              {config.autoFillMultiplayer ? `After ${config.autoFillDelaySeconds}s` : 'Manual Only'}
            </p>
          </div>
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-4">
            <p className="text-xs text-neutral-400">Live User &amp; AI Chat</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">
              {config.liveUserChatEnabled ? 'Live & Open' : 'Locked'}
            </p>
          </div>
        </div>

        {/* Section 1: Global AI & Chat Governance */}
        <form
          onSubmit={handleSaveSettings}
          className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#FFD76A]" />
                <span>Online Matchmaking &amp; Chat Rules</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Manage real-named Women &amp; Men online players shown to users in the Friends Hub, Lobby invitations, and live game tables. Players never see AI or computer labels.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Syncing…' : 'Save & Sync Rules'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 text-xs">
              {[
                {
                  key: 'aiEnabled',
                  label: 'Enable AI Contenders Across Arena',
                  desc: 'Allow AI players to join tables and play Matatu, Ludo, Chess, and Drafts with users.',
                },
                {
                  key: 'autoFillMultiplayer',
                  label: 'Auto-Join Open Multiplayer Tables',
                  desc: 'Automatically seat Women & Men AI contenders if no human fills an empty seat in time.',
                },
                {
                  key: 'liveUserChatEnabled',
                  label: 'Enable Live User Chat (Lobby & Tables)',
                  desc: 'Allow all joined players to send free-text live messages to each other.',
                },
                {
                  key: 'aiChatEnabled',
                  label: 'Enable Natural AI Chat Replies',
                  desc: 'AI contenders reply conversationally to joined users and react to live moves.',
                },
                {
                  key: 'aiGreetOnJoin',
                  label: 'Welcome Newly Joined Users Automatically',
                  desc: 'Whenever a user joins the Lobby or a Game Table, an AI contender greets them by name.',
                },
              ].map((item) => {
                const checked = Boolean(config[item.key as keyof AiGovernanceConfig]);
                return (
                  <label
                    key={item.key}
                    className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-[#04120B] p-3.5 cursor-pointer hover:border-[#D4AF37]/35"
                  >
                    <div>
                      <p className="font-semibold text-white">{item.label}</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, [item.key]: e.target.checked }))
                      }
                      className="mt-0.5 h-4 w-4 accent-[#D4AF37] shrink-0"
                    />
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start text-xs">
              <div>
                <label className="block font-medium text-neutral-300 mb-1">AI Skill Level</label>
                <select
                  value={config.difficulty}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      difficulty: e.target.value as AiDifficulty,
                    }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3 py-2.5 text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value="casual">Casual (Friendly)</option>
                  <option value="balanced">Balanced (Competitive)</option>
                  <option value="pro">Pro Grandmaster</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-neutral-300 mb-1">AI Chat Liveliness</label>
                <select
                  value={config.aiChatFrequency}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      aiChatFrequency: e.target.value as AiChatFrequency,
                    }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3 py-2.5 text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value="low">Low (Occasional)</option>
                  <option value="normal">Normal</option>
                  <option value="lively">Lively (Social Lounge)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-neutral-300 mb-1">
                  Auto-Join Wait Delay (seconds)
                </label>
                <input
                  type="number"
                  min={3}
                  max={45}
                  value={config.autoFillDelaySeconds}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      autoFillDelaySeconds: Math.min(45, Math.max(3, Number(e.target.value) || 6)),
                    }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3 py-2.5 font-mono-tabular text-white focus:border-[#FFD76A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-300 mb-1">
                  Max AI Seats Per Room
                </label>
                <select
                  value={config.maxAiPerRoom}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, maxAiPerRoom: Number(e.target.value) }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3 py-2.5 font-mono-tabular text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value={1}>1 AI Contender</option>
                  <option value={2}>Up to 2 AI Contenders</option>
                  <option value={3}>Up to 3 AI Contenders</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-neutral-300 mb-1">
                  AI Thinking Delay:{' '}
                  <span className="font-mono-tabular text-[#FFD76A]">{config.moveDelayMs} ms</span>
                </label>
                <input
                  type="range"
                  min={400}
                  max={3000}
                  step={100}
                  value={config.moveDelayMs}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, moveDelayMs: Number(e.target.value) }))
                  }
                  className="w-full accent-[#D4AF37]"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Section 2: Women & Men Real-Name Online Roster */}
        <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-[#FFD76A]" />
                <span>Online Contenders Roster ({config.roster.length})</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Real Ugandan &amp; East African player names shown online across Friends Hub, Direct Chat, and Table Invites (no AI/Computer tags shown to users).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Filter name or city…"
                  className="w-40 rounded-lg border border-white/15 bg-[#04120B] pl-8 pr-2.5 py-1.5 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setAllOnlineOffline(true)}
                className="rounded-lg border border-emerald-400/45 bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                Put All Online
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setAllOnlineOffline(false)}
                className="rounded-lg border border-rose-400/40 bg-rose-950/50 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/50 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                Put All Offline
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleMergeDefault40}
                className="rounded-lg border border-[#D4AF37]/45 bg-[#063B24] px-3 py-1.5 text-xs font-semibold text-[#FFD76A] hover:bg-[#095333] cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                Add Default 40 Players
              </button>
              {[
                { id: 'all', label: `All (${config.roster.length})` },
                { id: 'online', label: `Online (${onlineCount})` },
                { id: 'offline', label: `Offline (${offlineCount})` },
                {
                  id: 'female',
                  label: `Women (${config.roster.filter((p) => p.gender === 'female').length})`,
                },
                {
                  id: 'male',
                  label: `Men (${config.roster.filter((p) => p.gender === 'male').length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setGenderFilter(tab.id as 'all' | AiGender | 'online' | 'offline')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                    genderFilter === tab.id
                      ? 'bg-[#D4AF37] text-[#021D12]'
                      : 'border border-white/15 bg-[#04120B] text-neutral-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add New Woman or Man Contender */}
          <form
            onSubmit={handleAddPersona}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 rounded-xl border border-white/10 bg-[#04120B] p-4 text-xs"
          >
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-neutral-400 mb-1">Full Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Rebecca Namutebi"
                className="w-full rounded-lg border border-white/15 bg-[#020B06] px-3 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Gender</label>
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as AiGender)}
                className="w-full rounded-lg border border-white/15 bg-[#020B06] px-3 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
              >
                <option value="female">Woman</option>
                <option value="male">Man</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">City</label>
              <input
                type="text"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#020B06] px-3 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Personality</label>
              <select
                value={newStyle}
                onChange={(e) => setNewStyle(e.target.value as AiPlayStyle)}
                className="w-full rounded-lg border border-white/15 bg-[#020B06] px-3 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
              >
                <option value="friendly">Friendly</option>
                <option value="tactical">Tactical</option>
                <option value="bold">Competitive</option>
                <option value="calm">Calm</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="gold-shimmer-btn w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Player</span>
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRoster.map((persona) => {
              const isLiveOnline = config.aiEnabled && persona.enabled;
              return (
                <div
                  key={persona.id}
                  className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 transition-colors ${
                    isLiveOnline
                      ? 'border-[#D4AF37]/30 bg-[#04140C]'
                      : 'border-white/10 bg-[#020A06] opacity-70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          isLiveOnline
                            ? persona.gender === 'female'
                              ? 'bg-amber-300'
                              : 'bg-[#9CE800]'
                            : 'bg-neutral-600'
                        }`}
                      />
                      <p className="text-sm font-semibold text-white truncate">{persona.name}</p>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 capitalize">
                      <span className="font-mono-tabular text-neutral-300">
                        {contenderPlayerId(persona.id)}
                      </span>{' '}
                      · {persona.gender === 'female' ? 'Woman' : 'Man'} · {persona.city} ·{' '}
                      {persona.style}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => togglePersonaEnabled(persona.id)}
                      title={isLiveOnline ? 'Click to put Offline' : 'Click to put Online'}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                        isLiveOnline
                          ? 'border border-emerald-400/40 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
                          : 'border border-white/15 bg-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {isLiveOnline ? 'Online' : 'Offline'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => deletePersona(persona.id)}
                      title={`Remove ${persona.name}`}
                      className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-1.5 text-rose-300 hover:bg-rose-900/50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 3: Live Lobby & Table Chat Moderation + AI Seating */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lobby Live Chat Broadcast */}
          <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#FFD76A]" />
                  <span>Live Arena Lounge Chat</span>
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Monitor joined players chatting in the lobby or speak as Host / any AI contender.
                </p>
              </div>
              <button
                type="button"
                onClick={syncFromStore}
                className="inline-flex items-center gap-1 text-xs text-[#FFD76A] hover:text-white cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#041009] p-3 space-y-2">
              {lobbyChat.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-10">
                  No lobby messages recorded yet.
                </p>
              ) : (
                lobbyChat.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-2 text-xs ${
                      m.isSystem
                        ? 'text-center text-neutral-400 italic'
                        : m.isAdmin
                        ? 'border border-[#9CE800]/35 bg-[#092C19] text-white'
                        : 'border border-white/10 bg-white/5 text-neutral-200'
                    }`}
                  >
                    {!m.isSystem && (
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-[11px] text-[#FFD76A] inline-flex items-center gap-1">
                          {m.isAdmin && <ShieldCheck className="h-3 w-3 text-[#9CE800]" />}
                          <span>{m.senderName}</span>
                          {m.isAi && <span className="text-neutral-400 font-normal">(AI)</span>}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono-tabular">
                          {new Date(m.createdAtMs).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                    <p>{m.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendLobbyMessage} className="space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={lobbySpeakerId}
                  onChange={(e) => setLobbySpeakerId(e.target.value)}
                  className="sm:w-52 rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value="admin">Speak as Casino Royale Host</option>
                  {config.roster
                    .filter((p) => p.enabled)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.gender === 'female' ? 'Woman' : 'Man'})
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  value={lobbyDraft}
                  onChange={(e) => setLobbyDraft(e.target.value)}
                  placeholder="Send live message to lobby lounge…"
                  className="flex-1 rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={liveBusy || !lobbyDraft.trim()}
                  className="gold-shimmer-btn inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 font-bold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </section>

          {/* Live Room AI Seating & Chat Control */}
          <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-[#FFD76A]" />
                  <span>Live Room AI Seating &amp; Moderation</span>
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Add or remove specific Women/Men AI contenders in an active room and manage its table chat.
                </p>
              </div>
              {selectedRoomId && (
                <button
                  type="button"
                  disabled={liveBusy}
                  onClick={() => void handleClearRoomChat()}
                  className="rounded-lg border border-rose-500/35 bg-rose-950/40 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Clear Chat
                </button>
              )}
            </div>

            {rooms.length === 0 ? (
              <p className="text-xs text-neutral-400 py-10 text-center">
                No active game rooms running right now. When a player opens a table, you can seat AI players or chat directly from here.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Active Table</label>
                    <select
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
                    >
                      {rooms.map((r) => (
                        <option key={r.roomId} value={r.roomId}>
                          {r.name} ({r.roomCode}) · {r.playerCount}/{r.maxPlayers}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Seat Specific AI Player
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={seatPersonaId}
                        onChange={(e) => setSeatPersonaId(e.target.value)}
                        className="flex-1 min-w-0 rounded-xl border border-white/15 bg-[#04120B] px-2.5 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
                      >
                        <option value="">Balanced Auto-Pick</option>
                        {config.roster
                          .filter((p) => p.enabled)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.gender === 'female' ? 'Woman' : 'Man'})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={liveBusy || !selectedRoom}
                        onClick={() => void handleSeatAiInRoom()}
                        className="rounded-xl border border-[#D4AF37]/50 bg-[#063B24] px-3 py-2 font-semibold text-[#FFD76A] hover:bg-[#095333] cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45"
                      >
                        Seat AI
                      </button>
                    </div>
                  </div>
                </div>

                {selectedRoom?.aiSeats && selectedRoom.aiSeats.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {selectedRoom.aiSeats.map((seat) => (
                      <span
                        key={seat.uid}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#04120B] px-2.5 py-1 text-neutral-200"
                      >
                        <span>{seat.displayName}</span>
                        <button
                          type="button"
                          onClick={() => void handleRemoveAiFromRoom(seat.uid)}
                          className="text-rose-400 hover:text-rose-200 cursor-pointer"
                          title={`Remove ${seat.displayName}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="h-44 overflow-y-auto rounded-xl border border-white/10 bg-[#041009] p-3 space-y-2">
                  {roomChat.length === 0 ? (
                    <p className="text-xs text-neutral-500 text-center py-8">
                      No messages in this room yet.
                    </p>
                  ) : (
                    roomChat.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs"
                      >
                        <span className="font-semibold text-[#FFD76A] mr-2">
                          {m.senderName}
                          {m.isAi ? ' (AI)' : ''}:
                        </span>
                        <span className="text-neutral-200">{m.text}</span>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendRoomMessage} className="flex flex-col sm:flex-row gap-2 text-xs">
                  <select
                    value={roomSpeakerId}
                    onChange={(e) => setRoomSpeakerId(e.target.value)}
                    className="sm:w-48 rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
                  >
                    <option value="admin">Casino Royale Host</option>
                    {config.roster
                      .filter((p) => p.enabled)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    value={roomDraft}
                    onChange={(e) => setRoomDraft(e.target.value)}
                    placeholder="Send message to selected table…"
                    className="flex-1 rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-white focus:border-[#FFD76A] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={liveBusy || !roomDraft.trim()}
                    className="gold-shimmer-btn inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 font-bold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
};
