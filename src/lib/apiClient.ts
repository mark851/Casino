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

function resolvePhpFallbackUrls(url: string): string[] {
  if (!url.startsWith('/api/')) return [];
  const route = url.slice(5).replace(/^\/+/, '');
  const qs = route ? encodeURIComponent(route) : 'health';
  return [`/api.php?route=${qs}`, `api.php?route=${qs}`];
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

  // When running on Apache/cPanel PHP without Node.js and without mod_rewrite (or if SPA rewrite
  // served index.html), /api/* returns HTML instead of JSON; transparently fall back to api.php?route=...
  const isHtmlFallbackOr404 = (res: Response) => {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const isBinaryOrApi = ct.includes('application/json') || ct.includes('application/sql');
    if (ct.includes('text/html')) return true;
    return res.status === 404 && !isBinaryOrApi;
  };

  if (isHtmlFallbackOr404(response)) {
    for (const phpUrl of resolvePhpFallbackUrls(url)) {
      try {
        const retry = await fetch(phpUrl, opts);
        if (!isHtmlFallbackOr404(retry)) {
          return retry;
        }
        response = retry;
      } catch {
        // Keep trying next fallback URL
      }
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

  if (text && parsed === null) {
    throw new Error('Server returned an unexpected HTML/non-JSON response. Check api.php and .htaccess in cPanel.');
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

