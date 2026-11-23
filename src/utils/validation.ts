export const MAX_KYC_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_KYC_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function clampStr(val: string, maxLen: number): string {
  return String(val || '').trim().slice(0, maxLen);
}

export function generatePlayerId(uid: string): string {
  const clean = (uid || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = (clean + 'KMP256').slice(0, 6);
  return `CR-${suffix}`;
}

export function calculateAgeFromDob(dob: string): number {
  if (!dob) return 0;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const m = now.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age;
}

export function isValidUgandanOrIntlPhone(raw: string): boolean {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  return digits.length >= 9 && digits.length <= 16;
}

export function normalizePhoneToE164(raw: string): string {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0')) return `+256${cleaned.slice(1)}`;
  if (cleaned.startsWith('256')) return `+${cleaned}`;
  return `+${cleaned}`;
}

export function maskIdReference(raw: string): string {
  const clean = raw.trim();
  if (clean.length <= 4) return clean;
  return `${'*'.repeat(Math.max(2, clean.length - 4))}${clean.slice(-4)}`;
}

export function timestampMs(ts: unknown): number {
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const p = Date.parse(ts);
    return Number.isFinite(p) ? p : 0;
  }
  if (ts && typeof ts === 'object') {
    const obj = ts as { toMillis?: () => number; seconds?: number };
    if (typeof obj.toMillis === 'function') return obj.toMillis();
    if (typeof obj.seconds === 'number') return obj.seconds * 1000;
  }
  return 0;
}
