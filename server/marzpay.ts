import crypto from 'node:crypto';
import net from 'node:net';

export interface MarzPayConfigStatus {
  configured: boolean;
  webhookSecretConfigured: boolean;
  baseUrl: string;
  country: string;
}

export interface MarzPayBalanceResult {
  configured: boolean;
  connected: boolean;
  currency: string;
  availableBalanceUgx?: number;
  raw?: Record<string, unknown>;
  message: string;
}

export interface MarzPayTransferResult {
  uuid: string;
  reference: string;
  status: 'completed' | 'pending' | 'failed';
  provider: string;
  phoneNumber: string;
  amountUgx: number;
  message: string;
}

const DEFAULT_MARZPAY_BASE_URL = 'https://wallet.wearemarz.com/api/v1';

function isBlockedPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h === '::1') return true;
  if (net.isIP(h)) {
    if (
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h.startsWith('10.') ||
      h.startsWith('192.168.') ||
      h.startsWith('169.254.')
    ) {
      return true;
    }
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
    if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  }
  return false;
}

export function getValidatedMarzPayBaseUrl(): string {
  const raw = (process.env.MARZPAY_BASE_URL || DEFAULT_MARZPAY_BASE_URL).trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid MARZPAY_BASE_URL configuration.');
  }
  const host = parsed.hostname.toLowerCase();
  const allowedHost = host === 'wearemarz.com' || host.endsWith('.wearemarz.com');
  if (parsed.protocol !== 'https:' || !allowedHost || isBlockedPrivateHost(host)) {
    throw new Error('MARZPAY_BASE_URL must point to an official HTTPS wearemarz.com endpoint.');
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

export function isMarzPayConfigured(): boolean {
  const key = (process.env.MARZPAY_API_KEY || '').trim();
  const secret = (process.env.MARZPAY_API_SECRET || '').trim();
  return Boolean(key && secret);
}

export function getMarzPayConfigStatus(): MarzPayConfigStatus {
  let baseUrl = DEFAULT_MARZPAY_BASE_URL;
  try {
    baseUrl = getValidatedMarzPayBaseUrl();
  } catch {
    baseUrl = DEFAULT_MARZPAY_BASE_URL;
  }
  return {
    configured: isMarzPayConfigured(),
    webhookSecretConfigured: Boolean((process.env.MARZPAY_WEBHOOK_SECRET || '').trim()),
    baseUrl,
    country: (process.env.MARZPAY_COUNTRY || 'UG').trim().toUpperCase() || 'UG',
  };
}

function getMarzPayAuthHeader(): string {
  const key = (process.env.MARZPAY_API_KEY || '').trim();
  const secret = (process.env.MARZPAY_API_SECRET || '').trim();
  if (!key || !secret) {
    throw new Error('MarzPay API credentials (MARZPAY_API_KEY and MARZPAY_API_SECRET) are not configured.');
  }
  const encoded = Buffer.from(`${key}:${secret}`, 'utf8').toString('base64');
  return `Basic ${encoded}`;
}

export function normalizeUgPhoneNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/[^\d+]/g, '');
  let normalized = digits;

  if (/^\+256\d{9}$/.test(digits)) {
    normalized = digits;
  } else if (/^256\d{9}$/.test(digits)) {
    normalized = `+${digits}`;
  } else if (/^0\d{9}$/.test(digits)) {
    normalized = `+256${digits.slice(1)}`;
  } else if (/^[73]\d{8}$/.test(digits)) {
    normalized = `+256${digits}`;
  } else {
    throw new Error(
      'Enter a valid Ugandan Mobile Money number (e.g. +256772123456 or 0772123456).'
    );
  }

  return normalized;
}

function getSafeWebhookCallbackUrl(): string | undefined {
  const rawAppUrl = (process.env.APP_URL || '').trim();
  if (!rawAppUrl) return undefined;
  try {
    const parsed = new URL(rawAppUrl);
    if (parsed.protocol !== 'https:' || isBlockedPrivateHost(parsed.hostname)) {
      return undefined;
    }
    return `${parsed.origin}/api/webhooks/marzpay`;
  } catch {
    return undefined;
  }
}

