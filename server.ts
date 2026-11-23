import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  dbAdminManualDepositOrAdjustment,
  dbAdminSettleWithdrawal,
  dbCancelWithdrawal,
  dbClaimAdminPassword,
  dbCreditMatchWinnings,
  dbGetAdminOverview,
  dbGetDemoPlayer,
  dbGetPlayerHydration,
  dbLoginPlayer,
  dbPayGameEntryStake,
  dbReconcileMarzPayWebhook,
  dbRegisterPlayer,
  dbResolveSupportTicket,
  dbReviewKyc,
  dbSubmitDeposit,
  dbSubmitKyc,
  dbSubmitSupportTicket,
  dbSubmitWithdrawal,
  dbTogglePlayerStatus,
  dbUpdateSystemSettings,
  dbVerifyAdminLogin,
  dbVerifyMarzPayDeposit,
  generateSqlDump,
  getAdminAuthStatus,
  getDatabaseDiagnostics,
  getServerState,
  initServerDatabase,
  syncSchemaNow,
  testCpanelUapiConnection,
} from './server/db.ts';
import {
  getMarzPayConfigStatus,
  marzpayGetBalance,
  verifyMarzPayWebhookSignature,
} from './server/marzpay.ts';
import type { KycStatus, MobileMoneyProvider } from './src/shared/types.ts';

interface AuthClaims {
  uid: string;
  email: string;
  role: 'player' | 'admin';
  exp: number;
}

interface AuthedRequest extends Request {
  auth?: AuthClaims;
}

const SESSION_SECRET =
  (process.env.SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');

const VALID_PROVIDERS = new Set<MobileMoneyProvider>([
  'MTN Mobile Money',
  'Airtel Money',
  'MTN',
  'Airtel',
  'System',
]);

const VALID_KYC_STATUSES = new Set<KycStatus>([
  'Approved',
  'Rejected',
  'Resubmission Required',
  'Suspended',
]);

function signToken(claims: Omit<AuthClaims, 'exp'>): string {
  const payload: AuthClaims = {
    ...claims,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): AuthClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AuthClaims;
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const claims = token ? verifyToken(token) : null;
  if (!claims) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const state = await getServerState();
  const user = state.users[claims.uid];
  if (!user || user.accountStatus === 'Suspended') {
    res.status(403).json({ error: 'Account inactive or suspended.' });
    return;
  }
  req.auth = { ...claims, role: user.role };
  next();
}

async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    if (!req.auth || req.auth.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }
    next();
  });
}

function getErrMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

