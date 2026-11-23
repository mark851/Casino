import { fetchApiJson, getApiAuthToken } from './apiClient';
import {
  getStore,
  notifyStore,
  pushNotification,
  upsertWalletAndTxFromServer,
} from './localStore';
import { clampStr, generatePlayerId } from '../utils/validation';
import type { MobileMoneyProvider, TransactionRecord, WalletRecord } from '../shared/types';

export const MIN_DEPOSIT_UGX = 1000;
export const MAX_DEPOSIT_UGX = 5000000;
export const MIN_WITHDRAWAL_UGX = 1000;
export const MAX_WITHDRAWAL_UGX = 5000000;
export const WITHDRAWAL_FEE_RATE = 0.02;
export const MIN_GAME_STAKE_UGX = 1000;
export const MAX_GAME_STAKE_UGX = 1000000;
export const MIN_TOURNAMENT_ENTRY_UGX = 1000;

export function calculateWithdrawalBreakdown(grossAmountUgx: number) {
  const grossUgx = Math.max(0, Math.round(grossAmountUgx));
  const feeUgx = Math.round(grossUgx * WITHDRAWAL_FEE_RATE);
  const netPayoutUgx = Math.max(0, grossUgx - feeUgx);
  return { grossUgx, feeUgx, netPayoutUgx };
}

