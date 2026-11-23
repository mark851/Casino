import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { fetchApiJson, getApiAuthToken } from '../lib/apiClient';
import { useAuth } from '../lib/authContext';
import {
  getStore,
  hydratePlayerFromServer,
  notifyStore,
  type ServerPlayerHydration,
} from '../lib/localStore';
import { PlayerLayout } from '../components/PlayerLayout';
import {
  ALLOWED_KYC_MIME_TYPES,
  calculateAgeFromDob,
  clampStr,
  maskIdReference,
  MAX_KYC_FILE_BYTES,
} from '../utils/validation';
import ugandaEmblemImg from '../assets/images/uganda_flag_emblem_1794598745119.jpg';
import type { IdentityVerificationRecord } from '../shared/types';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

export const VerificationStatusPage: React.FC = () => {
  const { firebaseUser, userDoc, kycRecord, isApprovedPlayer } = useAuth();

  const [legalName, setLegalName] = useState(userDoc?.fullName || '');
  const [dob, setDob] = useState(userDoc?.dateOfBirth || '');
  const [idType, setIdType] = useState<IdentityVerificationRecord['id_type']>('National ID');
  const [idRef, setIdRef] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const kycStatus = userDoc?.kycStatus || 'Not Submitted';
  const canSubmit =
    kycStatus === 'Not Submitted' ||
    kycStatus === 'Rejected' ||
    kycStatus === 'Resubmission Required';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!firebaseUser || !userDoc) return;
    if (!firebaseUser.emailVerified) {
      setError('Verify your email address first before submitting confidential KYC documents.');
      return;
    }

    const cleanName = clampStr(legalName || userDoc.fullName, 120);
    const effectiveDob = dob || userDoc.dateOfBirth;
    if (cleanName.length < 2) {
      setError('Enter your full legal name matching your government ID.');
      return;
    }
    if (!effectiveDob || calculateAgeFromDob(effectiveDob) < 18) {
      setError('You must be 18 years or older to complete identity verification.');
      return;
    }
    if (!frontFile || !backFile) {
      setError('Upload clear images of both the front and back of your identification document.');
      return;
    }
    for (const file of [frontFile, backFile]) {
      if (!ALLOWED_KYC_MIME_TYPES.includes(file.type)) {
        setError('Supported KYC formats: JPEG, PNG, or WebP.');
        return;
      }
      if (file.size > MAX_KYC_FILE_BYTES) {
        setError('Each KYC file must be 5 MB or smaller.');
        return;
      }
    }

    setBusy(true);
    try {
      const verificationId = kycRecord?.verification_id || firebaseUser.uid;
      const [frontDataUrl, backDataUrl] = await Promise.all([
        readFileAsDataUrl(frontFile),
        readFileAsDataUrl(backFile),
      ]);
      const maskedRef = idRef.trim() ? maskIdReference(idRef.trim()) : kycRecord?.id_number_reference;

      const payload: IdentityVerificationRecord = {
        verification_id: verificationId,
        uid: firebaseUser.uid,
        player_id: userDoc.playerId,
        legal_name: cleanName,
        date_of_birth: effectiveDob,
        id_type: idType,
        id_number_reference: maskedRef,
        front_image_storage_path: frontDataUrl,
        back_image_storage_path: backDataUrl,
        verification_status: 'Pending Verification',
        submitted_at: Date.now(),
        resubmission_count: kycRecord ? (kycRecord.resubmission_count || 0) + 1 : 0,
        updatedAt: Date.now(),
      };

      if (getApiAuthToken()) {
        const res = await fetchApiJson<{ ok: boolean; hydration?: ServerPlayerHydration }>(
          '/api/kyc/submit',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
        if (res.hydration) {
          hydratePlayerFromServer(res.hydration);
        }
      } else {
        const s = getStore();
        s.kycRecords[firebaseUser.uid] = payload;

        if (s.users[firebaseUser.uid]) {
          s.users[firebaseUser.uid].fullName = cleanName;
          s.users[firebaseUser.uid].kycStatus = 'Pending Verification';
          s.users[firebaseUser.uid].updatedAt = Date.now();
        }
        if (s.playerProfiles[firebaseUser.uid]) {
          s.playerProfiles[firebaseUser.uid].kycStatus = 'Pending Verification';
          s.playerProfiles[firebaseUser.uid].updatedAt = Date.now();
        }
        notifyStore();
      }

      setSuccess('KYC documents submitted to the Compliance Review Queue.');
      setFrontFile(null);
      setBackFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit KYC documents.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlayerLayout title="Identity Verification (18+ KYC)">
      <div className="space-y-6">
        {/* Status Banner */}
        <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/35 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <img
              src={ugandaEmblemImg}
              alt="Compliance Crest"
              className="h-16 w-16 rounded-2xl border border-[#FFD76A]/60 object-cover shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="text-xs text-[#FFD76A] font-semibold">
                Player ID: <span className="font-mono-tabular">{userDoc?.playerId}</span>
              </p>
              <h2 className="font-display text-2xl font-bold text-white mt-0.5">
                Verification Status: {kycStatus}
              </h2>
              <p className="text-xs text-neutral-300 mt-1">
                {isApprovedPlayer
                  ? 'Your identity is approved. All live Matatu, Chess, Drafts, and Tournament rooms are unlocked.'
                  : kycStatus === 'Pending Verification'
                  ? 'Your documents are in the review queue. A Compliance Officer in the Admin Portal can approve them.'
                  : 'Submit valid Ugandan National ID, Passport, or Driving Permit images to unlock live tables.'}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isApprovedPlayer ? (
              <Link
                to="/play"
                className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Enter Live Lobby</span>
              </Link>
            ) : kycStatus === 'Pending Verification' ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#052315] px-4 py-2 text-xs font-semibold text-[#FFD76A]">
                <Clock className="h-4 w-4" />
                <span>In Review Queue</span>
              </span>
            ) : null}
          </div>
        </section>

        {kycRecord?.rejection_reason && (
          <div className="rounded-2xl border border-amber-500/45 bg-amber-950/35 p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-300">Reviewer Note</h3>
              <p className="text-xs text-neutral-200 mt-1">{kycRecord.rejection_reason}</p>
            </div>
          </div>
        )}

        {canSubmit && (
          <form
            onSubmit={handleSubmit}
            className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 sm:p-8 space-y-5"
          >
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <ShieldCheck className="h-5 w-5 text-[#FFD76A]" />
              <h3 className="font-display text-xl font-bold text-white">
                Submit Confidential KYC Documents
              </h3>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs text-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-xs text-emerald-200">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Document Type</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as IdentityVerificationRecord['id_type'])}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value="National ID">Ugandan National ID (NIN)</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving Permit">Driving Permit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  ID Reference Number (Optional, Masked)
                </label>
                <input
                  type="text"
                  value={idRef}
                  onChange={(e) => setIdRef(e.target.value)}
                  placeholder="e.g. CM90012345ABCD"
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D4AF37]/50 bg-[#04150D] p-5 text-center cursor-pointer hover:border-[#FFD76A] transition-colors">
                <Upload className="h-6 w-6 text-[#FFD76A] mb-2" />
                <span className="text-xs font-semibold text-white">
                  {frontFile ? frontFile.name : 'Upload Front Side (JPEG/PNG/WebP)'}
                </span>
                <span className="text-[11px] text-neutral-400 mt-0.5">Max 5 MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                />
              </label>

              <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D4AF37]/50 bg-[#04150D] p-5 text-center cursor-pointer hover:border-[#FFD76A] transition-colors">
                <FileCheck2 className="h-6 w-6 text-[#FFD76A] mb-2" />
                <span className="text-xs font-semibold text-white">
                  {backFile ? backFile.name : 'Upload Back Side (JPEG/PNG/WebP)'}
                </span>
                <span className="text-[11px] text-neutral-400 mt-0.5">Max 5 MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="gold-shimmer-btn rounded-full px-7 py-3 text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Submitting…' : 'Submit for KYC Approval'}
            </button>
          </form>
        )}
      </div>
    </PlayerLayout>
  );
};
