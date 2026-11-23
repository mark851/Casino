import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Gamepad2,
  DoorOpen,
  History,
  Wallet,
  ReceiptText,
  ShieldCheck,
  Bell,
  UserCircle,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquare,
  X,
  ArrowLeft,
  Crown,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useSocial } from '../lib/socialContext';
import { BrandMark } from './BrandMark';
import { GlobalSoundToggle } from './GlobalSoundToggle';

const PLAYER_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/play', label: 'Play Matatu', icon: Gamepad2 },
  { to: '/rooms', label: 'Game Rooms', icon: DoorOpen },
  { to: '/friends', label: 'Friends & Online', icon: Users },
  { to: '/tournaments', label: 'Tournaments', icon: Trophy },
  { to: '/game-history', label: 'Game History', icon: History },
  { to: '/wallet', label: 'UGX Wallet', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/verification-status', label: 'ID Verification', icon: ShieldCheck },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserCircle },
  { to: '/support', label: 'Support', icon: LifeBuoy },
];

export const PlayerLayout: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const { userDoc, playerProfile, systemSettings, logout } = useAuth();
  const {
    onlinePlayers,
    incomingFriendRequests,
    incomingPendingInvites,
    totalUnreadChats,
    openChatWith,
  } = useSocial();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pendingAlerts =
    incomingFriendRequests.length + incomingPendingInvites.length + totalUnreadChats;
  const kycStatus = userDoc?.kycStatus || 'Not Submitted';
  const displayName = userDoc?.fullName || playerProfile?.displayName || 'Player';
  const initial = displayName.trim().slice(0, 1).toUpperCase() || 'M';

  return (
    <div className="min-h-screen bg-[#040806] text-white flex flex-col lg:flex-row">
      {/* Sidebar Desktop + Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-68 emerald-card-surface border-r border-[#D4AF37]/25 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/20 bg-[#02140C]/80">
          <Link to="/" className="whitespace-nowrap shrink-0">
            <BrandMark brandName={systemSettings.brandName} logoUrl={systemSettings.logoUrl} />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden text-neutral-300 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Player Identity Card */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="rounded-xl border border-[#D4AF37]/25 bg-[#03130B]/80 p-3 flex items-center gap-3">
            <div className="relative h-11 w-11 rounded-full border-2 border-[#D4AF37] bg-[#063B24] flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_16px_rgba(212,175,55,0.28)]">
              {playerProfile?.avatarUrl ? (
                <img
                  src={playerProfile.avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-display text-base font-bold text-[#FFD76A]">{initial}</span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#021D12] border border-[#D4AF37] flex items-center justify-center">
                <Crown className="h-2.5 w-2.5 text-[#FFD76A]" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
              <p className="text-[11px] text-[#FFD76A] font-mono-tabular truncate">
                {userDoc?.playerId || 'Registration Pending'}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                KYC:{' '}
                <span
                  className={
                    kycStatus === 'Approved'
                      ? 'text-emerald-400 font-semibold'
                      : 'text-amber-300 font-semibold'
                  }
                >
                  {kycStatus}
                </span>
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {PLAYER_NAV.map((item) => {
            const Icon = item.icon;
            const isFriendsItem = item.to === '/friends';
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-[#0A4D30] to-[#063B24]/80 text-[#FFD76A] border border-[#D4AF37]/45 shadow-[0_4px_14px_rgba(0,0,0,0.45)]'
                      : 'text-neutral-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`
                }
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 text-[#D4AF37] shrink-0" />
                  <span>{item.label}</span>
                </span>
                {isFriendsItem && (
                  <span className="flex items-center gap-1.5 shrink-0">
                    {pendingAlerts > 0 && (
                      <span className="rounded-full bg-[#FFD76A] px-1.5 py-0.5 font-mono-tabular text-[10px] font-extrabold text-black">
                        {pendingAlerts}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono-tabular font-bold text-[#9CE800]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#9CE800]" />
                      {onlinePlayers.length + 1}
                    </span>
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2 bg-[#02120B]/70">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Public Site</span>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-950/40 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 hero-arena-bg">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#D4AF37]/20 bg-[#03130C]/92 backdrop-blur-md px-4 sm:px-8 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open player menu"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D4AF37]/30 bg-[#063B24]/60 text-[#FFD76A] cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openChatWith()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#062E1C] px-3.5 py-1.5 text-xs font-semibold text-white hover:border-[#FFD76A] whitespace-nowrap cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5 text-[#FFD76A]" />
              <span>Chat</span>
              {totalUnreadChats > 0 && (
                <span className="rounded-full bg-[#9CE800] px-1.5 py-0.2 text-[10px] font-extrabold text-black">
                  {totalUnreadChats}
                </span>
              )}
            </button>
            <Link
              to="/friends"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#062E1C] px-3.5 py-1.5 text-xs font-semibold text-white hover:border-[#FFD76A] whitespace-nowrap"
            >
              <span className="h-2 w-2 rounded-full bg-[#9CE800]" />
              <span>{onlinePlayers.length + 1} Online</span>
              {pendingAlerts > 0 && (
                <span className="rounded-full bg-[#FFD76A] px-1.5 py-0.2 text-[10px] font-extrabold text-black">
                  {pendingAlerts}
                </span>
              )}
            </Link>
            <GlobalSoundToggle variant="compact" />
            <Link
              to="/play"
              className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0"
            >
              <Gamepad2 className="h-4 w-4" />
              <span>Play Matatu</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
