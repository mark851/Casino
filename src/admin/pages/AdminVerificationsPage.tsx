import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, RefreshCw, XCircle } from 'lucide-react';
import { fetchApiJson, getApiAuthToken } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import {
  getStore,
  hydrateAdminFromServer,
  notifyStore,
  subscribeStore,
  type ServerAdminOverview,
} from '../../lib/localStore';
import { AdminLayout } from '../components/AdminLayout';
import { createPlayerNotification, writeAdminLog } from './AdminHelpers';
import type { IdentityVerificationRecord, KycStatus } from '../../shared/types';

export const AdminVerificationsPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [records, setRecords] = useState<IdentityVerificationRecord[]>([]);
  const [selected, setSelected] = useState<IdentityVerificationRecord | null>(null);
  const [frontPreview, setFrontPreview] = useState<string>('');
  const [backPreview, setBackPreview] = useState<string>('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const sync = () => {
      setRecords(Object.values(getStore().kycRecords));
    };
    sync();
    if (getApiAuthToken()) {
      void fetchApiJson<{ overview: ServerAdminOverview }>('/api/admin/overview')
        .then((res) => {
          if (res.overview) hydrateAdminFromServer(res.overview);
        })
        .catch(() => {
          // Retain local snapshot
        });
    }
    return subscribeStore(sync);
  }, []);

  const handleSelect = (rec: IdentityVerificationRecord) => {
    setSelected(rec);
    setReason(rec.rejection_reason || '');
    setFeedback('');
    setFrontPreview(rec.front_image_storage_path || '');
    setBackPreview(rec.back_image_storage_path || '');
  };

  const handleDecision = async (status: KycStatus) => {
    if (!selected || !firebaseUser) return;
    if ((status === 'Rejected' || status === 'Resubmission Required') && reason.trim().length < 4) {
      setFeedback('Enter a clear reason before rejecting or requesting resubmission.');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      if (getApiAuthToken()) {
        const res = await fetchApiJson<{ kyc: IdentityVerificationRecord }>(
          `/api/admin/kyc/${encodeURIComponent(selected.uid)}/decision`,
          {
            method: 'POST',
            body: JSON.stringify({ status, reason: reason.trim() || undefined }),
          }
        );
        const overviewRes = await fetchApiJson<{ overview: ServerAdminOverview }>(
          '/api/admin/overview'
        );
        if (overviewRes.overview) hydrateAdminFromServer(overviewRes.overview);
        setSelected(res.kyc);
        setFeedback(`Updated verification to ${status}.`);
        return;
      }

      const store = getStore();
      const reviewedAt = new Date().toISOString();
      const now = Date.now();
      const existingKyc = store.kycRecords[selected.uid] || selected;

      const updatedKyc: IdentityVerificationRecord = {
        ...existingKyc,
        verification_status: status,
        reviewed_at: reviewedAt,
        reviewed_by: firebaseUser.uid,
        rejection_reason: reason.trim() ? reason.trim().slice(0, 500) : existingKyc.rejection_reason,
        updatedAt: now,
      };
      store.kycRecords[selected.uid] = updatedKyc;

      const accountStatus =
        status === 'Approved' ? 'Active' : status === 'Suspended' ? 'Suspended' : 'Pending';

      if (store.users[selected.uid]) {
        store.users[selected.uid] = {
          ...store.users[selected.uid],
          kycStatus: status,
          accountStatus,
          updatedAt: now,
        };
      }

      if (store.playerProfiles[selected.uid]) {
        store.playerProfiles[selected.uid] = {
          ...store.playerProfiles[selected.uid],
          kycStatus: status,
          accountStatus,
          updatedAt: now,
        };
      }

      notifyStore();

      await createPlayerNotification({
        uid: selected.uid,
        title: `KYC Verification ${status}`,
        message:
          status === 'Approved'
            ? 'Your 18+ identity verification is approved. Live Matatu, Chess, Drafts, and Tournament tables are now unlocked.'
            : `Your verification status changed to ${status}. ${reason.trim()}`,
        category: 'kyc',
      });

      await writeAdminLog({
        adminUid: firebaseUser.uid,
        adminEmail: firebaseUser.email || 'admin',
        action: `KYC_${status.toUpperCase()}`,
        targetType: 'identity_verification',
        targetId: selected.verification_id,
        details: `${selected.legal_name} (${selected.player_id}) -> ${status}`,
      });

      setFeedback(`Updated verification to ${status}.`);
      setSelected(updatedKyc);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to apply KYC decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="ID Verifications (KYC Vault)">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-6 items-start">
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-display text-lg font-bold text-white">Submitted Verifications</h2>
          </div>
          <div className="divide-y divide-white/10 max-h-[600px] overflow-y-auto">
            {records.length === 0 ? (
              <p className="p-6 text-xs text-neutral-400">No KYC submissions yet.</p>
            ) : (
              records.map((r) => (
                <button
                  key={r.verification_id}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className={`w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-white/5 cursor-pointer ${
                    selected?.verification_id === r.verification_id ? 'bg-[#063B24]/70' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{r.legal_name}</p>
                    <p className="text-xs text-neutral-400 font-mono-tabular">
                      {r.player_id} · {r.id_type}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#FFD76A] shrink-0">
                    {r.verification_status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-5">
          {!selected ? (
            <div className="py-16 text-center space-y-2">
              <Eye className="h-8 w-8 text-[#FFD76A] mx-auto" />
              <p className="text-sm font-semibold text-white">Select a Submission</p>
              <p className="text-xs text-neutral-400">
                Click any player verification record to inspect submitted ID images.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-white">{selected.legal_name}</h3>
                  <p className="text-xs text-neutral-300 font-mono-tabular mt-1">
                    {selected.player_id} · DOB: {selected.date_of_birth} · {selected.id_type}
                  </p>
                </div>
                <span className="text-xs font-bold text-[#FFD76A]">{selected.verification_status}</span>
              </div>

              {feedback && (
                <div className="rounded-xl border border-[#D4AF37]/40 bg-[#052315] px-4 py-2.5 text-xs text-[#FFD76A]">
                  {feedback}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs text-neutral-400">Document Front</p>
                  {frontPreview ? (
                    <img
                      src={frontPreview}
                      alt="ID Front"
                      className="w-full h-44 object-contain rounded-xl border border-white/15 bg-black/50"
                    />
                  ) : (
                    <div className="h-44 rounded-xl border border-white/10 bg-black/30 flex items-center justify-center text-xs text-neutral-500">
                      Protected Preview
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-neutral-400">Document Back</p>
                  {backPreview ? (
                    <img
                      src={backPreview}
                      alt="ID Back"
                      className="w-full h-44 object-contain rounded-xl border border-white/15 bg-black/50"
                    />
                  ) : (
                    <div className="h-44 rounded-xl border border-white/10 bg-black/30 flex items-center justify-center text-xs text-neutral-500">
                      Protected Preview
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Compliance Note / Rejection Reason
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Optional on approval; required when rejecting or requesting resubmission"
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDecision('Approved')}
                  className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Approve KYC</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDecision('Resubmission Required')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-950/50 px-4 py-2 text-xs font-semibold text-amber-200 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Request Resubmission</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDecision('Rejected')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-400/50 bg-red-950/50 px-4 py-2 text-xs font-semibold text-red-200 cursor-pointer"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