export function extractWalletErrorMessage(err: unknown, fallback = 'Wallet operation failed.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

function makeRef(prefix: string): string {
  return `CR-${prefix}-${Math.floor(100000 + Math.random() * 899999)}`;
}

export async function ensureWalletExists(uid: string, playerId?: string): Promise<WalletRecord> {
  const s = getStore();
  if (!s.wallets[uid]) {
    s.wallets[uid] = {
      uid,
      playerId: playerId || s.users[uid]?.playerId || generatePlayerId(uid),
      currency: 'UGX',
      availableBalance: 0,
      pendingBalance: 0,
      realMoneyEnabled: true,
      regulatoryNotice: '18+ Identity-Verified UGX Mobile Money Gaming Account.',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    notifyStore();
  }
  return s.wallets[uid];
}

export async function submitDeposit(params: {
  uid: string;
  playerId?: string;
  provider: MobileMoneyProvider;
  phoneNumber: string;
  amountUgx: number;
  note?: string;
}): Promise<{ txId: string; reference: string; status: 'Verified' | 'Pending'; balanceAfter: number }> {
  const amount = Math.round(Number(params.amountUgx));
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_UGX || amount > MAX_DEPOSIT_UGX) {
    throw new Error(
      `Deposit must be between UGX ${MIN_DEPOSIT_UGX.toLocaleString()} and UGX ${MAX_DEPOSIT_UGX.toLocaleString()}.`
    );
  }

  if (getApiAuthToken()) {
    const res = await fetchApiJson<{ tx: TransactionRecord; wallet: WalletRecord }>(
      '/api/wallet/deposit',
      {
        method: 'POST',
        body: JSON.stringify({
          provider: params.provider,
          phoneNumber: clampStr(params.phoneNumber, 32),
          amountUgx: amount,
          note: clampStr(params.note || '', 200),
        }),
      }
    );
    upsertWalletAndTxFromServer(res.wallet, res.tx);
    const txStatus = res.tx.status === 'Pending' ? 'Pending' : 'Verified';
    pushNotification(params.uid, {
      title: txStatus === 'Verified' ? 'Deposit Credited' : 'Approve MoMo PIN Prompt',
      message:
        txStatus === 'Verified'
          ? `UGX ${amount.toLocaleString()} via ${params.provider} (Ref ${res.tx.reference}) added to your wallet.`
          : `Confirm the UGX ${amount.toLocaleString()} MarzPay Mobile Money prompt on ${params.phoneNumber} (Ref ${res.tx.reference}).`,
      category: 'wallet',
    });
    return {
      txId: res.tx.txId,
      reference: res.tx.reference,
      status: txStatus,
      balanceAfter: res.wallet.availableBalance,
    };
  }

  const wallet = await ensureWalletExists(params.uid, params.playerId);
  const s = getStore();
  const nextBal = (wallet.availableBalance || 0) + amount;
  wallet.availableBalance = nextBal;
  wallet.updatedAt = Date.now();

  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const reference = makeRef('DEP');
  const tx: TransactionRecord = {
    txId,
    transactionId: txId,
    uid: params.uid,
    playerId: wallet.playerId,
    type: 'Deposit',
    provider: params.provider,
    phoneNumber: clampStr(params.phoneNumber, 32),
    amountUgx: amount,
    feeUgx: 0,
    netAmountUgx: amount,
    netPayoutUgx: amount,
    balanceAfter: nextBal,
    status: 'Verified',
    reference,
    description: `${params.provider} Deposit`,
    note: clampStr(params.note || '', 200),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  s.transactions[txId] = tx;
  pushNotification(params.uid, {
    title: 'Deposit Credited',
    message: `UGX ${amount.toLocaleString()} via ${params.provider} (Ref ${reference}) added to your wallet.`,
    category: 'wallet',
  });
  notifyStore();
  return { txId, reference, status: 'Verified', balanceAfter: nextBal };
}

export async function submitWithdrawal(params: {
  uid: string;
  playerId?: string;
  provider: MobileMoneyProvider;
  phoneNumber: string;
  amountUgx: number;
  note?: string;
}): Promise<{
  txId: string;
  reference: string;
  feeUgx: number;
  netPayoutUgx: number;
  status: 'Pending';
  balanceAfter: number;
}> {
  const amount = Math.round(Number(params.amountUgx));
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_UGX || amount > MAX_WITHDRAWAL_UGX) {
    throw new Error(
      `Withdrawal must be between UGX ${MIN_WITHDRAWAL_UGX.toLocaleString()} and UGX ${MAX_WITHDRAWAL_UGX.toLocaleString()}.`
    );
  }

  if (getApiAuthToken()) {
    const res = await fetchApiJson<{ tx: TransactionRecord; wallet: WalletRecord }>(
      '/api/wallet/withdraw',
      {
        method: 'POST',
        body: JSON.stringify({
          provider: params.provider,
          phoneNumber: clampStr(params.phoneNumber, 32),
          amountUgx: amount,
          note: clampStr(params.note || '', 200),
        }),
      }
    );
    upsertWalletAndTxFromServer(res.wallet, res.tx);
    pushNotification(params.uid, {
      title: 'Withdrawal Requested',
      message: `UGX ${amount.toLocaleString()} withdrawal (${res.tx.reference}) is pending payout settlement.`,
      category: 'wallet',
    });
    return {
      txId: res.tx.txId,
      reference: res.tx.reference,
      feeUgx: res.tx.feeUgx ?? 0,
      netPayoutUgx: res.tx.netPayoutUgx ?? amount,
      status: 'Pending',
      balanceAfter: res.wallet.availableBalance,
    };
  }

  const wallet = await ensureWalletExists(params.uid, params.playerId);
  if (wallet.availableBalance < amount) {
    throw new Error(
      `Insufficient UGX available balance (UGX ${wallet.availableBalance.toLocaleString()}).`
    );
  }
  const { feeUgx, netPayoutUgx } = calculateWithdrawalBreakdown(amount);
  const s = getStore();
  const nextAvail = wallet.availableBalance - amount;
  wallet.availableBalance = nextAvail;
  wallet.pendingBalance = (wallet.pendingBalance || 0) + amount;
  wallet.updatedAt = Date.now();

  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const reference = makeRef('WDR');
  s.transactions[txId] = {
    txId,
    transactionId: txId,
    uid: params.uid,
    playerId: wallet.playerId,
    type: 'Withdrawal',
    provider: params.provider,
    phoneNumber: clampStr(params.phoneNumber, 32),
    amountUgx: amount,
    feeUgx,
    netAmountUgx: netPayoutUgx,
    netPayoutUgx,
    balanceAfter: nextAvail,
    status: 'Pending',
    reference,
    description: `${params.provider} Payout Request`,
    note: clampStr(params.note || '', 200),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  pushNotification(params.uid, {
    title: 'Withdrawal Requested',
    message: `UGX ${amount.toLocaleString()} withdrawal (${reference}) is pending payout settlement.`,
    category: 'wallet',
  });
  notifyStore();
  return {
    txId,
    reference,
    feeUgx,
    netPayoutUgx,
    status: 'Pending',
    balanceAfter: nextAvail,
  };
}

export async function cancelPendingWithdrawal(tx: TransactionRecord): Promise<void> {
  if (getApiAuthToken()) {
    const res = await fetchApiJson<{ tx: TransactionRecord; wallet: WalletRecord }>(
      `/api/wallet/withdraw/${encodeURIComponent(tx.txId)}/cancel`,
      { method: 'POST' }
    );
    upsertWalletAndTxFromServer(res.wallet, res.tx);
    return;
  }

  const s = getStore();
  const existing = s.transactions[tx.txId];
  if (!existing || existing.status !== 'Pending') {
    throw new Error('Only pending withdrawals can be cancelled.');
  }
  const wallet = await ensureWalletExists(existing.uid, existing.playerId);
  wallet.availableBalance += existing.amountUgx;
  wallet.pendingBalance = Math.max(0, (wallet.pendingBalance || 0) - existing.amountUgx);
  wallet.updatedAt = Date.now();

  existing.status = 'Cancelled';
  existing.updatedAt = Date.now();
  notifyStore();
}

export async function verifyPendingDeposit(
  txId: string
): Promise<{ status: TransactionRecord['status']; balanceAfter: number }> {
  if (!getApiAuthToken()) {
    throw new Error('Sign in with an active server session to verify MarzPay deposits.');
  }
  const res = await fetchApiJson<{ tx: TransactionRecord; wallet: WalletRecord }>(
    `/api/wallet/deposit/${encodeURIComponent(txId)}/verify`,
    { method: 'POST' }
  );
  upsertWalletAndTxFromServer(res.wallet, res.tx);
  return {
    status: res.tx.status,
    balanceAfter: res.wallet.availableBalance,
  };
}

export async function adminSettleWithdrawal(
  tx: TransactionRecord,
  decision: 'Paid' | 'Rejected',
  adminUid = 'admin'
): Promise<void> {
  if (getApiAuthToken()) {
    const res = await fetchApiJson<{ tx: TransactionRecord; wallet: WalletRecord }>(
      `/api/admin/transactions/${encodeURIComponent(tx.txId)}/settle`,
      {
        method: 'POST',
        body: JSON.stringify({ decision }),
      }
    );
    upsertWalletAndTxFromServer(res.wallet, res.tx);
    return;
  }

  const s = getStore();
  const existing = s.transactions[tx.txId];
  if (!existing || existing.status !== 'Pending') {
    throw new Error('This withdrawal has already been settled.');
  }
  const wallet = await ensureWalletExists(existing.uid, existing.playerId);
  wallet.pendingBalance = Math.max(0, (wallet.pendingBalance || 0) - existing.amountUgx);
  if (decision === 'Rejected') {
    wallet.availableBalance += existing.amountUgx;
  }
  wallet.updatedAt = Date.now();

  existing.status = decision;
  existing.reviewedBy = adminUid;
  existing.updatedAt = Date.now();

  pushNotification(existing.uid, {
    title: decision === 'Paid' ? 'Withdrawal Paid' : 'Withdrawal Refunded',
    message:
      decision === 'Paid'
        ? `Your withdrawal ${existing.reference} (UGX ${(existing.netPayoutUgx || existing.amountUgx).toLocaleString()} net) has been marked Paid.`
        : `Your withdrawal ${existing.reference} was declined and UGX ${existing.amountUgx.toLocaleString()} was returned to available balance.`,
    category: 'wallet',
  });
  notifyStore();
}

export async function payGameEntryStake(params: {
  uid: string;
  playerId?: string;
  amountUgx: number;
  gameLabel: string;
  relatedId?: string;
}): Promise<{ reference: string; balanceAfter: number }> {
  const amount = Math.round(Number(params.amountUgx));
  if (!Number.isFinite(amount) || amount < MIN_GAME_STAKE_UGX || amount > MAX_GAME_STAKE_UGX) {
    throw new Error(
      `Game entry stake must be between UGX ${MIN_GAME_STAKE_UGX.toLocaleString()} and UGX ${MAX_GAME_STAKE_UGX.toLocaleString()}.`
    );
  }

  if (getApiAuthToken()) {
    const res = await fetchApiJson<{ tx: TransactionRecord; wallet: WalletRecord }>(
      '/api/wallet/stake',
      {
        method: 'POST',
        body: JSON.stringify({
          amountUgx: amount,
          gameLabel: params.gameLabel,
          relatedId: params.relatedId,
        }),
      }
    );
    upsertWalletAndTxFromServer(res.wallet, res.tx);
    return {
      reference: res.tx.reference,
      balanceAfter: res.wallet.availableBalance,
    };
  }

  const wallet = await ensureWalletExists(params.uid, params.playerId);
  if (wallet.availableBalance < amount) {
    throw new Error(
      `Insufficient UGX balance (UGX ${wallet.availableBalance.toLocaleString()}). Deposit at least UGX ${amount.toLocaleString()} to play.`
    );
  }
  const s = getStore();
  wallet.availableBalance -= amount;
  wallet.updatedAt = Date.now();

  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const reference = makeRef('ENT');
  s.transactions[txId] = {
    txId,
    transactionId: txId,
    uid: params.uid,
    playerId: wallet.playerId,
    type: 'Game Entry',
    provider: 'System',
    amountUgx: amount,
    feeUgx: 0,
    netAmountUgx: amount,
    netPayoutUgx: amount,
    balanceAfter: wallet.availableBalance,
    status: 'Completed',
    reference,
    description: params.gameLabel,
    note: params.gameLabel,
    relatedId: params.relatedId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  notifyStore();
  return { reference, balanceAfter: wallet.availableBalance };
}

export async function creditMatchWinnings(params: {
  uid: string;
  playerId?: string;
  amountUgx: number;
  gameLabel: string;
  relatedId?: string;
}): Promise<{ reference: string; balanceAfter: number }> {
  const amount = Math.round(Number(params.amountUgx));
  if (!Number.isFinite(amount) || amount <= 0) {
    const wallet = await ensureWalletExists(params.uid, params.playerId);
    return { reference: 'NONE', balanceAfter: wallet.availableBalance };
  }

  if (getApiAuthToken()) {
    const res = await fetchApiJson<{ tx: TransactionRecord; wallet: WalletRecord }>(
      '/api/wallet/win',
      {
        method: 'POST',
        body: JSON.stringify({
          amountUgx: amount,
          gameLabel: params.gameLabel,
          relatedId: params.relatedId,
        }),
      }
    );
    upsertWalletAndTxFromServer(res.wallet, res.tx);
    pushNotification(params.uid, {
      title: 'Match Winnings Paid',
      message: `+UGX ${amount.toLocaleString()} credited for ${params.gameLabel} (Ref ${res.tx.reference}).`,
      category: 'wallet',
    });
    return {
      reference: res.tx.reference,
      balanceAfter: res.wallet.availableBalance,
    };
  }

  const wallet = await ensureWalletExists(params.uid, params.playerId);
  const s = getStore();
  wallet.availableBalance += amount;
  wallet.updatedAt = Date.now();

  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const reference = makeRef('WIN');
  s.transactions[txId] = {
    txId,
    transactionId: txId,
    uid: params.uid,
    playerId: wallet.playerId,
    type: 'Match Win',
    provider: 'System',
    amountUgx: amount,
    feeUgx: 0,
    netAmountUgx: amount,
    netPayoutUgx: amount,
    balanceAfter: wallet.availableBalance,
    status: 'Completed',
    reference,
    description: params.gameLabel,
    note: params.gameLabel,
    relatedId: params.relatedId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  pushNotification(params.uid, {
    title: 'Match Winnings Paid',
    message: `+UGX ${amount.toLocaleString()} credited for ${params.gameLabel} (Ref ${reference}).`,
    category: 'wallet',
  });
  notifyStore();
  return { reference, balanceAfter: wallet.availableBalance };
}
