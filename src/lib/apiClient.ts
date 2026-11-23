export class ApiUnavailableError extends Error {
  constructor(message = 'Unable to reach the CASINO ROYALE application server.') {
    super(message);
    this.name = 'ApiUnavailableError';
  }
}

let inMemoryAuthToken: string | null = null;

export function setApiAuthToken(token: string | null): void {
  inMemoryAuthToken = token && token.trim() ? token.trim() : null;
}

export function getApiAuthToken(): string | null {
  return inMemoryAuthToken;
}

export function isApiUnavailableError(err: unknown): boolean {
  if (err instanceof ApiUnavailableError) return true;
  const msg = err instanceof Error ? err.message : String(err || '');
  return /unable to reach|failed to fetch|networkerror|load failed/i.test(msg);
}

function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryAuthToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAuthToken}`);
  }
  return headers;
}

function resolvePhpFallbackUrl(url: string): string | null {
  if (!url.startsWith('/api/')) return null;
  const route = url.slice(5).replace(/^\/+/, '');
  if (!route) return '/api.php?route=health';
  return `/api.php?route=${encodeURIComponent(route)}`;
}

async function fetchWithPhpFallback(url: string, init?: RequestInit): Promise<Response> {
  const opts: RequestInit = {
    ...init,
    headers: buildHeaders(init),
  };

  let response: Response;
  try {
    response = await fetch(url, opts);
  } catch (err) {
    throw new ApiUnavailableError(
      err instanceof Error ? err.message : 'Network error communicating with server.'
    );
  }

  // When running on Apache/cPanel PHP without Node.js and without mod_rewrite,
  // /api/* returns a 404 HTML page; transparently fall back to /api.php?route=...
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const phpUrl = resolvePhpFallbackUrl(url);
  if (response.status === 404 && phpUrl && !contentType.includes('application/json') && !contentType.includes('application/sql')) {
    try {
      return await fetch(phpUrl, opts);
    } catch {
      return response;
    }
  }

  return response;
}

export async function fetchApiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithPhpFallback(url, init);
  const text = await response.text();
  let parsed: Record<string, unknown> | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const serverMsg =
      (parsed && typeof parsed.error === 'string' && parsed.error) ||
      (parsed && typeof parsed.message === 'string' && parsed.message) ||
      `Request failed with status ${response.status}.`;
    throw new Error(serverMsg);
  }

  return (parsed ?? {}) as T;
}

export async function fetchApiText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetchWithPhpFallback(url, init);
  const text = await response.text();
  if (!response.ok) {
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      throw new Error(parsed.error || parsed.message || `Request failed (${response.status}).`);
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message && !parseErr.message.includes('JSON')) {
        throw parseErr;
      }
      throw new Error(`Request failed with status ${response.status}.`);
    }
  }
  return text;
}

