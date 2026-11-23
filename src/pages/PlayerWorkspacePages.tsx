import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Download,
  History,
  ReceiptText,
  Search,
  ShieldCheck,
  Smartphone,
  Trophy,
  UserCircle,
  Wallet,
  XCircle,
} from 'lucide-react';
import { getStore, notifyStore, subscribeStore } from '../lib/localStore';
import { useAuth } from '../lib/authContext';
import {
  calculateWithdrawalBreakdown,
  cancelPendingWithdrawal,
  ensureWalletExists,
  extractWalletErrorMessage,
  MAX_DEPOSIT_UGX,
  MAX_WITHDRAWAL_UGX,
  MIN_DEPOSIT_UGX,
  MIN_GAME_STAKE_UGX,
  MIN_WITHDRAWAL_UGX,
  submitDeposit,
  submitWithdrawal,
  verifyPendingDeposit,
  WITHDRAWAL_FEE_RATE,
} from '../lib/walletService';
import { PlayerLayout } from '../components/PlayerLayout';
import { clampStr, timestampMs } from '../utils/validation';
import ugandaEmblemImg from '../assets/images/uganda_flag_emblem_1794598745119.jpg';
import type {
  GameHistoryRecord,
  MobileMoneyProvider,
  NotificationRecord,
  TransactionRecord,
  TransactionStatus,
} from '../shared/types';

export const ProfilePage: React.FC = () => {
  const { firebaseUser, userDoc, playerProfile } = useAuth();
  const [displayName, setDisplayName] = useState(playerProfile?.displayName || userDoc?.fullName || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (playerProfile?.displayName) setDisplayName(playerProfile.displayName);
  }, [playerProfile?.displayName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!firebaseUser || !playerProfile) return;
    const clean = clampStr(displayName, 80);
    if (clean.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    setBusy(true);
    try {
      const s = getStore();
      if (s.playerProfiles[firebaseUser.uid]) {
        s.playerProfiles[firebaseUser.uid].displayName = clean;
        s.playerProfiles[firebaseUser.uid].updatedAt = Date.now();
      }
      if (s.users[firebaseUser.uid]) {
        s.users[firebaseUser.uid].fullName = clean;
        s.users[firebaseUser.uid].updatedAt = Date.now();
      }
      if (s.presence[firebaseUser.uid]) {
        s.presence[firebaseUser.uid].displayName = clean;
      }
      notifyStore();
      setMessage('Public display name updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlayerLayout title="Player Profile">
      <div className="max-w-3xl space-y-6">
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <img
            src={ugandaEmblemImg}
            alt="Player Crest"
            className="h-20 w-20 rounded-2xl border border-[#FFD76A]/60 object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="font-display text-2xl font-bold text-white">
              {playerProfile?.displayName || userDoc?.fullName || 'Matatu Contender'}
            </h2>
            <p className="text-xs font-mono-tabular text-[#FFD76A]">
              Player ID: {userDoc?.playerId || 'Pending'}
            </p>
            <p className="text-xs text-neutral-300">
              Email: {userDoc?.email} · Phone: {userDoc?.phone}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 sm:p-8 space-y-4"
        >
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-[#FFD76A]" />
            <span>Public Table Identity</span>
          </h3>
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-xs text-red-200">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-2.5 text-xs text-emerald-200">
              {message}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Leaderboard &amp; Table Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#04120B] px-4 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="gold-shimmer-btn rounded-full px-6 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save Display Name'}
          </button>
        </form>
      </div>
    </PlayerLayout>
  );
};

const QUICK_AMOUNTS_UGX = [1000, 2000, 5000, 10000, 25000, 50000];
const WITHDRAWAL_FEE_PCT = Math.round(WITHDRAWAL_FEE_RATE * 100);
const NET_PAYOUT_PCT = 100 - WITHDRAWAL_FEE_PCT;

function formatTxDate(ts: unknown): string {
  const ms = timestampMs(ts);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleString('en-UG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusTextClass(status: TransactionStatus): string {
  if (status === 'Verified' || status === 'Paid' || status === 'Completed') return 'text-emerald-400';
  if (status === 'Pending') return 'text-amber-300';
  if (status === 'Rejected' || status === 'Failed' || status === 'Cancelled') return 'text-red-400';
  return 'text-neutral-400';
}

function useUserTransactions(uid: string | undefined, maxItems = 100) {
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeStore(() => setTick((t) => t + 1));
  }, []);

  const transactions = useMemo(() => {
    if (!uid) return [] as TransactionRecord[];
    return Object.values(getStore().transactions)
      .filter((tx) => tx.uid === uid)
      .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))
      .slice(0, maxItems);
  }, [uid, maxItems]);

  return { transactions, loading: false };
}

