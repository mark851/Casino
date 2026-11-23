import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DoorOpen,
  Inbox,
  ShieldCheck,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { fetchApiJson, getApiAuthToken } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import {
  getStore,
  hydrateAdminFromServer,
  listPublicRoomsFromStore,
  subscribeStore,
  type ServerAdminOverview,
} from '../../lib/localStore';
import { ensureDailyTournamentsExist } from '../../lib/tournamentService';
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
  IdentityVerificationRecord,
  SupportTicketRecord,
  TournamentRecord,
  TransactionRecord,
  UserRecord,
} from '../../shared/types';

function formatShortDate(ts: unknown): string {
  const ms = timestampMs(ts);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleString('en-UG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminDashboardPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [kycs, setKycs] = useState<IdentityVerificationRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [liveRoomsCount, setLiveRoomsCount] = useState(0);
  const [consoleReady, setConsoleReady] = useState(false);
  const [busyTxId, setBusyTxId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const sync = () => {
      const s = getStore();
      setUsers(
        Object.values(s.users).sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))
      );
      setKycs(Object.values(s.kycRecords));
      setTickets(Object.values(s.supportTickets));
      setTournaments(Object.values(s.tournaments));
      setTransactions(
        Object.values(s.transactions).sort(
          (a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt)
        )
      );
      setLiveRoomsCount(listPublicRoomsFromStore().length);
    };

    sync();
    const unsub = subscribeStore(sync);

    if (getApiAuthToken()) {
      void fetchApiJson<{ overview: ServerAdminOverview }>('/api/admin/overview')
        .then((res) => {
          if (res.overview) hydrateAdminFromServer(res.overview);
        })
        .catch(() => {
          // Keep current state
        });
    }

    if (firebaseUser) {
      void ensureDailyTournamentsExist(firebaseUser.uid).then(() => {
        setConsoleReady(true);
      });
    } else {
      setConsoleReady(true);
    }

    return unsub;
  }, [firebaseUser]);

  const usersByUid = useMemo(() => {
    const map: Record<string, UserRecord> = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  const pendingKycs = kycs.filter((k) => k.verification_status === 'Pending Verification');
  const openTickets = tickets.filter((t) => t.status === 'Open' || t.status === 'In Review');
  const deposits = transactions.filter((t) => t.type === 'Deposit');
  const verifiedDepositTotal = deposits
    .filter((t) => t.status === 'Verified')
    .reduce((sum, t) => sum + (Number(t.amountUgx) || 0), 0);
  const withdrawals = transactions.filter((t) => t.type === 'Withdrawal');
  const pendingWithdrawals = withdrawals.filter((t) => t.status === 'Pending');
  const pendingWithdrawalTotal = pendingWithdrawals.reduce(
    (sum, t) => sum + (Number(t.amountUgx) || 0),
    0
  );
  const feePctLabel = `${Math.round(WITHDRAWAL_FEE_RATE * 100)}%`;

  const handleQuickSettle = async (tx: TransactionRecord, decision: 'Paid' | 'Rejected') => {
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
        details: `${decision} withdrawal ${tx.reference} (UGX ${tx.amountUgx.toLocaleString()}) for ${playerName}`,
      });
      setFeedback({
        type: 'success',
        text:
          decision === 'Paid'
            ? `Marked ${playerName}'s withdrawal (${tx.reference}) as Paid.`
            : `Rejected ${playerName}'s withdrawal (${tx.reference}) and refunded UGX ${tx.amountUgx.toLocaleString()}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractWalletErrorMessage(err, 'Unable to update withdrawal status.'),
      });
    } finally {
      setBusyTxId('');
    }
  };

  return (
    <AdminLayout title="Operations Overview">
      <div className="space-y-6">
        {consoleReady && (
          <div className="emerald-card-surface rounded-xl border border-emerald-500/35 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-emerald-300 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Operations console synced with server database.</span>
            </span>
            <Link
              to="/admin/cpanel"
              className="text-[#FFD76A] font-semibold hover:underline"
            >
              Open Spaceship cPanel &amp; All Databases →
            </Link>
          </div>
        )}

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

        {/* Top KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/admin/players"
            className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 hover:border-[#FFD76A]/70 transition-colors"
          >
            <Users className="h-5 w-5 text-[#FFD76A] mb-2" />
            <p className="font-mono-tabular text-2xl font-bold text-white">{users.length}</p>
            <p className="text-xs text-neutral-400">Players Joined</p>
          </Link>

          <Link
            to="/admin/transactions?tab=deposits"
            className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 hover:border-[#FFD76A]/70 transition-colors"
          >
            <ArrowDownLeft className="h-5 w-5 text-emerald-400 mb-2" />
            <p className="font-mono-tabular text-2xl font-bold text-emerald-400">
              UGX {verifiedDepositTotal.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400">Total Deposited ({deposits.length})</p>
          </Link>

          <Link
            to="/admin/transactions?tab=withdrawals"
            className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 hover:border-[#FFD76A]/70 transition-colors"
          >
            <Clock className="h-5 w-5 text-[#FFD76A] mb-2" />
            <p className="font-mono-tabular text-2xl font-bold text-[#FFD76A]">
              UGX {pendingWithdrawalTotal.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400">
              Pending Withdrawals ({pendingWithdrawals.length})
            </p>
          </Link>

          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <ShieldCheck className="h-5 w-5 text-[#FFD76A]" />
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <span className="inline-flex items-center gap-1">
                  <DoorOpen className="h-3.5 w-3.5" />
                  <span className="font-mono-tabular">{liveRoomsCount}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5" />
                  <span className="font-mono-tabular">{tournaments.length}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Inbox className="h-3.5 w-3.5" />
                  <span className="font-mono-tabular">{openTickets.length}</span>
                </span>
              </div>
            </div>
            <p className="font-mono-tabular text-2xl font-bold text-white">{pendingKycs.length}</p>
            <p className="text-xs text-neutral-400">Pending KYC Reviews</p>
          </div>
        </div>

        {/* Who Has Deposited & Who Has Requested Withdrawal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                <h2 className="font-display text-lg font-bold text-white">Who Has Deposited</h2>
              </div>
              <Link
                to="/admin/transactions?tab=deposits"
                className="text-xs font-semibold text-[#FFD76A] hover:underline whitespace-nowrap"
              >
                View All ({deposits.length})
              </Link>
            </div>
            {deposits.length === 0 ? (
              <p className="text-xs text-neutral-400 py-4">No player deposits recorded yet.</p>
            ) : (
              <div className="divide-y divide-white/10">
                {deposits.slice(0, 6).map((tx) => {
                  const user = usersByUid[tx.uid];
                  return (
                    <div key={tx.txId} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">
                          {user?.fullName || tx.playerId}
                        </p>
                        <p className="text-neutral-400 font-mono-tabular truncate">
                          {tx.playerId} · {tx.phoneNumber || user?.phone || tx.provider} ·{' '}
                          {formatShortDate(tx.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono-tabular font-bold text-emerald-400">
                          +UGX {tx.amountUgx.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-neutral-400">{tx.provider}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-[#FFD76A]" />
                <h2 className="font-display text-lg font-bold text-white">
                  Who Requested Withdrawal
                </h2>
              </div>
              <Link
                to="/admin/transactions?tab=withdrawals"
                className="text-xs font-semibold text-[#FFD76A] hover:underline whitespace-nowrap"
              >
                Manage All ({withdrawals.length})
              </Link>
            </div>
            {withdrawals.length === 0 ? (
              <p className="text-xs text-neutral-400 py-4">No withdrawal requests submitted yet.</p>
            ) : (
              <div className="divide-y divide-white/10">
                {withdrawals.slice(0, 6).map((tx) => {
                  const user = usersByUid[tx.uid];
                  const isPending = tx.status === 'Pending';
                  const isBusy = busyTxId === tx.txId;
                  const fallbackBreakdown = calculateWithdrawalBreakdown(tx.amountUgx);
                  const feeUgx = tx.feeUgx ?? fallbackBreakdown.feeUgx;
                  const netPayoutUgx = tx.netPayoutUgx ?? fallbackBreakdown.netPayoutUgx;
                  return (
                    <div
                      key={tx.txId}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">
                          {user?.fullName || tx.playerId}
                        </p>
                        <p className="text-neutral-400 font-mono-tabular truncate">
                          {tx.playerId} · {tx.phoneNumber || user?.phone || '—'} ·{' '}
                          {formatShortDate(tx.createdAt)}
                        </p>
                        <p className="text-[11px] text-neutral-300 font-mono-tabular mt-0.5">
                          {feePctLabel} Fee: UGX {feeUgx.toLocaleString()} · Net Pay:{' '}
                          <span className="text-emerald-300 font-semibold">
                            UGX {netPayoutUgx.toLocaleString()}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-mono-tabular font-bold text-white">
                            UGX {tx.amountUgx.toLocaleString()}
                          </p>
                          <p
                            className={`text-[11px] font-semibold ${
                              tx.status === 'Paid'
                                ? 'text-emerald-400'
                                : tx.status === 'Pending'
                                ? 'text-[#FFD76A]'
                                : tx.status === 'Rejected'
                                ? 'text-rose-400'
                                : 'text-neutral-400'
                            }`}
                          >
                            {tx.status}
                          </p>
                        </div>
                        {isPending && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleQuickSettle(tx, 'Paid')}
                              title="Mark withdrawal as paid"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/45 bg-emerald-950/60 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/70 disabled:opacity-50 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Pay</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleQuickSettle(tx, 'Rejected')}
                              title="Reject and refund to available balance"
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/45 bg-rose-950/60 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/70 disabled:opacity-50 cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Who Has Joined */}
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#FFD76A]" />
              <h2 className="font-display text-lg font-bold text-white">Who Has Joined</h2>
            </div>
            <Link
              to="/admin/players"
              className="text-xs font-semibold text-[#FFD76A] hover:underline whitespace-nowrap"
            >
              Full Directory ({users.length})
            </Link>
          </div>
          {users.length === 0 ? (
            <p className="text-xs text-neutral-400 py-4">No registered players yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 pr-4 font-semibold">Player</th>
                    <th className="py-2.5 px-4 font-semibold">Player ID</th>
                    <th className="py-2.5 px-4 font-semibold">Phone</th>
                    <th className="py-2.5 px-4 font-semibold">Joined</th>
                    <th className="py-2.5 pl-4 font-semibold text-right">KYC / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {users.slice(0, 8).map((u) => (
                    <tr key={u.uid} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-4">
                        <p className="font-semibold text-white">{u.fullName}</p>
                        <p className="text-[11px] text-neutral-400">{u.email}</p>
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-[#FFD76A]">
                        {u.playerId}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-neutral-200">
                        {u.phone || '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-neutral-300 whitespace-nowrap">
                        {formatShortDate(u.createdAt)}
                      </td>
                      <td className="py-2.5 pl-4 text-right whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            u.kycStatus === 'Approved' ? 'text-emerald-400' : 'text-[#FFD76A]'
                          }`}
                        >
                          {u.kycStatus}
                        </span>
                        <span className="text-neutral-500 mx-1">·</span>
                        <span className="text-neutral-300">{u.accountStatus}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending KYC Queue & Support Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">Pending KYC Queue</h2>
              <Link
                to="/admin/verifications"
                className="text-xs font-semibold text-[#FFD76A] hover:underline"
              >
                Review All
              </Link>
            </div>
            {pendingKycs.length === 0 ? (
              <p className="text-xs text-neutral-400">No pending identity verifications.</p>
            ) : (
              <div className="divide-y divide-white/10">
                {pendingKycs.slice(0, 5).map((k) => (
                  <div key={k.verification_id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">{k.legal_name}</p>
                      <p className="text-neutral-400 font-mono-tabular">
                        {k.player_id} · {k.id_type}
                      </p>
                    </div>
                    <Link
                      to="/admin/verifications"
                      className="text-[#FFD76A] font-semibold hover:underline"
                    >
                      Inspect
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">Open Support Tickets</h2>
              <Link to="/admin/support" className="text-xs font-semibold text-[#FFD76A] hover:underline">
                Open Inbox
              </Link>
            </div>
            {openTickets.length === 0 ? (
              <p className="text-xs text-neutral-400">All player support tickets are resolved.</p>
            ) : (
              <div className="divide-y divide-white/10">
                {openTickets.slice(0, 5).map((t) => (
                  <div key={t.ticketId} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-white truncate">{t.subject}</p>
                      <p className="text-neutral-400">
                        {t.playerName} · {t.category}
                      </p>
                    </div>
                    <span className="text-[#FFD76A] shrink-0">{t.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
