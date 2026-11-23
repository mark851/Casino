import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Gamepad2,
  DoorOpen,
  WalletCards,
  FileWarning,
  Inbox,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Trophy,
  MessagesSquare,
  Server,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { BrandMark } from '../../components/BrandMark';

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/verifications', label: 'ID Verifications', icon: ShieldCheck },
  { to: '/admin/players', label: 'Players Joined', icon: Users },
  { to: '/admin/games', label: 'Games', icon: Gamepad2 },
  { to: '/admin/rooms', label: 'Game Rooms', icon: DoorOpen },
  { to: '/admin/ai-players', label: 'Online Players & Chat', icon: MessagesSquare },
  { to: '/admin/tournaments', label: 'Tournaments', icon: Trophy },
  { to: '/admin/transactions', label: 'Deposits & Payouts', icon: WalletCards },
  { to: '/admin/cpanel', label: 'Spaceship cPanel', icon: Server },
  { to: '/admin/reports', label: 'Reports & Audits', icon: FileWarning },
  { to: '/admin/support', label: 'Support Inbox', icon: Inbox },
  { to: '/admin/administrators', label: 'Administrators', icon: UserCog },
  { to: '/admin/settings', label: 'Website & Rules', icon: Settings },
];

export const AdminLayout: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const { firebaseUser, adminRecord, systemSettings, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050806] text-white flex flex-col lg:flex-row">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#021D12] border-r border-[#D4AF37]/25 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/25">
          <Link to="/admin/dashboard" className="whitespace-nowrap shrink-0">
            <BrandMark brandName="CASINO ROYALE ADMIN" logoUrl={systemSettings.logoUrl} />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close admin sidebar"
            className="lg:hidden text-neutral-300 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-xs text-[#FFD76A] font-medium">
            {adminRecord?.role || 'Super Admin'}
          </p>
          <p className="text-sm font-semibold text-white truncate mt-0.5">
            {adminRecord?.fullName || firebaseUser?.displayName || firebaseUser?.email}
          </p>
          <p className="text-xs text-neutral-400 truncate">{firebaseUser?.email}</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#063B24] text-[#FFD76A] border border-[#D4AF37]/40'
                      : 'text-neutral-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`
                }
              >
                <Icon className="h-4 w-4 text-[#D4AF37] shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Player Website</span>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-950/40 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out Admin</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#D4AF37]/20 bg-[#050806]/95 backdrop-blur px-4 sm:px-8 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin navigation"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D4AF37]/30 text-[#FFD76A] cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-neutral-400">Administrator Console / {title}</p>
              <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">{title}</h1>
            </div>
          </div>
          <span className="hidden sm:inline-block text-xs text-neutral-400 whitespace-nowrap shrink-0">
            Operations &amp; Payout Governance
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
