import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  PlusCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Wallet,
  XCircle,
} from 'lucide-react';
import { fetchApiJson, fetchApiText } from '../../lib/apiClient';
import {
  getStore,
  hydrateAdminFromServer,
  subscribeStore,
  upsertWalletAndTxFromServer,
  type ServerAdminOverview,
} from '../../lib/localStore';
import {
  adminSettleWithdrawal,
  calculateWithdrawalBreakdown,
  extractWalletErrorMessage,
  MIN_DEPOSIT_UGX,
  MAX_DEPOSIT_UGX,
} from '../../lib/walletService';
import { AdminLayout } from '../components/AdminLayout';
import { timestampMs } from '../../utils/validation';
import type {
  MobileMoneyProvider,
  TransactionRecord,
  UserRecord,
  WalletRecord,
} from '../../shared/types';

interface TableDiagnosticInfo {
  tableName: string;
  label: string;
  rowCount: number;
  category: 'accounts' | 'payments' | 'compliance' | 'gaming' | 'operations';
}

interface DatabaseDiagnostics {
  driver: 'mysql' | 'postgres' | 'local_server_db';
  connected: boolean;
  hostLabel: string;
  databaseLabel: string;
  latencyMs: number;
  errorMessage?: string;
  tables: TableDiagnosticInfo[];
  paymentSummary: {
    verifiedDepositsUgx: number;
    verifiedDepositCount: number;
    pendingWithdrawalsUgx: number;
    pendingWithdrawalCount: number;
    paidWithdrawalsUgx: number;
    paidWithdrawalCount: number;
    totalWalletBalanceUgx: number;
  };
  envStatus: {
    dbDriverSetting: string;
    hasDatabaseUrl: boolean;
    hasDbCredentials: boolean;
    hasCpanelUapi: boolean;
    hasEnvAdminPasscode: boolean;
    hasMarzPayCredentials?: boolean;
    hasMarzPayWebhookSecret?: boolean;
  };
}

interface MarzPayStatusResponse {
  config: {
    configured: boolean;
    webhookSecretConfigured: boolean;
    baseUrl: string;
    country: string;
  };
  balance: {
    configured: boolean;
    connected: boolean;
    currency: string;
    availableBalanceUgx?: number;
    message: string;
  };
}

interface CpanelUapiTestResult {
  configured: boolean;
  connected: boolean;
  host?: string;
  mysqlDatabases: string[];
  postgresDatabases: string[];
  message: string;
}

const DRIVER_LABELS: Record<DatabaseDiagnostics['driver'], string> = {
  mysql: 'Spaceship MySQL / MariaDB',
  postgres: 'PostgreSQL',
  local_server_db: 'App Server Persistent DB',
};