export const WalletPage: React.FC = () => {
  const { firebaseUser, userDoc, wallet } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'withdraw' ? 'withdraw' : 'deposit';

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(initialTab);
  const [provider, setProvider] = useState<MobileMoneyProvider>('MTN Mobile Money');
  const [amountInput, setAmountInput] = useState('5000');
  const [phoneNumber, setPhoneNumber] = useState(userDoc?.phone || '+256772000000');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<{
    kind: 'Deposit' | 'Withdrawal';
    reference: string;
    amountUgx: number;
    feeUgx?: number;
    netPayoutUgx?: number;
    status: string;
    balanceAfter: number;
  } | null>(null);

  const verifiedUid = firebaseUser?.emailVerified ? firebaseUser.uid : undefined;
  const { transactions, loading: txLoading } = useUserTransactions(verifiedUid, 25);

  useEffect(() => {
    const paramTab = searchParams.get('tab');
    if (paramTab === 'withdraw' || paramTab === 'deposit') {
      setActiveTab(paramTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (userDoc?.phone) {
      setPhoneNumber((prev) => (prev === '+256772000000' || !prev ? userDoc.phone : prev));
    }
  }, [userDoc?.phone]);

  useEffect(() => {
    if (verifiedUid && !wallet) {
      void ensureWalletExists(verifiedUid, userDoc?.playerId).catch(() => {});
    }
  }, [verifiedUid, wallet, userDoc?.playerId]);

  const switchTab = (next: 'deposit' | 'withdraw') => {
    setActiveTab(next);
    setErrorMsg('');
    setReceipt(null);
    setSearchParams({ tab: next }, { replace: true });
  };

  const totalDeposited = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'Deposit' && (t.status === 'Verified' || t.status === 'Paid'))
        .reduce((sum, t) => sum + Number(t.amountUgx || 0), 0),
    [transactions]
  );

  const parsedAmount = Math.round(Number(amountInput.replace(/,/g, '')) || 0);
  const availableBalance = Number(wallet?.availableBalance ?? 0);
  const pendingBalance = Number(wallet?.pendingBalance ?? 0);
  const withdrawalBreakdown = useMemo(
    () => calculateWithdrawalBreakdown(parsedAmount),
    [parsedAmount]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setReceipt(null);

    if (!firebaseUser) {
      setErrorMsg('Sign in to manage deposits and withdrawals.');
      return;
    }
    if (!firebaseUser.emailVerified) {
      setErrorMsg('Verify your email address before performing wallet transactions.');
      return;
    }

    setSubmitting(true);
    try {
      if (activeTab === 'deposit') {
        const res = await submitDeposit({
          uid: firebaseUser.uid,
          playerId: userDoc?.playerId,
          provider,
          amountUgx: parsedAmount,
          phoneNumber,
          note,
        });
        setReceipt({
          kind: 'Deposit',
          reference: res.reference,
          amountUgx: parsedAmount,
          status: res.status,
          balanceAfter: res.balanceAfter,
        });
        setNote('');
      } else {
        const res = await submitWithdrawal({
          uid: firebaseUser.uid,
          playerId: userDoc?.playerId,
          provider,
          amountUgx: parsedAmount,
          phoneNumber,
          note,
        });
        setReceipt({
          kind: 'Withdrawal',
          reference: res.reference,
          amountUgx: parsedAmount,
          feeUgx: res.feeUgx,
          netPayoutUgx: res.netPayoutUgx,
          status: res.status,
          balanceAfter: res.balanceAfter,
        });
        setNote('');
      }
    } catch (err) {
      setErrorMsg(extractWalletErrorMessage(err, 'Transaction could not be processed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelWithdrawal = async (tx: TransactionRecord) => {
    if (!firebaseUser) return;
    setErrorMsg('');
    setCancellingId(tx.txId);
    try {
      await cancelPendingWithdrawal(tx);
    } catch (err) {
      setErrorMsg(extractWalletErrorMessage(err, 'Unable to cancel pending withdrawal.'));
    } finally {
      setCancellingId(null);
    }
  };

  const handleVerifyDeposit = async (tx: TransactionRecord) => {
    if (!firebaseUser) return;
    setErrorMsg('');
    setVerifyingId(tx.txId);
    try {
      const res = await verifyPendingDeposit(tx.txId);
      setReceipt({
        kind: 'Deposit',
        reference: tx.reference,
        amountUgx: tx.amountUgx,
        status: res.status,
        balanceAfter: res.balanceAfter,
      });
    } catch (err) {
      setErrorMsg(extractWalletErrorMessage(err, 'Unable to verify deposit status yet.'));
    } finally {
      setVerifyingId(null);
    }
  };

  const content = (
    <div className="mx-auto max-w-5xl space-y-6 py-4 sm:py-6 px-4 sm:px-0">
      {/* Wallet Balance KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/40 p-5 space-y-1">
          <p className="text-xs text-neutral-400">Available Balance</p>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-[#FFD76A]">
            UGX {availableBalance.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-400">Ready for withdrawal or table play</p>
        </div>

        <div className="emerald-card-surface rounded-2xl border border-white/15 p-5 space-y-1">
          <p className="text-xs text-neutral-400">Pending Withdrawals</p>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-white">
            UGX {pendingBalance.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-400">Held for Mobile Money settlement</p>
        </div>

        <div className="emerald-card-surface rounded-2xl border border-white/15 p-5 space-y-1">
          <p className="text-xs text-neutral-400">Total Deposited</p>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-emerald-400">
            UGX {totalDeposited.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-400 font-mono-tabular">
            {transactions.length} recorded {transactions.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      </div>

      {/* Main Deposit & Withdraw Action Card */}
      <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/35 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl border border-[#FFD76A]/50 bg-[#063B24] flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-[#FFD76A]" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">
                UGX Mobile Money Cashier
              </h1>
              <p className="text-xs text-neutral-300">
                Min deposit UGX {MIN_DEPOSIT_UGX.toLocaleString()} · Min withdrawal UGX {MIN_WITHDRAWAL_UGX.toLocaleString()} ({WITHDRAWAL_FEE_PCT}% fee) · Min game stake UGX {MIN_GAME_STAKE_UGX.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Segmented Tab Controls */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-white/15 bg-[#03130B] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => switchTab('deposit')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'deposit'
                  ? 'bg-[#FFD76A] text-[#110C02]'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>Deposit</span>
            </button>
            <button
              type="button"
              onClick={() => switchTab('withdraw')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'withdraw'
                  ? 'bg-[#FFD76A] text-[#110C02]'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/45 bg-red-950/55 px-4 py-3 text-xs text-red-200 flex items-start gap-2.5">
            <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {receipt && (
          <div className="rounded-xl border border-emerald-500/45 bg-emerald-950/55 px-4 py-3.5 text-xs text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-white">
                  {receipt.kind}{' '}
                  {receipt.status === 'Verified'
                    ? 'Credited'
                    : receipt.kind === 'Deposit' && receipt.status === 'Pending'
                    ? 'Prompt Sent (Awaiting MoMo PIN)'
                    : 'Submitted'}{' '}
                  ·{' '}
                  <span className="font-mono-tabular text-[#FFD76A]">
                    UGX {receipt.amountUgx.toLocaleString()}
                  </span>
                </p>
                {receipt.kind === 'Deposit' && receipt.status === 'Pending' && (
                  <p className="text-neutral-200">
                    Approve the Mobile Money PIN prompt on your phone, then click Verify Prompt below if balance does not update automatically.
                  </p>
                )}
                {receipt.kind === 'Withdrawal' && typeof receipt.netPayoutUgx === 'number' && (
                  <p className="text-neutral-200 font-mono-tabular">
                    {WITHDRAWAL_FEE_PCT}% Fee: UGX {(receipt.feeUgx || 0).toLocaleString()} · Net Payout: UGX {receipt.netPayoutUgx.toLocaleString()}
                  </p>
                )}
                <p className="text-neutral-300 font-mono-tabular">
                  Ref: {receipt.reference} · Current Available Balance: UGX {receipt.balanceAfter.toLocaleString()}
                </p>
              </div>
            </div>
            <Link
              to="/transactions"
              className="text-xs font-bold text-[#FFD76A] hover:underline whitespace-nowrap shrink-0"
            >
              View Receipt Ledger →
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="space-y-5">
            {/* Provider Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-200">
                Select Mobile Money Provider
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProvider('MTN Mobile Money')}
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                    provider === 'MTN Mobile Money'
                      ? 'border-[#FFCC00] bg-[#1F1A04]'
                      : 'border-white/15 bg-[#04120B] hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#FFCC00]">MTN Mobile Money</span>
                    <span className="text-[11px] font-mono-tabular text-neutral-300">077 / 078 / 076</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">Instant MoMo Uganda settlement</p>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('Airtel Money')}
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                    provider === 'Airtel Money'
                      ? 'border-[#EF4444] bg-[#21070A]'
                      : 'border-white/15 bg-[#04120B] hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#F87171]">Airtel Money</span>
                    <span className="text-[11px] font-mono-tabular text-neutral-300">070 / 075 / 074</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">Direct Airtel Money Uganda transfer</p>
                </button>
              </div>
            </div>

            {/* Amount & Quick Presets */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="wallet-amount-input" className="font-semibold text-neutral-200">
                  Amount (UGX)
                </label>
                <span className="font-mono-tabular text-neutral-400">
                  {activeTab === 'deposit'
                    ? `Min ${MIN_DEPOSIT_UGX.toLocaleString()} · Max ${MAX_DEPOSIT_UGX.toLocaleString()}`
                    : `Min ${MIN_WITHDRAWAL_UGX.toLocaleString()} · Available ${availableBalance.toLocaleString()}`}
                </span>
              </div>
              <input
                id="wallet-amount-input"
                type="number"
                inputMode="numeric"
                min={activeTab === 'deposit' ? MIN_DEPOSIT_UGX : MIN_WITHDRAWAL_UGX}
                max={activeTab === 'deposit' ? MAX_DEPOSIT_UGX : MAX_WITHDRAWAL_UGX}
                step={1}
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#04120B] px-4 py-3 font-mono-tabular text-base font-bold text-white focus:border-[#FFD76A] focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS_UGX.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountInput(String(amt))}
                    className={`rounded-lg border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors cursor-pointer ${
                      parsedAmount === amt
                        ? 'border-[#FFD76A] bg-[#0B4128] text-[#FFD76A]'
                        : 'border-white/15 bg-[#04120B] text-neutral-300 hover:border-white/35'
                    }`}
                  >
                    UGX {amt.toLocaleString()}
                  </button>
                ))}
                {activeTab === 'withdraw' && availableBalance >= MIN_WITHDRAWAL_UGX && (
                  <button
                    type="button"
                    onClick={() => setAmountInput(String(Math.min(availableBalance, MAX_WITHDRAWAL_UGX)))}
                    className="rounded-lg border border-[#FFD76A]/40 bg-[#04120B] px-3 py-1.5 text-xs font-semibold text-[#FFD76A] hover:bg-[#0A3520] cursor-pointer"
                  >
                    Max Available
                  </button>
                )}
              </div>
            </div>

            {/* Phone Number & Optional Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="wallet-phone-input" className="block text-xs font-semibold text-neutral-200 mb-1.5">
                  Mobile Money Phone Number
                </label>
                <div className="relative">
                  <Smartphone className="h-4 w-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="wallet-phone-input"
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+256 772 123 456"
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-10 pr-4 py-2.5 font-mono-tabular text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="wallet-note-input" className="block text-xs font-semibold text-neutral-200 mb-1.5">
                  Note (Optional)
                </label>
                <input
                  id="wallet-note-input"
                  type="text"
                  maxLength={120}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={activeTab === 'deposit' ? 'Table top-up' : 'Payout to personal line'}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Right Summary & Submit Panel */}
          <div className="rounded-xl border border-[#D4AF37]/30 bg-[#03130B] p-5 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <h2 className="font-display text-lg font-bold text-white">
                {activeTab === 'deposit' ? 'Deposit Summary' : 'Withdrawal Summary'}
              </h2>
              <div className="space-y-2.5 text-xs border-t border-white/10 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Channel</span>
                  <span className="font-semibold text-white">{provider}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Account Line</span>
                  <span className="font-mono-tabular text-white">{phoneNumber || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">
                    {activeTab === 'deposit' ? 'Platform Fee' : `Withdrawal Fee (${WITHDRAWAL_FEE_PCT}%)`}
                  </span>
                  <span
                    className={`font-mono-tabular font-semibold ${
                      activeTab === 'deposit' ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {activeTab === 'deposit'
                      ? 'UGX 0'
                      : `-UGX ${withdrawalBreakdown.feeUgx.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                  <span className="text-neutral-200 font-semibold">
                    {activeTab === 'deposit' ? 'Total Credit' : `Net Payout (${NET_PAYOUT_PCT}%)`}
                  </span>
                  <span className="font-mono-tabular text-base font-extrabold text-[#FFD76A]">
                    UGX{' '}
                    {activeTab === 'deposit'
                      ? Math.max(0, parsedAmount).toLocaleString()
                      : withdrawalBreakdown.netPayoutUgx.toLocaleString()}
                  </span>
                </div>
                {activeTab === 'withdraw' && (
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    A {WITHDRAWAL_FEE_PCT}% withdrawal service fee applies to all cashouts. Gross requested amount is held from your wallet until settled.
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Projected Available</span>
                  <span className="font-mono-tabular font-semibold text-white">
                    UGX{' '}
                    {Math.max(
                      0,
                      activeTab === 'deposit'
                        ? availableBalance + Math.max(0, parsedAmount)
                        : availableBalance - Math.max(0, parsedAmount)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {firebaseUser ? (
              <button
                type="submit"
                disabled={submitting}
                className="gold-shimmer-btn w-full rounded-full px-6 py-3 text-sm font-extrabold cursor-pointer disabled:opacity-60"
              >
                {submitting
                  ? activeTab === 'deposit'
                    ? 'Processing Deposit…'
                    : 'Submitting Withdrawal…'
                  : activeTab === 'deposit'
                  ? `Deposit UGX ${Math.max(0, parsedAmount).toLocaleString()}`
                  : `Withdraw UGX ${Math.max(0, parsedAmount).toLocaleString()}`}
              </button>
            ) : (
              <Link
                to="/login"
                className="gold-shimmer-btn w-full rounded-full px-6 py-3 text-center text-sm font-extrabold"
              >
                Sign In to Continue
              </Link>
            )}
          </div>
        </form>
      </div>

      {/* Recent Wallet Transactions */}
      {firebaseUser && (
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-[#FFD76A]" />
              <h2 className="font-display text-lg font-bold text-white">Recent Wallet Activity</h2>
            </div>
            <Link to="/transactions" className="text-xs font-semibold text-[#FFD76A] hover:underline">
              Full Transaction History →
            </Link>
          </div>

          {txLoading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-white">No Deposits or Withdrawals Yet</p>
              <p className="text-xs text-neutral-400">
                Use the deposit form above to credit your UGX wallet and track every transaction here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-[#03130B] text-neutral-400">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Type · Provider</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {transactions.slice(0, 8).map((tx) => {
                    const isCredit =
                      tx.type === 'Deposit' ||
                      tx.type === 'Match Win' ||
                      tx.type === 'Match Winnings' ||
                      tx.type === 'Tournament Prize';
                    const wdBreakdown =
                      tx.type === 'Withdrawal'
                        ? {
                            feeUgx: tx.feeUgx ?? calculateWithdrawalBreakdown(tx.amountUgx).feeUgx,
                            netPayoutUgx:
                              tx.netPayoutUgx ?? calculateWithdrawalBreakdown(tx.amountUgx).netPayoutUgx,
                          }
                        : null;
                    return (
                      <tr key={tx.txId} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-6 py-3 text-neutral-300 font-mono-tabular whitespace-nowrap">
                          {formatTxDate(tx.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-white">{tx.type}</span>
                          <span className="mx-1.5 text-neutral-500">·</span>
                          <span className="text-neutral-300">{tx.provider}</span>
                          {wdBreakdown && (
                            <p className="text-[11px] text-neutral-400 font-mono-tabular">
                              {WITHDRAWAL_FEE_PCT}% fee: -UGX {wdBreakdown.feeUgx.toLocaleString()} · Net: UGX {wdBreakdown.netPayoutUgx.toLocaleString()}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular text-neutral-300 whitespace-nowrap">
                          {tx.reference}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${getStatusTextClass(tx.status)}`}>
                              {tx.status}
                            </span>
                            {tx.type === 'Deposit' && tx.status === 'Pending' && (
                              <button
                                type="button"
                                disabled={verifyingId === tx.txId}
                                onClick={() => void handleVerifyDeposit(tx)}
                                className="text-[11px] font-semibold text-emerald-300 hover:text-white underline cursor-pointer disabled:opacity-50"
                              >
                                {verifyingId === tx.txId ? 'Checking…' : 'Verify Prompt'}
                              </button>
                            )}
                            {tx.type === 'Withdrawal' && tx.status === 'Pending' && (
                              <button
                                type="button"
                                disabled={cancellingId === tx.txId}
                                onClick={() => void handleCancelWithdrawal(tx)}
                                className="text-[11px] font-semibold text-neutral-300 hover:text-white underline cursor-pointer disabled:opacity-50"
                              >
                                {cancellingId === tx.txId ? 'Cancelling…' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-6 py-3 font-mono-tabular font-bold text-right whitespace-nowrap ${
                            isCredit ? 'text-emerald-400' : 'text-[#FFD76A]'
                          }`}
                        >
                          {isCredit ? '+' : '-'}UGX {Number(tx.amountUgx || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return firebaseUser ? <PlayerLayout title="UGX Wallet">{content}</PlayerLayout> : content;
};

export const TransactionsPage: React.FC = () => {
  const { firebaseUser, wallet } = useAuth();
  const verifiedUid = firebaseUser?.emailVerified ? firebaseUser.uid : undefined;
  const { transactions, loading } = useUserTransactions(verifiedUid, 150);

  const [typeFilter, setTypeFilter] = useState<
    'ALL' | 'Deposit' | 'Withdrawal' | 'Game Entry' | 'Tournament Entry' | 'Match Win'
  >('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && tx.status !== statusFilter) return false;
      if (q) {
        const hay = `${tx.reference} ${tx.provider} ${tx.phoneNumber || ''} ${tx.note || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    let deposited = 0;
    let withdrawn = 0;
    let pending = 0;
    for (const tx of transactions) {
      if (tx.type === 'Deposit' && (tx.status === 'Verified' || tx.status === 'Paid')) {
        deposited += Number(tx.amountUgx || 0);
      } else if (tx.type === 'Withdrawal' && tx.status === 'Paid') {
        withdrawn += Number(tx.amountUgx || 0);
      } else if (tx.type === 'Withdrawal' && tx.status === 'Pending') {
        pending += Number(tx.amountUgx || 0);
      }
    }
    return { deposited, withdrawn, pending };
  }, [transactions]);

  const handleCancelWithdrawal = async (tx: TransactionRecord) => {
    if (!firebaseUser) return;
    setActionError('');
    setCancellingId(tx.txId);
    try {
      await cancelPendingWithdrawal(tx);
    } catch (err) {
      setActionError(extractWalletErrorMessage(err, 'Unable to cancel pending withdrawal.'));
    } finally {
      setCancellingId(null);
    }
  };

  const handleVerifyDeposit = async (tx: TransactionRecord) => {
    if (!firebaseUser) return;
    setActionError('');
    setVerifyingId(tx.txId);
    try {
      await verifyPendingDeposit(tx.txId);
    } catch (err) {
      setActionError(extractWalletErrorMessage(err, 'Unable to verify deposit status yet.'));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Date', 'Transaction ID', 'Type', 'Provider', 'Phone', 'Reference', 'Status', 'Amount (UGX)', 'Note'];
    const rows = filteredTransactions.map((tx) => [
      new Date(timestampMs(tx.createdAt) || Date.now()).toISOString(),
      tx.txId,
      tx.type,
      tx.provider,
      tx.phoneNumber || '',
      tx.reference,
      tx.status,
      String(tx.amountUgx),
      (tx.note || '').replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `casino-royale-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PlayerLayout title="Transaction History">
      <div className="space-y-6">
        {/* Top Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5">
            <p className="text-xs text-neutral-400">Available Balance</p>
            <p className="font-mono-tabular text-xl sm:text-2xl font-extrabold text-[#FFD76A] mt-1">
              UGX {(wallet?.availableBalance ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="emerald-card-surface rounded-2xl border border-white/15 p-5">
            <p className="text-xs text-neutral-400">Total Deposited</p>
            <p className="font-mono-tabular text-xl sm:text-2xl font-extrabold text-emerald-400 mt-1">
              UGX {metrics.deposited.toLocaleString()}
            </p>
          </div>
          <div className="emerald-card-surface rounded-2xl border border-white/15 p-5">
            <p className="text-xs text-neutral-400">Pending Withdrawals</p>
            <p className="font-mono-tabular text-xl sm:text-2xl font-extrabold text-amber-300 mt-1">
              UGX {metrics.pending.toLocaleString()}
            </p>
          </div>
          <div className="emerald-card-surface rounded-2xl border border-white/15 p-5">
            <p className="text-xs text-neutral-400">Paid Withdrawals</p>
            <p className="font-mono-tabular text-xl sm:text-2xl font-extrabold text-white mt-1">
              UGX {metrics.withdrawn.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filters & Actions Bar */}
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl border border-white/15 bg-[#03130B]">
              {(
                ['ALL', 'Deposit', 'Withdrawal', 'Game Entry', 'Tournament Entry', 'Match Win'] as const
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTypeFilter(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    typeFilter === tab
                      ? 'bg-[#FFD76A] text-[#110C02]'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {tab === 'ALL'
                    ? 'All Types'
                    : tab === 'Deposit'
                    ? 'Deposits'
                    : tab === 'Withdrawal'
                    ? 'Withdrawals'
                    : tab}
                </button>
              ))}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | TransactionStatus)}
              aria-label="Filter by status"
              className="rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-xs font-medium text-white focus:border-[#FFD76A] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Verified">Verified</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="h-3.5 w-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ref, phone, provider…"
                className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-9 pr-3 py-2 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={filteredTransactions.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/45 bg-[#062919] px-3.5 py-2 text-xs font-semibold text-[#FFD76A] hover:bg-[#0A3C26] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>

            <Link
              to="/wallet?tab=deposit"
              className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap shrink-0"
            >
              <span>Deposit / Withdraw</span>
            </Link>
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl border border-red-500/45 bg-red-950/55 px-4 py-3 text-xs text-red-200">
            {actionError}
          </div>
        )}

        {/* Ledger Table */}
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <ReceiptText className="h-9 w-9 text-[#FFD76A] mx-auto" />
              <h2 className="font-display text-xl font-bold text-white">No Transactions Recorded</h2>
              <p className="text-xs sm:text-sm text-neutral-300 max-w-md mx-auto leading-relaxed">
                Make your first MTN Mobile Money or Airtel Money deposit to see verified credits, payouts, and receipts here.
              </p>
              <Link
                to="/wallet?tab=deposit"
                className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold"
              >
                <span>Make First Deposit</span>
              </Link>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-white">No Matching Transactions</p>
              <p className="text-xs text-neutral-400">
                Try clearing your search or status filter to view all ledger entries.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-[#03130B] text-neutral-400">
                  <tr>
                    <th className="px-6 py-3.5 font-semibold">Date &amp; Time</th>
                    <th className="px-4 py-3.5 font-semibold">Type · Provider</th>
                    <th className="px-4 py-3.5 font-semibold">Reference &amp; Line</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Amount</th>
                    <th className="px-6 py-3.5 font-semibold text-right">Action / Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredTransactions.map((tx) => {
                    const isCredit =
                      tx.type === 'Deposit' ||
                      tx.type === 'Match Win' ||
                      tx.type === 'Match Winnings' ||
                      tx.type === 'Tournament Prize';
                    const wdBreakdown =
                      tx.type === 'Withdrawal'
                        ? {
                            feeUgx: tx.feeUgx ?? calculateWithdrawalBreakdown(tx.amountUgx).feeUgx,
                            netPayoutUgx:
                              tx.netPayoutUgx ?? calculateWithdrawalBreakdown(tx.amountUgx).netPayoutUgx,
                          }
                        : null;
                    return (
                      <tr key={tx.txId} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-6 py-3.5 text-neutral-300 font-mono-tabular whitespace-nowrap">
                          {formatTxDate(tx.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-semibold text-white">{tx.type}</span>
                          <span className="mx-1.5 text-neutral-500">·</span>
                          <span className="text-neutral-300">{tx.provider}</span>
                          {wdBreakdown && (
                            <p className="text-[11px] text-neutral-400 font-mono-tabular">
                              {WITHDRAWAL_FEE_PCT}% fee: -UGX {wdBreakdown.feeUgx.toLocaleString()} · Net: UGX {wdBreakdown.netPayoutUgx.toLocaleString()}
                            </p>
                          )}
                          {tx.note && (
                            <p className="text-[11px] text-neutral-400 truncate max-w-[220px]">{tx.note}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono-tabular whitespace-nowrap">
                          <p className="text-neutral-200">{tx.reference}</p>
                          {tx.phoneNumber && (
                            <p className="text-[11px] text-neutral-400">{tx.phoneNumber}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 font-bold ${getStatusTextClass(tx.status)}`}>
                            {tx.status === 'Pending' && <Clock className="h-3 w-3" />}
                            <span>{tx.status}</span>
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3.5 font-mono-tabular font-bold text-right whitespace-nowrap ${
                            isCredit ? 'text-emerald-400' : 'text-[#FFD76A]'
                          }`}
                        >
                          {isCredit ? '+' : '-'}UGX {Number(tx.amountUgx || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                          {tx.type === 'Deposit' && tx.status === 'Pending' ? (
                            <button
                              type="button"
                              disabled={verifyingId === tx.txId}
                              onClick={() => void handleVerifyDeposit(tx)}
                              className="rounded-lg border border-emerald-400/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-950/60 cursor-pointer disabled:opacity-50"
                            >
                              {verifyingId === tx.txId ? 'Checking…' : 'Verify Prompt'}
                            </button>
                          ) : tx.type === 'Withdrawal' && tx.status === 'Pending' ? (
                            <button
                              type="button"
                              disabled={cancellingId === tx.txId}
                              onClick={() => void handleCancelWithdrawal(tx)}
                              className="rounded-lg border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-neutral-200 hover:border-red-400 hover:text-red-300 cursor-pointer disabled:opacity-50"
                            >
                              {cancellingId === tx.txId ? 'Cancelling…' : 'Cancel'}
                            </button>
                          ) : (
                            <span className="text-neutral-500 font-mono-tabular">
                              {typeof tx.balanceAfter === 'number'
                                ? `Bal ${tx.balanceAfter.toLocaleString()}`
                                : '—'}
                            </span>
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
    </PlayerLayout>
  );
};

export const NotificationsPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeStore(() => setTick((t) => t + 1));
  }, []);

  const items: NotificationRecord[] = useMemo(() => {
    if (!firebaseUser) return [];
    const list = getStore().notifications[firebaseUser.uid] || [];
    return [...list].sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
  }, [firebaseUser]);

  const markRead = (id: string) => {
    if (!firebaseUser) return;
    const list = getStore().notifications[firebaseUser.uid] || [];
    const target = list.find((n) => n.notificationId === id);
    if (target) {
      target.read = true;
      notifyStore();
    }
  };

  return (
    <PlayerLayout title="Notifications">
      <div className="max-w-3xl space-y-3">
        {items.length === 0 ? (
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/25 p-8 text-center space-y-2">
            <Bell className="h-8 w-8 text-[#FFD76A] mx-auto" />
            <p className="text-sm font-semibold text-white">You&apos;re all caught up</p>
            <p className="text-xs text-neutral-400">
              KYC updates, tournament pairings, and security notices appear here.
            </p>
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.notificationId}
              className={`emerald-card-surface rounded-xl border p-4 flex items-start justify-between gap-4 ${
                n.read ? 'border-white/10 opacity-75' : 'border-[#D4AF37]/45'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#FFD76A]" />
                  <span className="font-bold text-white">{n.title}</span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-[#FFD76A] capitalize">{n.category || n.type || 'info'}</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">{n.message}</p>
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => markRead(n.notificationId)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:border-[#FFD76A] hover:text-[#FFD76A] shrink-0 cursor-pointer"
                >
                  <Check className="h-3 w-3" />
                  <span>Mark Read</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </PlayerLayout>
  );
};

export const GameHistoryPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeStore(() => setTick((t) => t + 1));
  }, []);

  const history: GameHistoryRecord[] = useMemo(() => {
    if (!firebaseUser) return [];
    return getStore()
      .gameHistory.filter((g) => g.playerUids.includes(firebaseUser.uid))
      .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))
      .slice(0, 50);
  }, [firebaseUser]);

  return (
    <PlayerLayout title="Match History">
      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/25 p-8 text-center space-y-3">
            <History className="h-8 w-8 text-[#FFD76A] mx-auto" />
            <p className="text-sm font-semibold text-white">No Completed Matches Yet</p>
            <p className="text-xs text-neutral-400">
              Complete a match in the lobby to record verified wins and match history.
            </p>
            <Link
              to="/play"
              className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold"
            >
              <span>Play Now</span>
            </Link>
          </div>
        ) : (
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 overflow-hidden">
            <div className="divide-y divide-white/10">
              {history.map((g) => {
                const won = g.winnerUid === firebaseUser?.uid;
                return (
                  <div
                    key={g.historyId}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Trophy className={`h-4 w-4 ${won ? 'text-[#FFD76A]' : 'text-neutral-500'}`} />
                        <span>{g.summary || `Match ${g.gameId}`}</span>
                      </div>
                      <p className="text-xs text-neutral-400 font-mono-tabular">
                        Mode: {g.mode} · Winner: {g.winnerName} · Duration: {g.durationSeconds}s
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        won ? 'text-emerald-400' : 'text-neutral-400'
                      }`}
                    >
                      {won ? 'Victory' : 'Completed'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PlayerLayout>
  );
};
