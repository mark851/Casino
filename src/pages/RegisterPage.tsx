import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { getStore, notifyStore } from '../lib/localStore';
import {
  calculateAgeFromDob,
  clampStr,
  isValidUgandanOrIntlPhone,
  normalizePhoneToE164,
} from '../utils/validation';
import kampalaPlayersImg from '../assets/images/kampala_players_showcase_1794598743984.jpg';
import crownCrestImg from '../assets/images/matatu_crown_crest_1794421555026.jpg';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { registerWithEmail, signInWithGoogle } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+256 ');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = fullName.trim();
    if (cleanName.length < 2) {
      setError('Enter your full legal name as shown on your National ID or Passport.');
      return;
    }
    if (!email.trim()) {
      setError('Enter a valid email address.');
      return;
    }
    if (!isValidUgandanOrIntlPhone(phone)) {
      setError('Enter a valid Ugandan or international phone number (e.g. +256 700 412 890).');
      return;
    }
    const normalizedPhone = normalizePhoneToE164(phone) || phone.trim();
    const age = calculateAgeFromDob(dateOfBirth);
    if (!dateOfBirth || age < 18) {
      setError('You must be at least 18 years old to register on CASINO ROYALE.');
      return;
    }
    if (password.length < 8) {
      setError('Choose a strong password of at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms & Conditions and 18+ Responsible Gaming Policy.');
      return;
    }

    setBusy(true);
    try {
      await registerWithEmail({
        fullName: cleanName,
        email: email.trim(),
        phone: normalizedPhone,
        dateOfBirth,
        password,
      });
      navigate('/verification-status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickMemberRegister = async () => {
    setError('');
    const age = calculateAgeFromDob(dateOfBirth);
    if (!dateOfBirth || age < 18 || !isValidUgandanOrIntlPhone(phone) || !termsAccepted) {
      setError(
        'Enter your valid Ugandan phone number, 18+ Date of Birth, and accept Terms before continuing.'
      );
      return;
    }
    setBusy(true);
    try {
      const targetEmail = email.trim() || `contender_${Date.now().toString(36)}@casinoroyale.ug`;
      const user = await signInWithGoogle(targetEmail);
      const normalizedPhone = normalizePhoneToE164(phone) || phone.trim();
      const s = getStore();
      if (s.users[user.uid]) {
        const cleanName = clampStr(fullName.trim() || user.displayName || 'Matatu Player', 120);
        s.users[user.uid].fullName = cleanName;
        s.users[user.uid].phone = normalizedPhone;
        s.users[user.uid].dateOfBirth = dateOfBirth;
        s.users[user.uid].updatedAt = Date.now();
        if (s.playerProfiles[user.uid]) {
          s.playerProfiles[user.uid].displayName = clampStr(cleanName, 80);
          s.playerProfiles[user.uid].updatedAt = Date.now();
        }
        notifyStore();
      }
      navigate('/verification-status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick registration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hero-arena-bg py-10 px-4">
      <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[0.92fr_1.08fr] rounded-2xl overflow-hidden border border-[#D4AF37]/40 emerald-card-surface shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        {/* Left Visual Showcase */}
        <div className="relative overflow-hidden bg-[#03190F] flex flex-col justify-between p-7 sm:p-8 border-b lg:border-b-0 lg:border-r border-[#D4AF37]/25">
          <img
            src={kampalaPlayersImg}
            alt="Kampala Matatu players"
            className="absolute inset-0 h-full w-full object-cover opacity-30"
            referrerPolicy="no-referrer"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-[#03190F]/90 via-[#03190F]/80 to-[#020C07]/95"
          />

          <div className="relative z-10 space-y-5">
            <img
              src={crownCrestImg}
              alt="CASINO ROYALE Crown Crest"
              className="h-18 w-18 rounded-2xl border border-[#FFD76A]/65 object-cover shadow-lg"
              referrerPolicy="no-referrer"
            />
            <div className="space-y-2">
              <p className="text-xs font-bold tracking-[0.2em] text-[#FFD76A] uppercase">
                18+ Verified Onboarding
              </p>
              <h1 className="font-display text-3xl font-bold text-white leading-tight">
                Join CASINO ROYALE
              </h1>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Create your verified player account, submit your National ID or Passport for fast compliance review, deposit via Mobile Money, and take your seat at Kampala&apos;s premier card &amp; board tables.
              </p>
            </div>
          </div>

          <ul className="relative z-10 space-y-2.5 text-xs text-neutral-200 pt-6 border-t border-white/10 mt-6">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#9CE800] shrink-0" />
              <span>Unique Player ID assigned automatically</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#9CE800] shrink-0" />
              <span>Encrypted confidential KYC document vault</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#9CE800] shrink-0" />
              <span>18+ Identity-Verified UGX Gaming Platform</span>
            </li>
          </ul>
        </div>

        {/* Right Registration Form */}
        <div className="p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-white mb-1">Create Account</h2>
          <p className="text-xs text-neutral-400 mb-5">
            Use your real legal details matching your Ugandan National ID, Passport, or Driving Permit.
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Full Legal Name</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Namukasa"
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Date of Birth (18+)</label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-9 pr-3 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+256 700 412 890"
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-9 pr-9 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#FFD76A] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-neutral-300 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 accent-[#D4AF37]"
              />
              <span>
                I confirm I am 18+ years old and agree to the{' '}
                <Link to="/terms" className="text-[#FFD76A] hover:underline">
                  Terms &amp; Conditions
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-[#FFD76A] hover:underline">
                  Privacy &amp; KYC Policy
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="gold-shimmer-btn w-full rounded-full py-3 text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Creating Account…' : 'Create Verified Account'}
            </button>
          </form>

          <button
            type="button"
            disabled={busy}
            onClick={handleQuickMemberRegister}
            className="mt-3 w-full rounded-full border border-[#D4AF37]/45 bg-[#052315] py-2.5 text-xs font-semibold text-white hover:bg-[#083B24] transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="h-4 w-4 text-[#FFD76A]" />
            <span>Quick Member Onboarding (using DOB &amp; Phone above)</span>
          </button>

          <p className="mt-4 text-center text-xs text-neutral-400">
            Already registered?{' '}
            <Link to="/login" className="text-[#FFD76A] font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
