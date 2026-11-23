import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DoorOpen,
  Download,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { fetchApiJson, getApiAuthToken } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import {
  getStore,
  hydrateAdminFromServer,
  listPublicRoomsFromStore,
  notifyStore,
  subscribeStore,
  type LocalRoomConfig,
  type ServerAdminOverview,
} from '../../lib/localStore';
import {
  adminSettleWithdrawal,
  calculateWithdrawalBreakdown,
  extractWalletErrorMessage,
  WITHDRAWAL_FEE_RATE,
} from '../../lib/walletService';
import { AdminLayout } from '../components/AdminLayout';
import { timestampMs } from '../../utils/validation';
import { writeAdminLog } from './AdminHelpers';
import type {
  AdminLogRecord,
  AdministratorRecord,
  PublicRoomSummary,
  SupportTicketRecord,
  TransactionRecord,
  TransactionStatus,
  UserRecord,
  WalletRecord,
} from '../../shared/types';

export const AdminGamesPage: React.FC = () => {
  const { systemSettings, firebaseUser } = useAuth();
  const [rules, setRules] = useState(systemSettings.matatuRules);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setRules(systemSettings.matatuRules);
  }, [systemSettings.matatuRules]);

  const handleSave = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    setMsg('');
    try {
      if (getApiAuthToken()) {
        const res = await fetchApiJson<{ systemSettings: typeof systemSettings }>(
          '/api/admin/settings',
          {
            method: 'POST',
            body: JSON.stringify({ matatuRules: { ...rules } }),
          }
        );
        const s = getStore();
        if (res.systemSettings) {
          s.systemSettings = res.systemSettings;
        }
        notifyStore();
        setMsg('Active Matatu engine rules saved to database.');
        return;
      }
      const s = getStore();
      s.systemSettings = {
        ...s.systemSettings,
        matatuRules: { ...rules },
        updatedBy: firebaseUser.uid,
        updatedAt: Date.now(),
      };
      notifyStore();
      await writeAdminLog({
        adminUid: firebaseUser.uid,
        adminEmail: firebaseUser.email || 'admin',
        action: 'UPDATE_MATATU_RULES',
        targetType: 'system_settings',
        targetId: 'global',
        details: 'Updated active Matatu engine rules',
      });
      setMsg('Active Matatu engine rules updated.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Unable to save rules.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Matatu Engine & Rules">
      <div className="max-w-2xl emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-5">
        <h2 className="font-display text-xl font-bold text-white">Authoritative Matatu Ruleset</h2>
        {msg && <p className="text-xs text-[#FFD76A]">{msg}</p>}
        <div className="space-y-3 text-sm">
          {[
            { key: 'sevenOfDiamondsCutter', label: '7 of Diamonds cuts pending Draw +2' },
            { key: 'allowStackingTwos', label: 'Allow stacking 2s (+2 -> +4)' },
            { key: 'aceWildOnAnyCard', label: 'Ace acts as Wild Suit Selector' },
            { key: 'jackSkipsTurn', label: 'Jack skips next player' },
            { key: 'eightPlaysAgain', label: 'Eight grants immediate extra turn' },
            { key: 'kingReversesDirection', label: 'King reverses play direction' },
          ].map((opt) => (
            <label
              key={opt.key}
              className="flex items-center justify-between gap-4 py-1.5 border-b border-white/10"
            >
              <span className="text-neutral-200">{opt.label}</span>
              <input
                type="checkbox"
                checked={Boolean(rules[opt.key as keyof typeof rules])}
                onChange={(e) =>
                  setRules((prev) => ({ ...prev, [opt.key]: e.target.checked }))
                }
                className="h-4 w-4 accent-[#D4AF37]"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving…' : 'Save Rules'}</span>
        </button>
      </div>
    </AdminLayout>
  );
};

export const AdminRoomsPage: React.FC = () => {
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  const [rawRooms, setRawRooms] = useState<LocalRoomConfig[]>([]);
  const [usersByUid, setUsersByUid] = useState<Record<string, UserRecord>>({});

  const sync = () => {
    const s = getStore();
    setRooms(listPublicRoomsFromStore());
    setRawRooms(Object.values(s.rooms));
    setUsersByUid({ ...s.users });
  };

  useEffect(() => {
    sync();
    return subscribeStore(sync);
  }, []);

  const rawById = useMemo(() => {
    const map: Record<string, LocalRoomConfig> = {};
    rawRooms.forEach((r) => {
      map[r.roomId] = r;
    });
    return map;
  }, [rawRooms]);

  const displayedRooms: PublicRoomSummary[] =
    rooms.length > 0
      ? rooms
      : rawRooms.map((fr) => ({
          roomId: fr.roomId,
          roomCode: fr.roomCode,
          name: fr.name,
          hostUid: fr.hostUid,
          hostName: fr.hostName,
          isPrivate: fr.isPrivate,
          gameType: fr.gameType,
          mode: fr.mode,
          maxPlayers: fr.maxPlayers,
          playerCount: fr.playerUids.length + fr.aiSeats.length,
          playerNames: [
            ...fr.playerUids.map((uid) => usersByUid[uid]?.fullName || (uid === fr.hostUid ? fr.hostName : uid)),
            ...fr.aiSeats.map((a) => a.displayName),
          ],
          entryFeeUgx: fr.entryFeeUgx,
          status: fr.status,
          createdAt: fr.createdAt,
        }));

  return (
    <AdminLayout title="Live Game Rooms">
      <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-[#FFD76A]" />
            <span>Active Tables &amp; Joined Players ({displayedRooms.length})</span>
          </h2>
          <button
            type="button"
            onClick={sync}
            className="inline-flex items-center gap-1.5 text-xs text-[#FFD76A] hover:text-white cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
        {displayedRooms.length === 0 ? (
          <p className="text-xs text-neutral-400">No active rooms right now.</p>
        ) : (
          <div className="divide-y divide-white/10">
            {displayedRooms.map((r) => {
              const raw = rawById[r.roomId];
              const resolvedNames =
                r.playerNames && r.playerNames.length > 0
                  ? r.playerNames
                  : [
                      ...(raw?.playerUids || []).map((uid) => usersByUid[uid]?.fullName || uid),
                      ...(raw?.aiSeats || []).map((a) => a.displayName),
                    ];
              return (
                <div
                  key={r.roomId}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {r.name}{' '}
                      <span className="font-mono-tabular text-[#FFD76A]">({r.roomCode})</span>
                    </p>
                    <p className="text-neutral-400 mt-0.5">
                      Host: {r.hostName} · {r.gameType || 'matatu'} · {r.playerCount}/{r.maxPlayers} seats
                    </p>
                    <p className="text-neutral-300 mt-1">
                      Joined: <span className="text-white">{resolvedNames.join(', ') || r.hostName}</span>
                    </p>
                  </div>
                  <span className="text-[#FFD76A] capitalize font-semibold shrink-0">{r.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

const ADMIN_TX_STATUS_FILTERS: Array<'All' | TransactionStatus> = [
  'All',
  'Pending',
  'Verified',
  'Paid',
  'Cancelled',
  'Rejected',
];

type AdminTxViewTab = 'all' | 'deposits' | 'withdrawals';

function formatTxTimestamp(ts: unknown): string {
  const ms = timestampMs(ts);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleString('en-UG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getStatusAccent(status: TransactionStatus): string {
  if (status === 'Verified' || status === 'Paid') return 'text-emerald-400';
  if (status === 'Pending') return 'text-[#FFD76A]';
  if (status === 'Rejected') return 'text-rose-400';
  return 'text-neutral-400';
}

export const AdminTransactionsPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const initialTab: AdminTxViewTab =
    initialTabParam === 'deposits' || initialTabParam === 'withdrawals' ? initialTabParam : 'all';

  const [viewTab, setViewTab] = useState<AdminTxViewTab>(initialTab);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [usersByUid, setUsersByUid] = useState<Record<string, UserRecord>>({});
  const [walletsByUid, setWalletsByUid] = useState<Record<string, WalletRecord>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'All' | TransactionStatus>('All');
  const [search, setSearch] = useState('');
  const [busyTxId, setBusyTxId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const feePctLabel = `${Math.round(WITHDRAWAL_FEE_RATE * 100)}%`;

  useEffect(() => {
    const param = searchParams.get('tab');
    if (param === 'deposits' || param === 'withdrawals' || param === 'all') {
      setViewTab(param);
    }
  }, [searchParams]);

  useEffect(() => {
    const sync = () => {
      const s = getStore();
      setTransactions(
        Object.values(s.transactions).sort(
          (a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt)
        )
      );
      setUsersByUid({ ...s.users });
      setWalletsByUid({ ...s.wallets });
      setLoading(false);
    };
    sync();
    if (getApiAuthToken()) {
      void fetchApiJson<{ overview: ServerAdminOverview }>('/api/admin/overview')
        .then((res) => {
          if (res.overview) hydrateAdminFromServer(res.overview);
        })
        .catch(() => {
          // Retain cached view
        });
    }
    return subscribeStore(sync);
  }, []);

  const depositsList = useMemo(
    () => transactions.filter((t) => t.type === 'Deposit'),
    [transactions]
  );
  const withdrawalsList = useMemo(
    () => transactions.filter((t) => t.type === 'Withdrawal'),
    [transactions]
  );

  const verifiedDeposits = depositsList.filter((t) => t.status === 'Verified');
  const totalDeposits = verifiedDeposits.reduce((sum, t) => sum + (Number(t.amountUgx) || 0), 0);
  const uniqueDepositorCount = new Set(verifiedDeposits.map((t) => t.uid)).size;

  const pendingWithdrawals = withdrawalsList.filter((t) => t.status === 'Pending');
  const pendingWithdrawalsTotal = pendingWithdrawals.reduce(
    (sum, t) => sum + (Number(t.amountUgx) || 0),
    0
  );

  const paidPayoutsTotal = withdrawalsList
    .filter((t) => t.status === 'Paid')
    .reduce((sum, t) => sum + (Number(t.amountUgx) || 0), 0);

  const totalWalletLiquidity = useMemo(
    () =>
      Object.values(walletsByUid).reduce(
        (sum, w) => sum + (Number(w.availableBalance) || 0),
        0
      ),
    [walletsByUid]
  );

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (viewTab === 'deposits' && tx.type !== 'Deposit') return false;
      if (viewTab === 'withdrawals' && tx.type !== 'Withdrawal') return false;
      if (statusFilter !== 'All' && tx.status !== statusFilter) return false;
      if (!q) return true;
      const user = usersByUid[tx.uid];
      return (
        tx.playerId.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q) ||
        (tx.phoneNumber || '').toLowerCase().includes(q) ||
        (user?.fullName || '').toLowerCase().includes(q) ||
        (user?.email || '').toLowerCase().includes(q)
      );
    });
  }, [transactions, viewTab, statusFilter, search, usersByUid]);

  const switchTab = (next: AdminTxViewTab) => {
    setViewTab(next);
    setStatusFilter('All');
    if (next === 'all') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', next);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleSettle = async (tx: TransactionRecord, decision: 'Paid' | 'Rejected') => {
    if (!firebaseUser || busyTxId) return;
    setBusyTxId(tx.txId);
    setFeedback(null);
    const playerName = usersByUid[tx.uid]?.fullName || tx.playerId;
    try {
      await adminSettleWithdrawal(tx, decision, firebaseUser.uid);
      await writeAdminLog({
        adminUid: firebaseUser.uid,
        adminEmail: firebaseUser.email || 'admin',
        action: decision === 'Paid' ? 'APPROVE_WITHDRAWAL' : 'REJECT_WITHDRAWAL',
        targetType: 'transaction',
        targetId: tx.txId,
        details: `${decision} withdrawal ${tx.reference} (UGX ${tx.amountUgx.toLocaleString()}) for ${playerName} (${tx.playerId})`,
      });
      setFeedback({
        type: 'success',
        text:
          decision === 'Paid'
            ? `Withdrawal ${tx.reference} for ${playerName} marked as Paid.`
            : `Withdrawal ${tx.reference} for ${playerName} rejected and UGX ${tx.amountUgx.toLocaleString()} refunded to available balance.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractWalletErrorMessage(err, 'Unable to settle withdrawal request.'),
      });
    } finally {
      setBusyTxId('');
    }
  };

  const handleExportCsv = () => {
    const header = [
      'Date',
      'Player Name',
      'Player ID',
      'Email',
      'Phone',
      'Type',
      'Provider',
      'Reference',
      'Amount UGX',
      `Fee UGX (${feePctLabel})`,
      'Net Payout UGX',
      'Status',
    ];
    const rows = filteredTransactions.map((tx) => {
      const user = usersByUid[tx.uid];
      const wdBreakdown =
        tx.type === 'Withdrawal'
          ? {
              feeUgx: tx.feeUgx ?? calculateWithdrawalBreakdown(tx.amountUgx).feeUgx,
              netPayoutUgx: tx.netPayoutUgx ?? calculateWithdrawalBreakdown(tx.amountUgx).netPayoutUgx,
            }
          : null;
      return [
        formatTxTimestamp(tx.createdAt),
        user?.fullName || '',
        tx.playerId,
        user?.email || '',
        tx.phoneNumber || user?.phone || '',
        tx.type,
        tx.provider,
        tx.reference,
        String(tx.amountUgx),
        wdBreakdown ? String(wdBreakdown.feeUgx) : '0',
        wdBreakdown ? String(wdBreakdown.netPayoutUgx) : String(tx.amountUgx),
        tx.status,
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',');
    });
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `casino-royale-admin-${viewTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Deposits & Withdrawal Requests">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">
                Total Deposited ({uniqueDepositorCount} player{uniqueDepositorCount === 1 ? '' : 's'})
              </p>
              <p className="text-2xl font-bold font-mono-tabular text-emerald-400 mt-1">
                UGX {totalDeposits.toLocaleString()}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full border border-emerald-400/35 bg-[#031B10] flex items-center justify-center shrink-0">
              <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
            </div>
          </div>

          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">
                Pending Withdrawals ({pendingWithdrawals.length})
              </p>
              <p className="text-2xl font-bold font-mono-tabular text-[#FFD76A] mt-1">
                UGX {pendingWithdrawalsTotal.toLocaleString()}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full border border-[#D4AF37]/40 bg-[#031B10] flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-[#FFD76A]" />
            </div>
          </div>

          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">Paid Out</p>
              <p className="text-2xl font-bold font-mono-tabular text-white mt-1">
                UGX {paidPayoutsTotal.toLocaleString()}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full border border-white/15 bg-[#031B10] flex items-center justify-center shrink-0">
              <ArrowUpRight className="h-4 w-4 text-[#FFD76A]" />
            </div>
          </div>

          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">Player Wallet Balances</p>
              <p className="text-2xl font-bold font-mono-tabular text-white mt-1">
                UGX {totalWalletLiquidity.toLocaleString()}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full border border-white/15 bg-[#031B10] flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-[#FFD76A]" />
            </div>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs font-medium ${
              feedback.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-950/60 text-emerald-200'
                : 'border-rose-400/40 bg-rose-950/60 text-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'all', label: `All Activity (${transactions.length})` },
                  { key: 'deposits', label: `Who Deposited (${depositsList.length})` },
                  {
                    key: 'withdrawals',
                    label: `Withdrawal Requests (${withdrawalsList.length}${
                      pendingWithdrawals.length > 0 ? ` · ${pendingWithdrawals.length} Pending` : ''
                    })`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => switchTab(tab.key as AdminTxViewTab)}
                    className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      viewTab === tab.key
                        ? 'bg-[#D4AF37] text-[#021D12]'
                        : 'border border-white/15 bg-[#03130B] text-neutral-300 hover:border-[#D4AF37]/40 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search player, phone, ref..."
                    className="w-full rounded-lg border border-white/15 bg-[#03130B] pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                  />
                </div>
                <Link
                  to="/admin/cpanel"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#052315] px-3 py-1.5 text-xs font-semibold text-[#FFD76A] hover:border-[#FFD76A]"
                >
                  <Server className="h-3.5 w-3.5" />
                  <span>Spaceship cPanel DB</span>
                </Link>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={filteredTransactions.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#03130B] px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-[#D4AF37]/40 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-neutral-400 mr-1">Status:</span>
              {ADMIN_TX_STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    statusFilter === status
                      ? 'bg-[#063B24] border border-[#FFD76A]/60 text-[#FFD76A]'
                      : 'border border-white/10 bg-[#03130B]/60 text-neutral-400 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              Loading transaction ledger…
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              No records found matching the selected view and filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-[#02140C]/80 text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Player</th>
                    <th className="px-4 py-3 font-semibold">Type &amp; Channel</th>
                    <th className="px-4 py-3 font-semibold">Mobile &amp; Ref</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                    <th className="px-4 py-3 font-semibold text-right">Current Wallet</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredTransactions.map((tx) => {
                    const user = usersByUid[tx.uid];
                    const wallet = walletsByUid[tx.uid];
                    const isDeposit = tx.type === 'Deposit' || tx.type === 'Match Win';
                    const isWithdrawal = tx.type === 'Withdrawal';
                    const wdBreakdown = isWithdrawal
                      ? {
                          feeUgx: tx.feeUgx ?? calculateWithdrawalBreakdown(tx.amountUgx).feeUgx,
                          netPayoutUgx:
                            tx.netPayoutUgx ?? calculateWithdrawalBreakdown(tx.amountUgx).netPayoutUgx,
                        }
                      : null;
                    const isPendingWithdrawal = isWithdrawal && tx.status === 'Pending';
                    const isBusy = busyTxId === tx.txId;
                    return (
                      <tr key={tx.txId} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 text-neutral-300 font-mono-tabular whitespace-nowrap">
                          {formatTxTimestamp(tx.createdAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-white">
                            {user?.fullName || tx.playerId}
                          </p>
                          <p className="text-[11px] text-[#FFD76A] font-mono-tabular">
                            {tx.playerId}
                            {user?.email ? ` · ${user.email}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 font-semibold text-white">
                            {isDeposit ? (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-[#FFD76A] shrink-0" />
                            )}
                            <span>{tx.type}</span>
                          </div>
                          <p className="text-[11px] text-neutral-400">{tx.provider}</p>
                        </td>
                        <td className="px-4 py-3.5 font-mono-tabular whitespace-nowrap">
                          <p className="text-white">{tx.phoneNumber || user?.phone || '—'}</p>
                          <p className="text-[11px] text-neutral-400">{tx.reference}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono-tabular whitespace-nowrap">
                          <p className="font-bold text-white">
                            {isDeposit ? '+' : '-'}UGX {tx.amountUgx.toLocaleString()}
                          </p>
                          {wdBreakdown && (
                            <p className="text-[11px] text-emerald-300">
                              Fee {feePctLabel}: -{wdBreakdown.feeUgx.toLocaleString()} · Net:{' '}
                              {wdBreakdown.netPayoutUgx.toLocaleString()}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono-tabular whitespace-nowrap">
                          <p className="text-neutral-200">
                            UGX {(wallet?.availableBalance ?? tx.balanceAfter ?? 0).toLocaleString()}
                          </p>
                          {(wallet?.pendingBalance ?? 0) > 0 && (
                            <p className="text-[11px] text-[#FFD76A]">
                              Pending: UGX {wallet.pendingBalance.toLocaleString()}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`font-semibold ${getStatusAccent(tx.status)}`}>
                            {tx.status}
                          </span>
                          {tx.note && (
                            <p
                              className="text-[11px] text-neutral-400 max-w-[190px] truncate"
                              title={tx.note}
                            >
                              {tx.note}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {isPendingWithdrawal ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleSettle(tx, 'Paid')}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/45 bg-emerald-950/60 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/70 disabled:opacity-50 cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{isBusy ? 'Processing…' : 'Mark Paid'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleSettle(tx, 'Rejected')}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/45 bg-rose-950/60 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/70 disabled:opacity-50 cursor-pointer"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span>Reject &amp; Refund</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export const AdminReportsPage: React.FC = () => {
  const [logs, setLogs] = useState<AdminLogRecord[]>([]);

  useEffect(() => {
    const sync = () => {
      setLogs([...getStore().adminLogs]);
    };
    sync();
    if (getApiAuthToken()) {
      void fetchApiJson<{ overview: ServerAdminOverview }>('/api/admin/overview')
        .then((res) => {
          if (res.overview) hydrateAdminFromServer(res.overview);
        })
        .catch(() => {
          // Retain cached logs
        });
    }
    return subscribeStore(sync);
  }, []);

  return (
    <AdminLayout title="Reports & Audit Trail">
      <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="font-display text-lg font-bold text-white">Administrative Audit Logs</h2>
        </div>
        <div className="divide-y divide-white/10">
          {logs.length === 0 ? (
            <p className="p-6 text-xs text-neutral-400">No administrative actions logged yet.</p>
          ) : (
            logs.map((l) => (
              <div
                key={l.logId}
                className="px-5 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-[#FFD76A] mr-2">{l.action}</span>
                  <span className="text-white">{l.details}</span>
                </div>
                <span className="text-neutral-400 font-mono-tabular">{l.adminEmail}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export const AdminSupportPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});

  useEffect(() => {
    const sync = () => {
      setTickets(Object.values(getStore().supportTickets));
    };
    sync();
    return subscribeStore(sync);
  }, []);

  const handleResolve = async (t: SupportTicketRecord) => {
    if (!firebaseUser) return;
    const reply = (replies[t.ticketId] || 'Resolved by Kampala Support Operations.').slice(
      0,
      1000
    );
    if (getApiAuthToken()) {
      await fetchApiJson(`/api/admin/support/${encodeURIComponent(t.ticketId)}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ reply }),
      });
      const overviewRes = await fetchApiJson<{ overview: ServerAdminOverview }>(
        '/api/admin/overview'
      );
      if (overviewRes.overview) hydrateAdminFromServer(overviewRes.overview);
      return;
    }
    const s = getStore();
    if (s.supportTickets[t.ticketId]) {
      s.supportTickets[t.ticketId] = {
        ...s.supportTickets[t.ticketId],
        status: 'Resolved',
        adminReply: reply,
        reviewedBy: firebaseUser.uid,
        updatedAt: Date.now(),
      };
      notifyStore();
    }
    await writeAdminLog({
      adminUid: firebaseUser.uid,
      adminEmail: firebaseUser.email || 'admin',
      action: 'RESOLVE_TICKET',
      targetType: 'support_ticket',
      targetId: t.ticketId,
      details: `Resolved ticket from ${t.playerName}`,
    });
  };

  return (
    <AdminLayout title="Support Inbox">
      <div className="space-y-4">
        {tickets.length === 0 ? (
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-8 text-xs text-neutral-400">
            No support tickets submitted.
          </div>
        ) : (
          tickets.map((t) => (
            <div
              key={t.ticketId}
              className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{t.subject}</h3>
                  <p className="text-xs text-neutral-400">
                    {t.playerName} ({t.playerId}) · {t.category}
                  </p>
                </div>
                <span className="text-xs font-bold text-[#FFD76A]">{t.status}</span>
              </div>
              <p className="text-xs text-neutral-200">{t.message}</p>
              {t.status !== 'Resolved' && (
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <input
                    type="text"
                    value={replies[t.ticketId] || ''}
                    onChange={(e) =>
                      setReplies((prev) => ({ ...prev, [t.ticketId]: e.target.value }))
                    }
                    placeholder="Write official reply..."
                    className="flex-1 rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void handleResolve(t)}
                    className="gold-shimmer-btn rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    Resolve Ticket
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
};

export const AdminAdministratorsPage: React.FC = () => {
  const [admins, setAdmins] = useState<AdministratorRecord[]>([]);

  useEffect(() => {
    const sync = () => {
      setAdmins(Object.values(getStore().administrators));
    };
    sync();
    return subscribeStore(sync);
  }, []);

  return (
    <AdminLayout title="Administrators">
      <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#FFD76A]" />
          <span>Authorised Governance Officers</span>
        </h2>
        <div className="divide-y divide-white/10">
          {admins.length === 0 ? (
            <p className="text-xs text-neutral-400 py-3">Bootstrapped Super Admin active.</p>
          ) : (
            admins.map((a) => (
              <div key={a.uid} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-white">{a.fullName}</p>
                  <p className="text-neutral-400">{a.email}</p>
                </div>
                <span className="text-[#FFD76A] font-semibold">
                  {a.role} · {a.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export const AdminSettingsPage: React.FC = () => {
  const { systemSettings, firebaseUser } = useAuth();
  const [brandName, setBrandName] = useState(systemSettings.brandName);
  const [contactPhone, setContactPhone] = useState(systemSettings.contactPhone);
  const [contactEmail, setContactEmail] = useState(systemSettings.contactEmail);
  const [maintenanceMode, setMaintenanceMode] = useState(systemSettings.maintenanceMode);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setBrandName(systemSettings.brandName);
    setContactPhone(systemSettings.contactPhone);
    setContactEmail(systemSettings.contactEmail);
    setMaintenanceMode(systemSettings.maintenanceMode);
  }, [systemSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    setMsg('');
    try {
      if (getApiAuthToken()) {
        const res = await fetchApiJson<{ systemSettings: typeof systemSettings }>(
          '/api/admin/settings',
          {
            method: 'POST',
            body: JSON.stringify({
              brandName: brandName.trim() || 'CASINO ROYALE',
              maintenanceMode,
              contactPhone: contactPhone.trim(),
              contactEmail: contactEmail.trim(),
            }),
          }
        );
        const s = getStore();
        if (res.systemSettings) s.systemSettings = res.systemSettings;
        notifyStore();
        setMsg('Website settings saved to database.');
        return;
      }
      const s = getStore();
      s.systemSettings = {
        ...s.systemSettings,
        brandName: brandName.trim() || 'CASINO ROYALE',
        maintenanceMode,
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        updatedBy: firebaseUser.uid,
        updatedAt: Date.now(),
      };
      notifyStore();
      await writeAdminLog({
        adminUid: firebaseUser.uid,
        adminEmail: firebaseUser.email || 'admin',
        action: 'UPDATE_WEBSITE_SETTINGS',
        targetType: 'system_settings',
        targetId: 'global',
        details: `Updated site settings (Brand=${s.systemSettings.brandName}, Maintenance=${maintenanceMode})`,
      });
      setMsg('Website settings saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Unable to update settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Website & Compliance Settings">
      <form
        onSubmit={handleSave}
        className="max-w-2xl emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-4"
      >
        <h2 className="font-display text-xl font-bold text-white">Platform Configuration</h2>
        {msg && <p className="text-xs text-[#FFD76A]">{msg}</p>}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1">Brand Name</label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-sm text-white"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Contact Phone</label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-sm text-white"
            />
          </div>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-neutral-200 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={maintenanceMode}
            onChange={(e) => setMaintenanceMode(e.target.checked)}
            className="h-4 w-4 accent-[#D4AF37]"
          />
          <span>Enable Scheduled Maintenance Banner</span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="gold-shimmer-btn rounded-full px-6 py-2.5 text-xs font-bold cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save Platform Settings'}
        </button>
      </form>
    </AdminLayout>
  );
};
