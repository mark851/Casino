import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { fetchApiJson, getApiAuthToken } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import {
  getStore,
  hydrateAdminFromServer,
  notifyStore,
  subscribeStore,
  type ServerAdminOverview,
} from '../../lib/localStore';
import { extractWalletErrorMessage } from '../../lib/walletService';
import { AdminLayout } from '../components/AdminLayout';
import { timestampMs } from '../../utils/validation';
import { writeAdminLog } from '../adminHelpers';
import type { TransactionRecord, UserRecord, WalletRecord } from '../../shared/types';

type PlayerFilter = 'all' | 'approved' | 'pending_kyc' | 'depositors' | 'suspended';

function formatJoinedDate(ts: unknown): string {
  const ms = timestampMs(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-UG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export const AdminPlayersPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [walletsByUid, setWalletsByUid] = useState<Record<string, WalletRecord>>({});
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PlayerFilter>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const s = getStore();
      setUsers(
        Object.values(s.users).sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))
      );
      setWalletsByUid({ ...s.wallets });
      setTransactions(Object.values(s.transactions));
      setLoading(false);
    };
    sync();
    if (getApiAuthToken()) {
      void fetchApiJson<{ overview: ServerAdminOverview }>('/api/admin/overview')
        .then((res) => {
          if (res.overview) hydrateAdminFromServer(res.overview);
        })
        .catch(() => {
          // Retain current store view
        });
    }
    return subscribeStore(sync);
  }, []);

  const txStatsByUid = useMemo(() => {
    const map: Record<
      string,
      {
        depositedTotal: number;
        depositCount: number;
        pendingWithdrawals: number;
        paidWithdrawals: number;
      }
    > = {};
    for (const tx of transactions) {
      if (!map[tx.uid]) {
        map[tx.uid] = {
          depositedTotal: 0,
          depositCount: 0,
          pendingWithdrawals: 0,
          paidWithdrawals: 0,
        };
      }
      if (tx.type === 'Deposit' && tx.status === 'Verified') {
        map[tx.uid].depositedTotal += Number(tx.amountUgx) || 0;
        map[tx.uid].depositCount += 1;
      } else if (tx.type === 'Withdrawal' && tx.status === 'Pending') {
        map[tx.uid].pendingWithdrawals += Number(tx.amountUgx) || 0;
      } else if (tx.type === 'Withdrawal' && tx.status === 'Paid') {
        map[tx.uid].paidWithdrawals += Number(tx.amountUgx) || 0;
      }
    }
    return map;
  }, [transactions]);

  const toggleStatus = async (u: UserRecord) => {
    if (!firebaseUser) return;
    setBusyUid(u.uid);
    const nextStatus = u.accountStatus === 'Suspended' ? 'Active' : 'Suspended';
    try {
      if (getApiAuthToken()) {
        await fetchApiJson(`/api/admin/players/${encodeURIComponent(u.uid)}/status`, {
          method: 'POST',
          body: JSON.stringify({ accountStatus: nextStatus }),
        });
        const overviewRes = await fetchApiJson<{ overview: ServerAdminOverview }>(
          '/api/admin/overview'
        );
        if (overviewRes.overview) hydrateAdminFromServer(overviewRes.overview);
        return;
      }

      const s = getStore();
      const now = Date.now();
      if (s.users[u.uid]) {
        s.users[u.uid] = { ...s.users[u.uid], accountStatus: nextStatus, updatedAt: now };
      }
      if (s.playerProfiles[u.uid]) {
        s.playerProfiles[u.uid] = {
          ...s.playerProfiles[u.uid],
          accountStatus: nextStatus,
          updatedAt: now,
        };
      }
      notifyStore();

      await writeAdminLog({
        adminUid: firebaseUser.uid,
        adminEmail: firebaseUser.email || 'admin',
        action: `ACCOUNT_${nextStatus.toUpperCase()}`,
        targetType: 'user',
        targetId: u.uid,
        details: `${u.fullName} (${u.playerId}) set to ${nextStatus}`,
      });
    } catch (err) {
      setLoadError(extractWalletErrorMessage(err, 'Unable to update player status.'));
    } finally {
      setBusyUid(null);
    }
  };

  const nowMs = Date.now();
  const joinedLast7Days = users.filter((u) => {
    const ms = timestampMs(u.createdAt);
    return ms > 0 && nowMs - ms <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const approvedCount = users.filter((u) => u.kycStatus === 'Approved').length;
  const depositorsCount = users.filter((u) => (txStatsByUid[u.uid]?.depositCount || 0) > 0).length;

  const filtered = users.filter((u) => {
    if (filter === 'approved' && u.kycStatus !== 'Approved') return false;
    if (
      filter === 'pending_kyc' &&
      u.kycStatus !== 'Pending Verification' &&
      u.kycStatus !== 'Not Submitted'
    ) {
      return false;
    }
    if (filter === 'depositors' && (txStatsByUid[u.uid]?.depositCount || 0) === 0) return false;
    if (filter === 'suspended' && u.accountStatus !== 'Suspended') return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.playerId.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout title="Players Joined Directory">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">Total Joined</p>
              <p className="text-2xl font-bold font-mono-tabular text-white mt-1">{users.length}</p>
            </div>
            <div className="h-10 w-10 rounded-full border border-[#D4AF37]/35 bg-[#031B10] flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-[#FFD76A]" />
            </div>
          </div>

          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">Joined Last 7 Days</p>
              <p className="text-2xl font-bold font-mono-tabular text-emerald-400 mt-1">
                {joinedLast7Days}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full border border-emerald-400/35 bg-[#031B10] flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4 text-emerald-400" />
            </div>
          </div>

          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">KYC Approved</p>
              <p className="text-2xl font-bold font-mono-tabular text-[#FFD76A] mt-1">
                {approvedCount}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full border border-[#D4AF37]/40 bg-[#031B10] flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-[#FFD76A]" />
            </div>
          </div>

          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">Active Depositors</p>
              <p className="text-2xl font-bold font-mono-tabular text-white mt-1">
                {depositorsCount}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full border border-white/15 bg-[#031B10] flex items-center justify-center shrink-0">
              <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
            </div>
          </div>
        </div>

        {loadError && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-950/60 px-4 py-3 text-xs text-rose-200">
            {loadError}
          </div>
        )}

        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all', label: `All Joined (${users.length})` },
                { key: 'depositors', label: `Depositors (${depositorsCount})` },
                { key: 'approved', label: `KYC Approved (${approvedCount})` },
                { key: 'pending_kyc', label: 'Awaiting KYC' },
                { key: 'suspended', label: 'Suspended' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key as PlayerFilter)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filter === tab.key
                      ? 'bg-[#D4AF37] text-[#021D12]'
                      : 'border border-white/15 bg-[#03130B] text-neutral-300 hover:border-[#D4AF37]/40 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, ID, email, phone..."
                  className="w-full rounded-xl border border-[#D4AF37]/30 bg-[#04150D] pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                />
              </div>
              <Link
                to="/admin/transactions"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/35 bg-[#04150D] px-3 py-2 text-xs font-semibold text-[#FFD76A] hover:border-[#FFD76A] whitespace-nowrap shrink-0"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Payout Ledger</span>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-neutral-400">Loading joined players…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              No joined players match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-[#03140B] text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Player</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold">Phone &amp; Email</th>
                    <th className="px-4 py-3 font-semibold text-right">Wallet</th>
                    <th className="px-4 py-3 font-semibold text-right">Deposited</th>
                    <th className="px-4 py-3 font-semibold">KYC / Account</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map((u) => {
                    const wallet = walletsByUid[u.uid];
                    const stats = txStatsByUid[u.uid];
                    return (
                      <tr key={u.uid} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-white">{u.fullName}</p>
                          <p className="font-mono-tabular text-[11px] text-[#FFD76A]">
                            {u.playerId}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 font-mono-tabular text-neutral-300 whitespace-nowrap">
                          {formatJoinedDate(u.createdAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono-tabular text-white">{u.phone || '—'}</p>
                          <p className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                            {u.email}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono-tabular whitespace-nowrap">
                          <p className="font-semibold text-white">
                            UGX {(wallet?.availableBalance ?? 0).toLocaleString()}
                          </p>
                          {(wallet?.pendingBalance ?? 0) > 0 && (
                            <p className="text-[11px] text-[#FFD76A]">
                              Pending: UGX {wallet.pendingBalance.toLocaleString()}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono-tabular whitespace-nowrap">
                          <p className="font-semibold text-emerald-400">
                            UGX {(stats?.depositedTotal ?? 0).toLocaleString()}
                          </p>
                          <p className="text-[11px] text-neutral-400">
                            {stats?.depositCount ?? 0} deposit{stats?.depositCount === 1 ? '' : 's'}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p
                            className={`font-semibold ${
                              u.kycStatus === 'Approved' ? 'text-emerald-400' : 'text-[#FFD76A]'
                            }`}
                          >
                            {u.kycStatus}
                          </p>
                          <p
                            className={`text-[11px] ${
                              u.accountStatus === 'Suspended' ? 'text-rose-400' : 'text-neutral-400'
                            }`}
                          >
                            {u.accountStatus}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={busyUid === u.uid}
                            onClick={() => void toggleStatus(u)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white hover:border-[#FFD76A] disabled:opacity-50 cursor-pointer"
                          >
                            {u.accountStatus === 'Suspended' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Activate</span>
                              </>
                            ) : (
                              <>
                                <Ban className="h-3.5 w-3.5 text-red-400" />
                                <span>Suspend</span>
                              </>
                            )}
                          </button>
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
