import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  Headphones,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { BrandMark } from './BrandMark';

const NAV_LINKS = [
  { to: '/', label: 'Home', showHomeIcon: true },
  { to: '/play', label: 'Play' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/how-to-play', label: 'How to Play' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/wallet', label: 'Wallet' },
  { to: '/support', label: 'Support' },
  { to: '/contact', label: 'Contact' },
];

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, isAdmin, systemSettings, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const cleanWhatsapp = (systemSettings.whatsappNumber || '256700412890').replace(/[^\d]/g, '');

  return (
    <div className="min-h-screen flex flex-col bg-[#050806] text-white">
      {systemSettings.maintenanceMode && !isAdmin && (
        <div className="bg-[#D4AF37] text-[#050806] px-4 py-2 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Scheduled maintenance is currently active. Gameplay tables may temporarily pause while updates complete.</span>
        </div>
      )}

      {/* Luxury Obsidian-Emerald Header */}
      <header className="sticky top-0 z-40 border-b border-[#D4AF37]/35 bg-gradient-to-b from-[#071D12]/98 via-[#04140C]/98 to-[#030B07]/98 shadow-[0_8px_30px_rgba(0,0,0,0.75)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 py-2">
          {/* Zone 1: Brand Lockup */}
          <Link
            to="/"
            className="whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD76A] rounded-lg py-0.5"
          >
            <BrandMark brandName={systemSettings.brandName} logoUrl={systemSettings.logoUrl} />
          </Link>

          {/* Zone 2: Primary Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-3 text-[13px] font-medium">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
                    isActive
                      ? 'gold-shimmer-btn font-bold text-[#110C02]'
                      : 'text-neutral-200 hover:text-[#FFD76A] hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.showHomeIcon && isActive && <Home className="h-3.5 w-3.5 shrink-0" />}
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Zone 3: Auth & Primary Action */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            {firebaseUser ? (
              <>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/60 bg-[#052416] px-4 py-1.5 text-[13px] font-semibold text-[#FFD76A] hover:bg-[#083B24] transition-colors whitespace-nowrap shrink-0"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#070E0A] px-3.5 py-1.5 text-[13px] font-medium text-neutral-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/65 bg-[#041D11] px-4 py-1.5 text-[13px] font-semibold text-[#FFD76A] hover:bg-[#07331E] transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Login</span>
                </Link>
                <Link
                  to="/register"
                  className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-bold transition-all whitespace-nowrap shrink-0"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Register</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D4AF37]/40 bg-[#041C11] text-[#FFD76A] cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[#D4AF37]/20 bg-[#021D12] px-4 py-5 space-y-4">
            <div className="flex flex-col space-y-1.5">
              {NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                      isActive ? 'gold-shimmer-btn font-bold text-[#110C02]' : 'text-neutral-200 hover:bg-white/5'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="pt-3 border-t border-white/10 flex items-center gap-3">
              {firebaseUser ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="gold-shimmer-btn flex-1 text-center rounded-full px-4 py-2.5 text-sm font-bold"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      void logout();
                    }}
                    className="flex-1 rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-neutral-200"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center rounded-full border border-[#D4AF37]/50 px-4 py-2.5 text-sm font-semibold text-[#FFD76A]"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="gold-shimmer-btn flex-1 text-center rounded-full px-4 py-2.5 text-sm font-bold"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Luxury Bottom Trust Bar & Legal Footer */}
      <footer className="border-t border-[#D4AF37]/35 bg-gradient-to-b from-[#03160D] via-[#020E08] to-[#020704] text-neutral-300">
        {/* Top Signature Ribbon Matching Reference Design */}
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-5">
          {/* Left: Payment Integration + Security Seal */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-5">
            {/* MTN Mobile Money Mark */}
            <Link
              to="/wallet"
              title="MTN Mobile Money Uganda — Instant UGX Deposits & Withdrawals"
              className="inline-flex items-center gap-2 group"
            >
              <span className="inline-flex items-center justify-center rounded-full bg-[#FFCC00] px-2.5 py-0.5 text-[11px] font-black tracking-tight text-[#111827] border border-[#050806]">
                MTN
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] font-bold text-white group-hover:text-[#FFD76A] transition-colors">
                  Mobile Money
                </span>
                <span className="text-[9px] text-neutral-400">Instant UGX Deposits</span>
              </span>
            </Link>

            {/* Airtel Money Mark */}
            <Link
              to="/wallet"
              title="Airtel Money Uganda — Verified UGX Deposits & Payouts"
              className="inline-flex items-center gap-2 group"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E11D2E] text-white text-xs font-black">
                a
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] font-bold text-[#FF5A65] group-hover:text-[#FFD76A] transition-colors lowercase">
                  airtel money
                </span>
                <span className="text-[9px] text-neutral-400">Verified UGX Payouts</span>
              </span>
            </Link>

            <span className="hidden sm:inline-block h-7 w-[1px] bg-[#D4AF37]/30" aria-hidden="true" />

            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#FFD76A] shrink-0" />
              <span className="text-xs font-semibold text-white">Real-Money UGX Stakes · Verified Platform</span>
            </div>
          </div>

          {/* Center: Play Responsibly Ribbon */}
          <Link
            to="/responsible-gaming"
            className="flex items-center gap-3 group shrink-0"
          >
            <span className="h-[1px] w-10 sm:w-14 bg-gradient-to-r from-transparent to-[#D4AF37]" />
            <span className="font-display italic text-base sm:text-lg font-semibold text-[#FFD76A] group-hover:text-white transition-colors">
              Play Responsibly
            </span>
            <span className="h-[1px] w-10 sm:w-14 bg-gradient-to-l from-transparent to-[#D4AF37]" />
          </Link>

          {/* Right: Brand Lockup & Functional Support Channels */}
          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4">
            <BrandMark
              brandName={systemSettings.brandName}
              logoUrl={systemSettings.logoUrl}
              subtitle="Kampala Premier Card & Board Club"
            />
            <span className="hidden sm:inline-block h-7 w-[1px] bg-[#D4AF37]/30" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${cleanWhatsapp}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp Support"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-[#052616] text-[#FFD76A] hover:bg-[#FFD76A] hover:text-[#050806] transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <Link
                to="/support"
                aria-label="Help & Support Desk"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-[#052616] text-[#FFD76A] hover:bg-[#FFD76A] hover:text-[#050806] transition-colors"
              >
                <Headphones className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                aria-label="Contact CASINO ROYALE"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-[#052616] text-[#FFD76A] hover:bg-[#FFD76A] hover:text-[#050806] transition-colors"
              >
                <Mail className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Legal, Compliance & Secondary Navigation Bar */}
        <div className="border-t border-white/10 bg-[#020705] px-4 sm:px-6 py-3">
          <div className="mx-auto max-w-[1400px] flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-neutral-400">
            <p className="text-center md:text-left">
              © {new Date().getFullYear()} {systemSettings.brandName} · {systemSettings.officeAddress || 'Kampala, Uganda'} · 18+ Identity-Verified Card, Board & Mobile Money Gaming Platform.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-neutral-300">
              <Link to="/terms" className="hover:text-[#FFD76A] transition-colors">Terms & Conditions</Link>
              <Link to="/privacy" className="hover:text-[#FFD76A] transition-colors">Privacy & KYC Notice</Link>
              <Link to="/responsible-gaming" className="hover:text-[#FFD76A] transition-colors">18+ Policy</Link>
              <Link to="/admin/login" className="hover:text-[#FFD76A] transition-colors">Admin Portal</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
