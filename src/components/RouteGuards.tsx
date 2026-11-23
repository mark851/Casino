import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, MailCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/authContext';

export const RequirePlayerAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, authReady, verifyEmailNow, refreshAuthUser, logout } = useAuth();
  const location = useLocation();
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#050806] flex items-center justify-center text-neutral-300 text-sm">
        Verifying session...
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!firebaseUser.emailVerified) {
    const handleResend = async () => {
      setErrMsg('');
      setResent(true);
    };

    const handleCheck = async () => {
      setChecking(true);
      setErrMsg('');
      try {
        verifyEmailNow();
        await refreshAuthUser();
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : 'Could not refresh session.');
      } finally {
        setChecking(false);
      }
    };

    return (
      <div className="min-h-screen bg-[#050806] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-xl border border-[#D4AF37]/30 bg-[#021D12] p-8 text-white">
          <div className="flex items-center gap-3 mb-4 text-[#FFD76A]">
            <MailCheck className="h-6 w-6" />
            <h1 className="font-display text-2xl font-bold">Verify Your Email Address</h1>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed mb-6">
            Confirm email ownership for <span className="text-white font-medium">{firebaseUser.email}</span> before submitting identity documents or accessing your player dashboard.
          </p>
          {errMsg && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200">
              {errMsg}
            </div>
          )}
          {resent && (
            <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-200">
              Confirmation code refreshed. Click below to confirm your email immediately.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="gold-shimmer-btn inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Confirming...' : 'Confirm & Verify Email'}
            </button>
            <button
              type="button"
              onClick={handleResend}
              className="rounded-lg border border-[#D4AF37]/40 px-4 py-2.5 text-sm font-medium text-[#FFD76A] hover:bg-[#063B24] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Resend Link
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-neutral-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const RequireApprovedKyc: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userDoc, kycRecord, isApprovedPlayer, dataLoading } = useAuth();

  if (dataLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-neutral-300 text-sm">
        Checking identity verification status...
      </div>
    );
  }

  if (!isApprovedPlayer) {
    const status = userDoc?.kycStatus || kycRecord?.verification_status || 'Not Submitted';
    const isRejected = status === 'Rejected' || status === 'Resubmission Required';

    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-[#D4AF37]/30 bg-[#021D12] p-8">
          <div className="flex items-center gap-3 text-[#FFD76A] mb-3">
            <ShieldAlert className="h-6 w-6" />
            <h1 className="font-display text-2xl font-bold text-white">Identity Verification Required</h1>
          </div>
          <p className="text-sm text-neutral-200 leading-relaxed mb-4">
            {status === 'Pending Verification'
              ? 'Your account is awaiting identity verification. Our verification team will review your documents.'
              : isRejected
              ? 'Your previous identity verification requires attention before you can access Matatu gameplay.'
              : status === 'Suspended'
              ? 'Your account is currently suspended. Please contact customer support for assistance.'
              : 'All players on CASINO ROYALE must complete mandatory identity and age verification before entering game tables.'}
          </p>
          <div className="rounded-lg border border-white/10 bg-[#050806]/60 p-4 mb-6 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-neutral-400">Current Verification Status</span>
              <span className="font-semibold text-[#FFD76A]">{status}</span>
            </div>
            {kycRecord?.rejection_reason && isRejected && (
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-red-300">
                Reason: {kycRecord.rejection_reason}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/verification-status"
              className="gold-shimmer-btn rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0"
            >
              {status === 'Not Submitted' || isRejected ? 'Submit / Update ID Documents' : 'View Verification Status'}
            </Link>
            <Link
              to="/dashboard"
              className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-white/5 whitespace-nowrap shrink-0"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const RequireAdminAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, authReady, isAdmin, dataLoading } = useAuth();
  const location = useLocation();

  if (!authReady || (firebaseUser && dataLoading)) {
    return (
      <div className="min-h-screen bg-[#050806] flex items-center justify-center text-neutral-300 text-sm">
        Verifying administrator authorisation...
      </div>
    );
  }

  if (!firebaseUser || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};
