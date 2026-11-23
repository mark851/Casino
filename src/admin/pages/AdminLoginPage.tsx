import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, KeyRound, Lock, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { fetchApiJson } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../../lib/localStore';
import ugandaEmblemImg from '../../assets/images/uganda_flag_emblem_1794598745119.jpg';

interface AdminStatusResponse {
  adminConfigured: boolean;
  envPasscodeActive: boolean;
  bootstrappedEmail: string;
}

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    firebaseUser,
    authReady,
    dataLoading,
    isAdmin,
    signInAdmin,
    claimAdminPassword,
    logout,
  } = useAuth();
  const [email, setEmail] = useState<string>(BOOTSTRAPPED_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminStatus, setAdminStatus] = useState<AdminStatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    let active = true;
    void fetchApiJson<AdminStatusResponse>('/api/auth/admin-status')
      .then((res) => {
        if (!active) return;
        setAdminStatus(res);
        if (res.bootstrappedEmail) {
          setEmail(res.bootstrappedEmail);
        }
      })
      .catch(() => {
        if (active) {
          setAdminStatus({
            adminConfigured: true,
            envPasscodeActive: false,
            bootstrappedEmail: BOOTSTRAPPED_ADMIN_EMAIL,
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const isFirstRunSetup = Boolean(adminStatus && !adminStatus.adminConfigured);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your administrator email and password.');
      return;
    }
    if (isFirstRunSetup) {
      if (password.length < 8) {
        setError('Create an administrator password with at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      if (isFirstRunSetup) {
        await claimAdminPassword(email.trim(), password);
      } else {
        await signInAdmin(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const signedInWithoutAdmin = Boolean(firebaseUser && authReady && !dataLoading && !isAdmin);

  return (
    <div className="min-h-screen hero-arena-bg text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md emerald-card-surface rounded-2xl border border-[#D4AF37]/45 p-7 sm:p-8 space-y-6 shadow-[0_24px_60px_rgba(0,0,0,0.85)]">
        <div className="flex items-center gap-4">
          <img
            src={ugandaEmblemImg}
            alt="CASINO ROYALE Admin Crest"
            className="h-14 w-14 rounded-xl border border-[#FFD76A]/60 object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#FFD76A] uppercase flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Operations &amp; cPanel Portal</span>
            </p>
            <h1 className="font-display text-2xl font-bold text-white">
              {isFirstRunSetup ? 'Set Admin Password' : 'Administrator Sign In'}
            </h1>
          </div>
        </div>

        {isFirstRunSetup && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/45 px-4 py-3 text-xs text-emerald-100 flex items-start gap-2.5">
            <KeyRound className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-200">First-Run Admin Claim</p>
              <p className="mt-0.5 text-emerald-100/85">
                Claim your administrator passcode for <span className="font-mono-tabular">{BOOTSTRAPPED_ADMIN_EMAIL}</span> to manage databases, deposits, withdrawals, and Spaceship cPanel.
              </p>
            </div>
          </div>
        )}

        {signedInWithoutAdmin && (
          <div className="rounded-xl border border-amber-500/45 bg-amber-950/45 px-4 py-3 text-xs text-amber-100 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">
                  Signed in as {firebaseUser?.email || 'player account'}
                </p>
                <p className="mt-0.5 text-amber-100/90">
                  Authenticate below with administrator credentials or sign out first.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-900/40 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/70 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out Current Session</span>
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Administrator Email"
              autoComplete="email"
              className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isFirstRunSetup ? 'Create Password (min 8 chars)' : 'Admin Password'}
              autoComplete={isFirstRunSetup ? 'new-password' : 'current-password'}
              className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
            />
          </div>

          {isFirstRunSetup && (
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Admin Password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="gold-shimmer-btn w-full rounded-full py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60"
          >
            {busy
              ? 'Authenticating…'
              : isFirstRunSetup
              ? 'Save Password & Enter Console'
              : 'Enter Admin Console'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-white/10">
          <Link to="/" className="text-xs text-neutral-400 hover:text-[#FFD76A]">
            Open Player Website
          </Link>
        </div>
      </div>
    </div>
  );
};