async function startServer() {
  await initServerDatabase();

  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // MarzPay Webhook Callback (mounted with raw body for exact HMAC verification)
  app.post(
    '/api/webhooks/marzpay',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req, res) => {
      try {
        const rawBody = Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body || {});

        const cfg = getMarzPayConfigStatus();
        if (cfg.webhookSecretConfigured) {
          const sigHeader = String(req.headers['x-marzpay-signature'] || '');
          const tsHeader = String(req.headers['x-marzpay-timestamp'] || '');
          const valid = verifyMarzPayWebhookSignature({
            rawBody,
            signatureHeader: sigHeader,
            timestampHeader: tsHeader,
          });
          if (!valid) {
            res.status(401).json({ error: 'Invalid MarzPay webhook signature.' });
            return;
          }
        }

        const parsed = JSON.parse(rawBody || '{}') as Record<string, unknown>;
        const txBlock =
          (parsed.transaction && typeof parsed.transaction === 'object'
            ? (parsed.transaction as Record<string, unknown>)
            : parsed.data &&
              typeof parsed.data === 'object' &&
              (parsed.data as Record<string, unknown>).transaction &&
              typeof (parsed.data as Record<string, unknown>).transaction === 'object'
            ? ((parsed.data as Record<string, unknown>).transaction as Record<string, unknown>)
            : parsed) || {};

        const uuid = String(txBlock.uuid || txBlock.id || '').trim();
        const reference = String(txBlock.reference || '').trim();
        if (!uuid) {
          res.status(400).json({ error: 'Missing transaction uuid in webhook payload.' });
          return;
        }

        const result = await dbReconcileMarzPayWebhook({ uuid, reference });
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(400).json({ error: getErrMessage(err, 'Unable to process MarzPay webhook.') });
      }
    }
  );

  app.use(express.json({ limit: '6mb' }));

  // ── Public Health & Auth Endpoints ──────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    const diag = await getDatabaseDiagnostics();
    res.json({ ok: true, driver: diag.driver, connected: diag.connected });
  });

  app.get('/api/auth/admin-status', async (_req, res) => {
    const state = await getServerState();
    res.json(getAdminAuthStatus(state));
  });

  app.post('/api/auth/admin-claim', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const adminUser = await dbClaimAdminPassword(email, password);
      const token = signToken({ uid: adminUser.uid, email: adminUser.email, role: 'admin' });
      const overview = await dbGetAdminOverview();
      res.json({ token, user: adminUser, overview });
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to configure admin credentials.') });
    }
  });

  app.post('/api/auth/admin-login', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const adminUser = await dbVerifyAdminLogin(email, password);
      const token = signToken({ uid: adminUser.uid, email: adminUser.email, role: 'admin' });
      const overview = await dbGetAdminOverview();
      res.json({ token, user: adminUser, overview });
    } catch (err) {
      res.status(401).json({ error: getErrMessage(err, 'Administrator authentication failed.') });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const user = await dbRegisterPlayer({
        fullName: String(req.body?.fullName || ''),
        email: String(req.body?.email || ''),
        phone: String(req.body?.phone || ''),
        dateOfBirth: String(req.body?.dateOfBirth || '1995-01-01'),
        password: String(req.body?.password || ''),
      });
      const token = signToken({ uid: user.uid, email: user.email, role: user.role });
      const hydration = await dbGetPlayerHydration(user.uid);
      res.json({ token, user, hydration });
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Registration failed.') });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const user = await dbLoginPlayer(
        String(req.body?.email || ''),
        String(req.body?.password || '')
      );
      const token = signToken({ uid: user.uid, email: user.email, role: user.role });
      const hydration = await dbGetPlayerHydration(user.uid);
      const overview = user.role === 'admin' ? await dbGetAdminOverview() : null;
      res.json({ token, user, hydration, overview });
    } catch (err) {
      res.status(401).json({ error: getErrMessage(err, 'Sign-in failed.') });
    }
  });

  app.post('/api/auth/demo-player', async (_req, res) => {
    try {
      const user = await dbGetDemoPlayer();
      const token = signToken({ uid: user.uid, email: user.email, role: 'player' });
      const hydration = await dbGetPlayerHydration(user.uid);
      res.json({ token, user, hydration });
    } catch (err) {
      res.status(500).json({ error: getErrMessage(err, 'Demo player unavailable.') });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthedRequest, res) => {
    const uid = req.auth!.uid;
    const hydration = await dbGetPlayerHydration(uid);
    if (!hydration) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    const overview = req.auth!.role === 'admin' ? await dbGetAdminOverview() : null;
    res.json({ hydration, overview });
  });

  // ── Player Wallet (Deposits & Withdrawals) ──────────────────────────────────
  app.get('/api/wallet/transactions', requireAuth, async (req: AuthedRequest, res) => {
    const hydration = await dbGetPlayerHydration(req.auth!.uid);
    res.json({
      wallet: hydration?.wallet || null,
      transactions: hydration?.transactions || [],
    });
  });

  app.post('/api/wallet/deposit', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const provider = String(req.body?.provider || 'MTN Mobile Money') as MobileMoneyProvider;
      if (!VALID_PROVIDERS.has(provider)) {
        res.status(400).json({ error: 'Unsupported Mobile Money provider.' });
        return;
      }
      const result = await dbSubmitDeposit({
        uid: req.auth!.uid,
        provider,
        phoneNumber: String(req.body?.phoneNumber || ''),
        amountUgx: Number(req.body?.amountUgx),
        note: typeof req.body?.note === 'string' ? req.body.note : '',
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Deposit failed.') });
    }
  });

  app.post('/api/wallet/deposit/:txId/verify', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const txId = String(req.params.txId || '');
      const result = await dbVerifyMarzPayDeposit({
        txId,
        requesterUid: req.auth!.uid,
        isAdmin: req.auth!.role === 'admin',
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to verify deposit status.') });
    }
  });

  app.post('/api/wallet/withdraw', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const provider = String(req.body?.provider || 'MTN Mobile Money') as MobileMoneyProvider;
      if (!VALID_PROVIDERS.has(provider)) {
        res.status(400).json({ error: 'Unsupported Mobile Money provider.' });
        return;
      }
      const result = await dbSubmitWithdrawal({
        uid: req.auth!.uid,
        provider,
        phoneNumber: String(req.body?.phoneNumber || ''),
        amountUgx: Number(req.body?.amountUgx),
        note: typeof req.body?.note === 'string' ? req.body.note : '',
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Withdrawal failed.') });
    }
  });

  app.post('/api/wallet/withdraw/:txId/cancel', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const txId = String(req.params.txId || '');
      const result = await dbCancelWithdrawal(req.auth!.uid, txId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to cancel withdrawal.') });
    }
  });

  app.post('/api/wallet/stake', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const result = await dbPayGameEntryStake({
        uid: req.auth!.uid,
        amountUgx: Number(req.body?.amountUgx),
        gameLabel: String(req.body?.gameLabel || 'Table Stake').slice(0, 120),
        relatedId: typeof req.body?.relatedId === 'string' ? req.body.relatedId.slice(0, 120) : undefined,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to deduct stake.') });
    }
  });

  app.post('/api/wallet/win', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const result = await dbCreditMatchWinnings({
        uid: req.auth!.uid,
        amountUgx: Number(req.body?.amountUgx),
        gameLabel: String(req.body?.gameLabel || 'Match Winnings').slice(0, 120),
        relatedId: typeof req.body?.relatedId === 'string' ? req.body.relatedId.slice(0, 120) : undefined,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to credit winnings.') });
    }
  });

  // ── KYC & Support Player Submissions ────────────────────────────────────────
  app.post('/api/kyc/submit', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const uid = req.auth!.uid;
      const body = req.body || {};
      await dbSubmitKyc(uid, {
        verification_id: String(body.verification_id || uid),
        uid,
        player_id: String(body.player_id || ''),
        legal_name: String(body.legal_name || '').slice(0, 120),
        date_of_birth: String(body.date_of_birth || ''),
        id_type: body.id_type || 'National ID',
        id_number_reference: body.id_number_reference ? String(body.id_number_reference).slice(0, 80) : undefined,
        front_image_storage_path: String(body.front_image_storage_path || ''),
        back_image_storage_path: String(body.back_image_storage_path || ''),
        verification_status: 'Pending Verification',
        submitted_at: Date.now(),
        resubmission_count: Number(body.resubmission_count || 0),
        updatedAt: Date.now(),
      });
      const hydration = await dbGetPlayerHydration(uid);
      res.json({ ok: true, hydration });
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'KYC submission failed.') });
    }
  });

  app.post('/api/support/tickets', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const uid = req.auth!.uid;
      const state = await getServerState();
      const user = state.users[uid];
      const ticketId = `tkt_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
      const now = Date.now();
      const ticket = {
        ticketId,
        uid,
        playerId: user?.playerId || '',
        playerName: user?.fullName || 'Player',
        name: user?.fullName || 'Player',
        email: user?.email || '',
        subject: String(req.body?.subject || 'Support Request').slice(0, 120),
        category: String(req.body?.category || 'General').slice(0, 60),
        message: String(req.body?.message || '').slice(0, 1500),
        status: 'Open' as const,
        createdAt: now,
        updatedAt: now,
      };
      await dbSubmitSupportTicket(ticket);
      res.json({ ticket });
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to submit ticket.') });
    }
  });

  // ── Admin & Spaceship cPanel Database Access Endpoints ─────────────────────
  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    const overview = await dbGetAdminOverview();
    res.json({ overview });
  });

  app.get('/api/admin/transactions', requireAdmin, async (_req, res) => {
    const overview = await dbGetAdminOverview();
    res.json({
      transactions: Object.values(overview.transactions),
      wallets: overview.wallets,
      users: overview.users,
    });
  });

  app.post('/api/admin/transactions/:txId/settle', requireAdmin, async (req: AuthedRequest, res) => {
    try {
      const decision = req.body?.decision === 'Paid' ? 'Paid' : req.body?.decision === 'Rejected' ? 'Rejected' : null;
      if (!decision) {
        res.status(400).json({ error: 'Decision must be Paid or Rejected.' });
        return;
      }
      const result = await dbAdminSettleWithdrawal({
        txId: String(req.params.txId || ''),
        decision,
        adminUid: req.auth!.uid,
        adminEmail: req.auth!.email,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to settle withdrawal.') });
    }
  });

  app.post('/api/admin/transactions/manual', requireAdmin, async (req: AuthedRequest, res) => {
    try {
      const provider = String(req.body?.provider || 'MTN Mobile Money') as MobileMoneyProvider;
      if (!VALID_PROVIDERS.has(provider)) {
        res.status(400).json({ error: 'Unsupported payment provider.' });
        return;
      }
      const kind = req.body?.kind === 'Admin Adjustment' ? 'Admin Adjustment' : 'Deposit';
      const result = await dbAdminManualDepositOrAdjustment({
        targetUid: String(req.body?.targetUid || ''),
        amountUgx: Number(req.body?.amountUgx),
        kind,
        provider,
        note: String(req.body?.note || ''),
        adminUid: req.auth!.uid,
        adminEmail: req.auth!.email,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to credit wallet.') });
    }
  });

  app.post('/api/admin/kyc/:uid/decision', requireAdmin, async (req: AuthedRequest, res) => {
    try {
      const status = req.body?.status as KycStatus;
      if (!VALID_KYC_STATUSES.has(status)) {
        res.status(400).json({ error: 'Invalid KYC decision status.' });
        return;
      }
      const updated = await dbReviewKyc({
        targetUid: String(req.params.uid || ''),
        status,
        reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
        adminUid: req.auth!.uid,
        adminEmail: req.auth!.email,
      });
      res.json({ kyc: updated });
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to update KYC status.') });
    }
  });

  app.post('/api/admin/players/:uid/status', requireAdmin, async (req: AuthedRequest, res) => {
    try {
      const accountStatus = req.body?.accountStatus === 'Suspended' ? 'Suspended' : 'Active';
      const user = await dbTogglePlayerStatus({
        targetUid: String(req.params.uid || ''),
        accountStatus,
        adminUid: req.auth!.uid,
        adminEmail: req.auth!.email,
      });
      res.json({ user });
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to update player status.') });
    }
  });

  app.post('/api/admin/support/:ticketId/resolve', requireAdmin, async (req: AuthedRequest, res) => {
    try {
      await dbResolveSupportTicket({
        ticketId: String(req.params.ticketId || ''),
        reply: String(req.body?.reply || 'Resolved by Kampala Operations.'),
        adminUid: req.auth!.uid,
        adminEmail: req.auth!.email,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to resolve ticket.') });
    }
  });

  app.post('/api/admin/settings', requireAdmin, async (req: AuthedRequest, res) => {
    try {
      const updated = await dbUpdateSystemSettings(
        {
          brandName: typeof req.body?.brandName === 'string' ? req.body.brandName.slice(0, 80) : undefined,
          contactPhone: typeof req.body?.contactPhone === 'string' ? req.body.contactPhone.slice(0, 40) : undefined,
          contactEmail: typeof req.body?.contactEmail === 'string' ? req.body.contactEmail.slice(0, 120) : undefined,
          maintenanceMode: typeof req.body?.maintenanceMode === 'boolean' ? req.body.maintenanceMode : undefined,
          matatuRules: req.body?.matatuRules || undefined,
        },
        req.auth!.uid,
        req.auth!.email
      );
      res.json({ systemSettings: updated });
    } catch (err) {
      res.status(400).json({ error: getErrMessage(err, 'Unable to update settings.') });
    }
  });

  // ── Spaceship cPanel Database Management Endpoints ──────────────────────────
  app.get('/api/admin/cpanel/status', requireAdmin, async (_req, res) => {
    const [diagnostics, cpanel] = await Promise.all([
      getDatabaseDiagnostics(),
      testCpanelUapiConnection(),
    ]);
    res.json({ diagnostics, cpanel });
  });

  app.post('/api/admin/cpanel/sync-schema', requireAdmin, async (_req, res) => {
    try {
      const diagnostics = await syncSchemaNow();
      res.json({ ok: true, diagnostics });
    } catch (err) {
      res.status(500).json({ error: getErrMessage(err, 'Schema sync failed.') });
    }
  });

  app.post('/api/admin/cpanel/test-connection', requireAdmin, async (_req, res) => {
    const [diagnostics, cpanel] = await Promise.all([
      getDatabaseDiagnostics(),
      testCpanelUapiConnection(),
    ]);
    res.json({ diagnostics, cpanel });
  });

  app.get('/api/admin/marzpay/status', requireAdmin, async (_req, res) => {
    const config = getMarzPayConfigStatus();
    const balance = await marzpayGetBalance();
    res.json({ config, balance });
  });

  app.get('/api/admin/cpanel/export-sql', requireAdmin, async (_req, res) => {
    const sql = await generateSqlDump();
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="casinoroyale-cpanel-${new Date().toISOString().slice(0, 10)}.sql"`
    );
    res.send(sql);
  });

  // ── Frontend Middleware / Production Static Serving ──────────────────────────
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`CASINO ROYALE server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
