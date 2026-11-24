import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp, ensureDbReady } from '../server/apiApp.ts';

const app = createApiApp();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      const rewrittenPath = parsed.searchParams.get('__path');
      if (rewrittenPath !== null) {
        parsed.searchParams.delete('__path');
        const query = parsed.searchParams.toString();
        const cleanSubPath = rewrittenPath.replace(/^\/+/, '');
        req.url = `/api/${cleanSubPath}${query ? `?${query}` : ''}`;
      }
    } catch {
      // Keep original req.url if URL parsing fails
    }
  }

  await ensureDbReady();
  app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