function mapMarzPayStatus(rawStatus: unknown): 'completed' | 'pending' | 'failed' {
  const s = String(rawStatus || '').trim().toLowerCase();
  if (s === 'completed' || s === 'successful' || s === 'success' || s === 'paid') {
    return 'completed';
  }
  if (s === 'failed' || s === 'rejected' || s === 'cancelled' || s === 'expired' || s === 'error') {
    return 'failed';
  }
  return 'pending';
}

function sanitizeUuid(raw: string): string {
  const clean = raw.trim();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(clean)) {
    throw new Error('Invalid MarzPay transaction identifier.');
  }
  return clean;
}

async function detectOutboundIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(3000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: unknown };
    const ip = typeof data?.ip === 'string' ? data.ip.trim() : '';
    return ip && net.isIP(ip) ? ip : null;
  } catch {
    return null;
  }
}

async function marzpayRequest(
  method: 'GET' | 'POST',
  endpointPath: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const baseUrl = getValidatedMarzPayBaseUrl();
  const url = `${baseUrl}${endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`}`;
  const headers: Record<string, string> = {
    Authorization: getMarzPayAuthHeader(),
    Accept: 'application/json',
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      const jsonVal = JSON.parse(text);
      if (jsonVal && typeof jsonVal === 'object') {
        parsed = jsonVal as Record<string, unknown>;
      }
    } catch {
      parsed = { message: text.slice(0, 240) };
    }
  }

  if (!res.ok) {
    let errMsg =
      (typeof parsed.message === 'string' && parsed.message) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      `MarzPay API returned HTTP ${res.status}.`;
    if (/not whitelisted|ip whitelist/i.test(errMsg)) {
      const reportedIp =
        (typeof parsed.ip === 'string' && net.isIP(parsed.ip.trim()) ? parsed.ip.trim() : null) ||
        (await detectOutboundIp());
      if (reportedIp) {
        errMsg = `${errMsg} (Server outbound IP: ${reportedIp})`;
      }
    }
    throw new Error(errMsg);
  }

  return parsed;
}

function extractTxObject(payload: Record<string, unknown>): Record<string, unknown> {
  const data = payload.data && typeof payload.data === 'object'
    ? (payload.data as Record<string, unknown>)
    : payload;
  if (data.transaction && typeof data.transaction === 'object') {
    return data.transaction as Record<string, unknown>;
  }
  return data;
}

export async function marzpayCollectMoney(params: {
  amountUgx: number;
  phoneNumber: string;
  reference: string;
  description: string;
  metadata?: Array<Record<string, string | number>>;
}): Promise<MarzPayTransferResult> {
  const normalizedPhone = normalizeUgPhoneNumber(params.phoneNumber);
  const country = (process.env.MARZPAY_COUNTRY || 'UG').trim().toUpperCase() || 'UG';
  const callbackUrl = getSafeWebhookCallbackUrl();
  const uuidRef = crypto.randomUUID();

  const reqPayload: Record<string, unknown> = {
    amount: Math.round(params.amountUgx),
    phone_number: normalizedPhone,
    country,
    reference: uuidRef,
    description: params.description.slice(0, 160),
    metadata: [
      { casinoReference: params.reference },
      ...(params.metadata || []).slice(0, 8),
    ],
  };
  if (callbackUrl) {
    reqPayload.callback_url = callbackUrl;
  }

  const response = await marzpayRequest('POST', '/collect-money', reqPayload);
  const txObj = extractTxObject(response);
  const status = mapMarzPayStatus(txObj.status ?? response.status);
  const providerUuid = String(txObj.uuid || txObj.id || uuidRef);

  return {
    uuid: providerUuid,
    reference: params.reference,
    status,
    provider: String(txObj.provider || 'mobile_money'),
    phoneNumber: normalizedPhone,
    amountUgx: Math.round(params.amountUgx),
    message: String(response.message || 'Collection prompt sent to Mobile Money handset.'),
  };
}

export async function marzpaySendMoney(params: {
  amountUgx: number;
  phoneNumber: string;
  reference: string;
  description: string;
  metadata?: Array<Record<string, string | number>>;
}): Promise<MarzPayTransferResult> {
  const normalizedPhone = normalizeUgPhoneNumber(params.phoneNumber);
  const country = (process.env.MARZPAY_COUNTRY || 'UG').trim().toUpperCase() || 'UG';
  const callbackUrl = getSafeWebhookCallbackUrl();
  const uuidRef = crypto.randomUUID();

  const reqPayload: Record<string, unknown> = {
    amount: Math.round(params.amountUgx),
    phone_number: normalizedPhone,
    country,
    reference: uuidRef,
    description: params.description.slice(0, 160),
    metadata: [
      { casinoReference: params.reference },
      ...(params.metadata || []).slice(0, 8),
    ],
  };
  if (callbackUrl) {
    reqPayload.callback_url = callbackUrl;
  }

  const response = await marzpayRequest('POST', '/send-money', reqPayload);
  const txObj = extractTxObject(response);
  const status = mapMarzPayStatus(txObj.status ?? response.status);
  const providerUuid = String(txObj.uuid || txObj.id || uuidRef);

  return {
    uuid: providerUuid,
    reference: params.reference,
    status,
    provider: String(txObj.provider || 'mobile_money'),
    phoneNumber: normalizedPhone,
    amountUgx: Math.round(params.amountUgx),
    message: String(response.message || 'Disbursement initiated via MarzPay.'),
  };
}

export async function marzpayGetTransaction(uuid: string): Promise<{
  uuid: string;
  reference: string;
  status: 'completed' | 'pending' | 'failed';
  amountUgx: number;
  raw: Record<string, unknown>;
}> {
  const safeUuid = sanitizeUuid(uuid);
  const response = await marzpayRequest('GET', `/transactions/${encodeURIComponent(safeUuid)}`);
  const txObj = extractTxObject(response);
  const amountRaw =
    txObj.amount && typeof txObj.amount === 'object'
      ? Number((txObj.amount as Record<string, unknown>).raw || 0)
      : Number(txObj.amount || 0);

  return {
    uuid: String(txObj.uuid || safeUuid),
    reference: String(txObj.reference || ''),
    status: mapMarzPayStatus(txObj.status ?? response.status),
    amountUgx: Number.isFinite(amountRaw) ? Math.round(amountRaw) : 0,
    raw: txObj,
  };
}

export async function marzpayGetBalance(): Promise<MarzPayBalanceResult> {
  if (!isMarzPayConfigured()) {
    return {
      configured: false,
      connected: false,
      currency: 'UGX',
      message:
        'MarzPay API keys (MARZPAY_API_KEY and MARZPAY_API_SECRET) are not configured yet. Wallet deposits & withdrawals run on local server ledger until keys are added.',
    };
  }

  try {
    const response = await marzpayRequest('GET', '/balance');
    const data =
      response.data && typeof response.data === 'object'
        ? (response.data as Record<string, unknown>)
        : response;

    const rawAvail =
      (data.balance && typeof data.balance === 'object'
        ? (data.balance as Record<string, unknown>).raw ?? (data.balance as Record<string, unknown>).available
        : undefined) ??
      data.available_balance ??
      data.balance ??
      0;

    const availableNum = Number(rawAvail);
    return {
      configured: true,
      connected: true,
      currency: String(data.currency || 'UGX'),
      availableBalanceUgx: Number.isFinite(availableNum) ? Math.round(availableNum) : undefined,
      raw: data,
      message: 'Connected to MarzPay API (wallet.wearemarz.com). Live collections & disbursements enabled.',
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      currency: 'UGX',
      message:
        err instanceof Error
          ? `MarzPay API check failed: ${err.message}`
          : 'Unable to reach MarzPay API.',
    };
  }
}

export function verifyMarzPayWebhookSignature(params: {
  rawBody: string;
  signatureHeader?: string;
  timestampHeader?: string;
}): boolean {
  const secret = (process.env.MARZPAY_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return false;
  }
  const provided = (params.signatureHeader || '').trim().replace(/^sha256=/i, '');
  if (!provided) return false;

  const candidates = params.timestampHeader
    ? [`${params.timestampHeader}.${params.rawBody}`, params.rawBody]
    : [params.rawBody];

  for (const payload of candidates) {
    const expectedHex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(provided.toLowerCase(), 'utf8');
    const b = Buffer.from(expectedHex.toLowerCase(), 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}
