import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crown, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import heroTableBg from '../assets/images/hero_matatu_table_1794421555126.jpg';
import ugandaEmblemImg from '../assets/images/uganda_flag_emblem_1794598745119.jpg';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithEmail, signInWithGoogle, signInDemoPlayer, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email.trim() || !password) {
      setError('Enter your registered email address and password.');
      return;
    }
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await signInDemoPlayer();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email address first so we know where to send the reset link.');
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      setNotice('Password reset instructions prepared for your email address.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset notice.');
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-12 hero-arena-bg overflow-hidden">
      <img
        src={heroTableBg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
      />
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden border border-[#D4AF37]/40 emerald-card-surface shadow-[0_24px_60px_rgba(0,0,0,0.85)]">
        {/* Left Graphic Showcase Panel */}
        <div className="hidden md:flex flex-col justify-between p-8 bg-gradient-to-br from-[#063B24]/95 via-[#031F13]/95 to-[#020E08] border-r border-[#D4AF37]/25">
          <div className="space-y-4">
            <img
              src={ugandaEmblemImg}
              alt="CASINO ROYALE Crested Crane Crest"
              className="h-24 w-24 rounded-2xl border border-[#FFD76A]/65 object-cover shadow-[0_10px_28px_rgba(212,175,55,0.3)]"
              referrerPolicy="no-referrer"
            />
            <h1 className="font-display text-3xl font-bold text-white leading-tight">
              Return to the Kampala Tables
            </h1>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Sign in to access your verified player profile, daily single-elimination brackets, and live multiplayer Matatu, Chess, and Uganda Drafts rooms.
            </p>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-[#FFD76A] pt-6 border-t border-white/10">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>18+ Identity-Verified Member &amp; Wallet Protection</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-6 sm:p-8 flex flex-col justify-center">
          <div className="space-y-1 mb-6">
            <p className="text-xs font-bold tracking-wider text-[#FFD76A] uppercase flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5" />
              <span>Player Sign In</span>
            </p>
            <h2 className="font-display text-2xl font-bold text-white">Welcome Back</h2>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs text-red-200">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-xs text-emerald-200">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@casinoroyale.ug"
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#FFD76A] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[#FFD76A] hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="gold-shimmer-btn w-full rounded-full py-3 text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Signing In…' : 'Sign In'}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-neutral-500">
            <span className="h-[1px] flex-1 bg-white/10" />
            <span>or</span>
            <span className="h-[1px] flex-1 bg-white/10" />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={handleDemoLogin}
              className="w-full rounded-full border border-emerald-400/50 bg-[#052918] py-2.5 text-xs font-bold text-emerald-300 hover:bg-[#083D24] transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Demo Verified Player (Samuel Musoke · UGX 45,000)</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleGoogle}
              className="w-full rounded-full border border-[#D4AF37]/45 bg-[#052315] py-2.5 text-sm font-semibold text-white hover:bg-[#083B24] transition-colors cursor-pointer"
            >
              Continue with Verified Member Profile
            </button>
          </div>

          <p className="mt-5 text-center text-xs text-neutral-400">
            New to CASINO ROYALE?{' '}
            <Link to="/register" className="text-[#FFD76A] font-semibold hover:underline">
              Create your verified account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