export const AdminCpanelPage: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DatabaseDiagnostics | null>(null);
  const [cpanelStatus, setCpanelStatus] = useState<CpanelUapiTestResult | null>(null);
  const [marzpayStatus, setMarzpayStatus] = useState<MarzPayStatusResponse | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [walletsByUid, setWalletsByUid] = useState<Record<string, WalletRecord>>({});
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Direct Database Deposit / Wallet Credit state
  const [targetUid, setTargetUid] = useState('');
  const [creditKind, setCreditKind] = useState<'Deposit' | 'Admin Adjustment'>('Deposit');
  const [creditProvider, setCreditProvider] = useState<MobileMoneyProvider>('MTN Mobile Money');
  const [creditAmount, setCreditAmount] = useState('10000');
  const [creditNote, setCreditNote] = useState('Verified via Spaceship cPanel Database Access');

  const syncFromStore = useCallback(() => {
    const s = getStore();
    const sortedUsers = Object.values(s.users).sort(
      (a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt)
    );
    setUsers(sortedUsers);
    setWalletsByUid({ ...s.wallets });
    setTransactions(
      Object.values(s.transactions).sort(
        (a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt)
      )
    );
    setTargetUid((prev) => {
      if (prev && s.users[prev]) return prev;
      const firstPlayer = sortedUsers.find((u) => u.role === 'player') || sortedUsers[0];
      return firstPlayer?.uid || '';
    });
  }, []);

  const loadCpanelAndOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, overviewRes, marzRes] = await Promise.all([
        fetchApiJson<{ diagnostics: DatabaseDiagnostics; cpanel: CpanelUapiTestResult }>(
          '/api/admin/cpanel/status'
        ),
        fetchApiJson<{ overview: ServerAdminOverview }>('/api/admin/overview'),
        fetchApiJson<MarzPayStatusResponse>('/api/admin/marzpay/status').catch(() => null),
      ]);
      setDiagnostics(statusRes.diagnostics);
      setCpanelStatus(statusRes.cpanel);
      if (marzRes) {
        setMarzpayStatus(marzRes);
      }
      if (overviewRes.overview) {
        hydrateAdminFromServer(overviewRes.overview);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractWalletErrorMessage(err, 'Unable to load Spaceship cPanel database status.'),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncFromStore();
    const unsub = subscribeStore(syncFromStore);
    void loadCpanelAndOverview();
    return unsub;
  }, [syncFromStore, loadCpanelAndOverview]);

  const usersByUid = useMemo(() => {
    const map: Record<string, UserRecord> = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  const pendingWithdrawals = useMemo(
    () => transactions.filter((t) => t.type === 'Withdrawal' && t.status === 'Pending'),
    [transactions]
  );

  const recentDepositsAndPayouts = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'Deposit' || t.type === 'Withdrawal' || t.type === 'Admin Adjustment')
        .slice(0, 12),
    [transactions]
  );

  const handleTestConnection = async () => {
    setActionBusy('test');
    setFeedback(null);
    try {
      const [res, marzRes] = await Promise.all([
        fetchApiJson<{
          diagnostics: DatabaseDiagnostics;
          cpanel: CpanelUapiTestResult;
        }>('/api/admin/cpanel/test-connection', { method: 'POST' }),
        fetchApiJson<MarzPayStatusResponse>('/api/admin/marzpay/status').catch(() => null),
      ]);
      setDiagnostics(res.diagnostics);
      setCpanelStatus(res.cpanel);
      if (marzRes) {
        setMarzpayStatus(marzRes);
      }
      setFeedback({
        type: res.diagnostics.connected ? 'success' : 'error',
        text: `DB Driver ${DRIVER_LABELS[res.diagnostics.driver]} (${res.diagnostics.latencyMs}ms). ${res.cpanel.message}`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractWalletErrorMessage(err, 'Connection test failed.'),
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleSyncSchema = async () => {
    setActionBusy('sync');
    setFeedback(null);
    try {
      const res = await fetchApiJson<{ ok: boolean; diagnostics: DatabaseDiagnostics }>(
        '/api/admin/cpanel/sync-schema',
        { method: 'POST' }
      );
      setDiagnostics(res.diagnostics);
      setFeedback({
        type: 'success',
        text: `All ${res.diagnostics.tables.length} CASINO ROYALE tables synchronized to ${DRIVER_LABELS[res.diagnostics.driver]}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractWalletErrorMessage(err, 'Unable to synchronize SQL schema.'),
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleDownloadSqlDump = async () => {
    setActionBusy('export');
    setFeedback(null);
    try {
      const sql = await fetchApiText('/api/admin/cpanel/export-sql');
      const blob = new Blob([sql], { type: 'application/sql;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `casinoroyale-cpanel-${new Date().toISOString().slice(0, 10)}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback({
        type: 'success',
        text: 'Exported .sql schema & transaction dump for cPanel phpMyAdmin / PostgreSQL.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractWalletErrorMessage(err, 'Unable to export SQL dump.'),
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleManualCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUid) {
      setFeedback({ type: 'error', text: 'Select a target player account.' });
      return;
    }
    const amt = Math.round(Number(creditAmount));
    if (!Number.isFinite(amt) || amt < MIN_DEPOSIT_UGX || amt > MAX_DEPOSIT_UGX) {
      setFeedback({
        type: 'error',
        text: `Amount must be between UGX ${MIN_DEPOSIT_UGX.toLocaleString()} and UGX ${MAX_DEPOSIT_UGX.toLocaleString()}.`,
      });
      return;
    }

    setActionBusy('credit');
    setFeedback(null);
    try {
      const res = await fetchApiJson<{ tx: TransactionRecord; wallet: WalletRecord }>(
        '/api/admin/transactions/manual',
        {
          method: 'POST',
          body: JSON.stringify({
            targetUid,
            amountUgx: amt,
            kind: creditKind,
            provider: creditProvider,
            note: creditNote,
          }),
        }
      );
      upsertWalletAndTxFromServer(res.wallet, res.tx);
      const playerName = usersByUid[targetUid]?.fullName || res.tx.playerId;
      setFeedback({
        type: 'success',
        text: `${creditKind} of UGX ${amt.toLocaleString()} (${res.tx.reference}) persisted to database for ${playerName}.`,
      });
      await loadCpanelAndOverview();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractWalletErrorMessage(err, 'Unable to post direct database credit.'),
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleSettleWithdrawal = async (tx: TransactionRecord, decision: 'Paid' | 'Rejected') => {
    setActionBusy(tx.txId);
    setFeedback(null);
    try {
      await adminSettleWithdrawal(tx, decision);
      await loadCpanelAndOverview();
      setFeedback({
        type: 'success',
        text:
          decision === 'Paid'
            ? `Withdrawal ${tx.reference} settled as Paid across all databases.`
            : `Withdrawal ${tx.reference} rejected and UGX ${tx.amountUgx.toLocaleString()} refunded to wallet.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractWalletErrorMessage(err, 'Unable to settle withdrawal.'),
      });
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <AdminLayout title="Spaceship cPanel & Databases">
      <div className="space-y-6">
        {/* Top Action & Connection Bar */}
        <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/35 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold tracking-[0.18em] text-[#FFD76A] uppercase flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" />
              <span>Spaceship cPanel Hosting &amp; Database Access</span>
            </p>
            <h2 className="font-display text-2xl font-bold text-white">
              {diagnostics ? DRIVER_LABELS[diagnostics.driver] : 'Connecting to Server DB…'}
            </h2>
            <p className="text-xs text-neutral-300 font-mono-tabular">
              Host: {diagnostics?.hostLabel || '—'} · Database: {diagnostics?.databaseLabel || '—'}{' '}
              · Ping: {diagnostics?.latencyMs ?? '—'} ms
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={Boolean(actionBusy)}
              onClick={() => void handleTestConnection()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/45 bg-[#041D11] px-4 py-2 text-xs font-semibold text-white hover:border-[#FFD76A] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#FFD76A] ${actionBusy === 'test' ? 'animate-spin' : ''}`} />
              <span>Test DB &amp; cPanel</span>
            </button>
            <button
              type="button"
              disabled={Boolean(actionBusy)}
              onClick={() => void handleSyncSchema()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/45 bg-emerald-950/60 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/70 disabled:opacity-50 cursor-pointer"
            >
              <Database className="h-3.5 w-3.5" />
              <span>{actionBusy === 'sync' ? 'Syncing…' : 'Sync All Tables'}</span>
            </button>
            <button
              type="button"
              disabled={Boolean(actionBusy)}
              onClick={() => void handleDownloadSqlDump()}
              className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export .SQL Dump</span>
            </button>
          </div>
        </section>

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

        {/* Payment & Liquidity Totals synced from active database */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5">
            <div className="flex items-center justify-between mb-2">
              <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
              <span className="text-[11px] font-mono-tabular text-neutral-400">
                {diagnostics?.paymentSummary.verifiedDepositCount ?? 0} verified
              </span>
            </div>
            <p className="font-mono-tabular text-xl font-bold text-emerald-400">
              UGX {(diagnostics?.paymentSummary.verifiedDepositsUgx ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">Total DB Deposits</p>
          </div>

          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5">
            <div className="flex items-center justify-between mb-2">
              <ArrowUpRight className="h-5 w-5 text-[#FFD76A]" />
              <span className="text-[11px] font-mono-tabular text-neutral-400">
                {diagnostics?.paymentSummary.pendingWithdrawalCount ?? 0} pending
              </span>
            </div>
            <p className="font-mono-tabular text-xl font-bold text-[#FFD76A]">
              UGX {(diagnostics?.paymentSummary.pendingWithdrawalsUgx ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">Pending Withdrawal Queue</p>
          </div>

          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-5 w-5 text-white" />
              <span className="text-[11px] font-mono-tabular text-neutral-400">
                {diagnostics?.paymentSummary.paidWithdrawalCount ?? 0} paid
              </span>
            </div>
            <p className="font-mono-tabular text-xl font-bold text-white">
              UGX {(diagnostics?.paymentSummary.paidWithdrawalsUgx ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">Paid Withdrawals</p>
          </div>

          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="h-5 w-5 text-[#FFD76A]" />
              <span className="text-[11px] font-mono-tabular text-neutral-400">
                {Object.keys(walletsByUid).length} wallets
              </span>
            </div>
            <p className="font-mono-tabular text-xl font-bold text-white">
              UGX {(diagnostics?.paymentSummary.totalWalletBalanceUgx ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">Total Wallet Liquidity</p>
          </div>
        </div>

        {/* All Databases & Tables + Spaceship UAPI Discovery */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-6">
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#FFD76A]" />
                <h3 className="font-display text-lg font-bold text-white">
                  All Database Tables ({diagnostics?.tables.length ?? 0})
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-emerald-400">
                {diagnostics?.connected ? 'Connected' : loading ? 'Checking…' : 'Offline'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-[#03140B] text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">SQL Table</th>
                    <th className="px-4 py-2.5 font-semibold">Domain</th>
                    <th className="px-4 py-2.5 font-semibold">Purpose</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Rows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {(diagnostics?.tables || []).map((tbl) => (
                    <tr key={tbl.tableName} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 font-mono-tabular font-semibold text-[#FFD76A]">
                        {tbl.tableName}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-neutral-300">{tbl.category}</td>
                      <td className="px-4 py-2.5 text-neutral-200">{tbl.label}</td>
                      <td className="px-4 py-2.5 text-right font-mono-tabular font-bold text-white">
                        {tbl.rowCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Spaceship cPanel UAPI & Server Env Readiness */}
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <HardDrive className="h-4 w-4 text-[#FFD76A]" />
              <h3 className="font-display text-lg font-bold text-white">
                cPanel UAPI &amp; Env Status
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              {[
                {
                  label: 'SQL Database URL (DATABASE_URL)',
                  ok: Boolean(diagnostics?.envStatus.hasDatabaseUrl),
                },
                {
                  label: 'MySQL / PostgreSQL Host Credentials (DB_USER / DB_NAME)',
                  ok: Boolean(diagnostics?.envStatus.hasDbCredentials),
                },
                {
                  label: 'Spaceship cPanel UAPI (CPANEL_HOST / API Token)',
                  ok: Boolean(diagnostics?.envStatus.hasCpanelUapi),
                },
                {
                  label: 'Server Admin Passcode Override (ADMIN_PASSCODE)',
                  ok: Boolean(diagnostics?.envStatus.hasEnvAdminPasscode),
                },
                {
                  label: 'MarzPay API Keys (MARZPAY_API_KEY / API_SECRET)',
                  ok: Boolean(diagnostics?.envStatus.hasMarzPayCredentials),
                },
                {
                  label: 'MarzPay Webhook Signing Secret (MARZPAY_WEBHOOK_SECRET)',
                  ok: Boolean(diagnostics?.envStatus.hasMarzPayWebhookSecret),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#03140B] px-3.5 py-2.5"
                >
                  <span className="text-neutral-200">{item.label}</span>
                  <span
                    className={`font-semibold shrink-0 ${
                      item.ok ? 'text-emerald-400' : 'text-neutral-400'
                    }`}
                  >
                    {item.ok ? 'Configured' : 'Default / Unset'}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[#D4AF37]/25 bg-[#03140B] p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#FFD76A]">MarzPay Gateway (Deposits &amp; Payouts)</p>
                <span
                  className={`font-semibold ${
                    marzpayStatus?.balance.connected
                      ? 'text-emerald-400'
                      : marzpayStatus?.config.configured
                      ? 'text-amber-300'
                      : 'text-neutral-400'
                  }`}
                >
                  {marzpayStatus?.balance.connected
                    ? 'Live Connected'
                    : marzpayStatus?.config.configured
                    ? 'Auth Check Failed'
                    : 'Local Ledger Mode'}
                </span>
              </div>
              <p className="text-neutral-300 leading-relaxed">
                {marzpayStatus?.balance.message || 'Checking MarzPay API readiness…'}
              </p>
              {typeof marzpayStatus?.balance.availableBalanceUgx === 'number' && (
                <p className="font-mono-tabular text-emerald-300 font-semibold">
                  MarzPay Merchant Balance: {marzpayStatus.balance.currency}{' '}
                  {marzpayStatus.balance.availableBalanceUgx.toLocaleString()}
                </p>
              )}
              <p className="text-[11px] text-neutral-400 font-mono-tabular">
                Webhook URL: /api/webhooks/marzpay (Node) · /api.php?action=marzpay-webhook (cPanel PHP)
              </p>
            </div>

            <div className="rounded-xl border border-[#D4AF37]/25 bg-[#03140B] p-4 space-y-2 text-xs">
              <p className="font-semibold text-[#FFD76A]">Spaceship cPanel UAPI Discovery</p>
              <p className="text-neutral-300 leading-relaxed">
                {cpanelStatus?.message || 'Checking cPanel UAPI configuration…'}
              </p>
              {cpanelStatus && cpanelStatus.mysqlDatabases.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] text-neutral-400 mb-1">MySQL Databases:</p>
                  <p className="font-mono-tabular text-emerald-300">
                    {cpanelStatus.mysqlDatabases.join(', ')}
                  </p>
                </div>
              )}
              {cpanelStatus && cpanelStatus.postgresDatabases.length > 0 && (
                <div className="pt-1">
                  <p className="text-[11px] text-neutral-400 mb-1">PostgreSQL Databases:</p>
                  <p className="font-mono-tabular text-emerald-300">
                    {cpanelStatus.postgresDatabases.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deposits & Withdrawals Direct Database Control */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.95fr] gap-6">
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold text-white">
                Deposits &amp; Withdrawals Database Feed
              </h3>
              <span className="text-xs font-mono-tabular text-[#FFD76A]">
                {pendingWithdrawals.length} Pending Payouts
              </span>
            </div>

            {pendingWithdrawals.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FFD76A]">
                  Pending Withdrawal Settlement Queue
                </p>
                {pendingWithdrawals.map((tx) => {
                  const user = usersByUid[tx.uid];
                  const breakdown = calculateWithdrawalBreakdown(tx.amountUgx);
                  const isBusy = actionBusy === tx.txId;
                  return (
                    <div
                      key={tx.txId}
                      className="rounded-xl border border-[#D4AF37]/35 bg-[#04170E] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white">
                          {user?.fullName || tx.playerId}{' '}
                          <span className="font-mono-tabular text-[#FFD76A]">({tx.reference})</span>
                        </p>
                        <p className="text-neutral-400 font-mono-tabular">
                          {tx.provider} · {tx.phoneNumber || user?.phone || '—'} · Gross UGX{' '}
                          {tx.amountUgx.toLocaleString()} · Net Pay UGX{' '}
                          {(tx.netPayoutUgx ?? breakdown.netPayoutUgx).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSettleWithdrawal(tx, 'Paid')}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/45 bg-emerald-950/60 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/70 disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Mark Paid</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSettleWithdrawal(tx, 'Rejected')}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-400/45 bg-rose-950/60 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/70 disabled:opacity-50 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="divide-y divide-white/10">
              {recentDepositsAndPayouts.length === 0 ? (
                <p className="py-4 text-xs text-neutral-400">
                  No deposits or withdrawals recorded in database yet.
                </p>
              ) : (
                recentDepositsAndPayouts.map((tx) => {
                  const u = usersByUid[tx.uid];
                  const isWd = tx.type === 'Withdrawal';
                  return (
                    <div
                      key={tx.txId}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">
                          {u?.fullName || tx.playerId} · {tx.type}
                        </p>
                        <p className="text-[11px] font-mono-tabular text-neutral-400 truncate">
                          {tx.reference} · {tx.provider} · {tx.phoneNumber || u?.phone || '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0 font-mono-tabular">
                        <p className={isWd ? 'text-white font-bold' : 'text-emerald-400 font-bold'}>
                          {isWd ? '-' : '+'}UGX {tx.amountUgx.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-[#FFD76A]">{tx.status}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Direct DB Deposit / Wallet Credit Form */}
          <form
            onSubmit={handleManualCredit}
            className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <PlusCircle className="h-4 w-4 text-emerald-400" />
              <h3 className="font-display text-lg font-bold text-white">
                Direct DB Deposit / Wallet Credit
              </h3>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Target Player Account
              </label>
              <select
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
              >
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.fullName} ({u.playerId}) — UGX{' '}
                    {(walletsByUid[u.uid]?.availableBalance ?? 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Entry Type</label>
                <select
                  value={creditKind}
                  onChange={(e) =>
                    setCreditKind(
                      e.target.value === 'Admin Adjustment' ? 'Admin Adjustment' : 'Deposit'
                    )
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value="Deposit">Verified Deposit</option>
                  <option value="Admin Adjustment">Admin Adjustment</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Channel</label>
                <select
                  value={creditProvider}
                  onChange={(e) => setCreditProvider(e.target.value as MobileMoneyProvider)}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value="MTN Mobile Money">MTN Mobile Money</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="System">System Ledger</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Amount (UGX)</label>
              <input
                type="number"
                min={MIN_DEPOSIT_UGX}
                max={MAX_DEPOSIT_UGX}
                step={500}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-sm font-mono-tabular text-white focus:border-[#FFD76A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Audit Reference / Note
              </label>
              <input
                type="text"
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                maxLength={180}
                className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={Boolean(actionBusy)}
              className="gold-shimmer-btn w-full rounded-full py-2.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              {actionBusy === 'credit' ? 'Writing to Database…' : 'Credit Player Wallet in Database'}
            </button>
          </form>
        </div>

        {/* Spaceship cPanel Node.js Deployment Guide */}
        <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[#FFD76A]" />
            <h3 className="font-display text-lg font-bold text-white">
              Spaceship cPanel Node.js &amp; Database Connection Guide
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-300">
            <div className="rounded-xl border border-white/10 bg-[#03140B] p-4 space-y-1.5">
              <p className="font-semibold text-[#FFD76A] flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>1. Create Database in cPanel</span>
              </p>
              <p>
                Open Spaceship cPanel → MySQL Databases or PostgreSQL Databases, create your
                database and user, and assign ALL PRIVILEGES.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#03140B] p-4 space-y-1.5">
              <p className="font-semibold text-[#FFD76A] flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span>2. Set Server Env Variables</span>
              </p>
              <p>
                In Setup Node.js App (or AI Studio Secrets), set{' '}
                <code className="text-emerald-300">DB_DRIVER=mysql</code>,{' '}
                <code className="text-emerald-300">DB_HOST</code>,{' '}
                <code className="text-emerald-300">DB_NAME</code>,{' '}
                <code className="text-emerald-300">DB_USER</code>,{' '}
                <code className="text-emerald-300">DB_PASSWORD</code>, and optional{' '}
                <code className="text-emerald-300">CPANEL_API_TOKEN</code>.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#03140B] p-4 space-y-1.5">
              <p className="font-semibold text-[#FFD76A] flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" />
                <span>3. Boot Application Entry</span>
              </p>
              <p>
                Set Application Startup File to <code className="text-emerald-300">server.ts</code>{' '}
                (with <code className="text-emerald-300">npm run build &amp;&amp; npm start</code>),
                then click <strong>Sync All Tables</strong> above.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};
