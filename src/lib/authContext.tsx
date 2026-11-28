import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchApiJson,
  getApiAuthToken,
  setApiAuthToken,
} from './apiClient';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  BOOTSTRAPPED_ADMIN_EMAILS,
  getStore,
  hydrateAdminFromServer,
  hydratePlayerFromServer,
  notifyStore,
  subscribeStore,
  type LocalAuthUser,
  type ServerAdminOverview,
  type ServerPlayerHydration,
} from './localStore';
import { clampStr } from '../utils/validation';
import type {
  AdministratorRecord,
  IdentityVerificationRecord,
  PlayerProfile,
  SystemSettingsRecord,
  UserRecord,
  WalletRecord,
} from '../shared/types';

export { BOOTSTRAPPED_ADMIN_EMAIL, BOOTSTRAPPED_ADMIN_EMAILS };

interface AuthApiResponse {
  token: string;
  user: UserRecord;
  hydration?: ServerPlayerHydration | null;
  overview?: ServerAdminOverview | null;
}

interface AuthContextValue {
  firebaseUser: LocalAuthUser | null;
  authReady: boolean;
  userDoc: UserRecord | null;
  playerProfile: PlayerProfile | null;
  kycRecord: IdentityVerificationRecord | null;
  wallet: WalletRecord | null;
  adminRecord: AdministratorRecord | null;
  isAdmin: boolean;
  isApprovedPlayer: boolean;
  systemSettings: SystemSettingsRecord;
  dataLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<LocalAuthUser>;
  registerWithEmail: (params: {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    password: string;
  }) => Promise<LocalAuthUser>;
  signInWithGoogle: (preferredEmail?: string) => Promise<LocalAuthUser>;
  signInDemoPlayer: () => Promise<LocalAuthUser>;
  claimAdminPassword: (email: string, password: string) => Promise<LocalAuthUser>;
  signInAdmin: (email: string, password: string) => Promise<LocalAuthUser>;
  verifyEmailNow: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthUser: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function makeAuthUserFromRecord(
  uid: string,
  user?: UserRecord & { password?: string }
): LocalAuthUser | null {
  if (!user) return null;
  return {
    uid,
    email: user.email,
    displayName: user.fullName,
    emailVerified: user.emailVerified,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, setTick] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    return subscribeStore(() => setTick((t) => t + 1));
  }, []);

  const store = getStore();
  const currentUid = store.currentUid;
  const userRecord = currentUid ? store.users[currentUid] : undefined;
  const userEmail = userRecord?.email;
  const userFullName = userRecord?.fullName;
  const userEmailVerified = userRecord?.emailVerified;
  const firebaseUser = useMemo(
    () =>
      currentUid && userEmail !== undefined
        ? makeAuthUserFromRecord(currentUid, {
            uid: currentUid,
            email: userEmail,
            fullName: userFullName || '',
            emailVerified: Boolean(userEmailVerified),
          } as UserRecord)
        : null,
    [currentUid, userEmail, userFullName, userEmailVerified]
  );
  const userDoc: UserRecord | null = useMemo(
    () => (userRecord ? { ...userRecord } : null),
    [userRecord]
  );
  const playerProfile: PlayerProfile | null = currentUid
    ? store.playerProfiles[currentUid] || null
    : null;
  const kycRecord: IdentityVerificationRecord | null = currentUid
    ? store.kycRecords[currentUid] || null
    : null;
  const wallet: WalletRecord | null = currentUid ? store.wallets[currentUid] || null : null;
  const adminRecord: AdministratorRecord | null = currentUid
    ? store.administrators[currentUid] || null
    : null;

  const applyAuthSuccess = useCallback((res: AuthApiResponse): LocalAuthUser => {
    setApiAuthToken(res.token);
    if (res.hydration) {
      hydratePlayerFromServer(res.hydration);
    }
    if (res.overview) {
      hydrateAdminFromServer(res.overview, res.user.uid);
    }
    if (!res.hydration && !res.overview) {
      const s = getStore();
      s.users[res.user.uid] = { ...res.user };
      s.currentUid = res.user.uid;
      notifyStore();
    }
    return makeAuthUserFromRecord(res.user.uid, res.user)!;
  }, []);

  const signInWithEmail = useCallback(
    async (emailInput: string, password: string) => {
      const email = clampStr(emailInput, 160).toLowerCase();
      setDataLoading(true);
      try {
        const res = await fetchApiJson<AuthApiResponse>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        return applyAuthSuccess(res);
      } finally {
        setDataLoading(false);
      }
    },
    [applyAuthSuccess]
  );

  const registerWithEmail = useCallback(
    async (params: {
      fullName: string;
      email: string;
      phone: string;
      dateOfBirth: string;
      password: string;
    }) => {
      setDataLoading(true);
      try {
        const res = await fetchApiJson<AuthApiResponse>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            fullName: clampStr(params.fullName, 120),
            email: clampStr(params.email, 160).toLowerCase(),
            phone: clampStr(params.phone, 40),
            dateOfBirth: params.dateOfBirth || '1995-01-01',
            password: params.password,
          }),
        });
        return applyAuthSuccess(res);
      } finally {
        setDataLoading(false);
      }
    },
    [applyAuthSuccess]
  );

  const signInDemoPlayer = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await fetchApiJson<AuthApiResponse>('/api/auth/demo-player', {
        method: 'POST',
      });
      return applyAuthSuccess(res);
    } finally {
      setDataLoading(false);
    }
  }, [applyAuthSuccess]);

  const signInWithGoogle = useCallback(
    async (preferredEmail?: string) => {
      const cleanEmail = (preferredEmail || '').trim().toLowerCase();
      if (
        cleanEmail &&
        cleanEmail !== 'player@casinoroyale.ug' &&
        !(BOOTSTRAPPED_ADMIN_EMAILS as readonly string[]).includes(cleanEmail)
      ) {
        const randBytes = new Uint8Array(12);
        window.crypto.getRandomValues(randBytes);
        const randomPassword = Array.from(randBytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return registerWithEmail({
          fullName: 'Kampala Contender',
          email: cleanEmail,
          phone: '+256700000000',
          dateOfBirth: '1995-01-01',
          password: randomPassword,
        });
      }
      return signInDemoPlayer();
    },
    [registerWithEmail, signInDemoPlayer]
  );

  const claimAdminPassword = useCallback(
    async (emailInput: string, password: string) => {
      setDataLoading(true);
      try {
        const res = await fetchApiJson<AuthApiResponse>('/api/auth/admin-claim', {
          method: 'POST',
          body: JSON.stringify({
            email: clampStr(emailInput, 160).toLowerCase(),
            password,
          }),
        });
        return applyAuthSuccess(res);
      } finally {
        setDataLoading(false);
      }
    },
    [applyAuthSuccess]
  );

  const signInAdmin = useCallback(
    async (emailInput: string, password: string) => {
      setDataLoading(true);
      try {
        const res = await fetchApiJson<AuthApiResponse>('/api/auth/admin-login', {
          method: 'POST',
          body: JSON.stringify({
            email: clampStr(emailInput, 160).toLowerCase(),
            password,
          }),
        });
        return applyAuthSuccess(res);
      } finally {
        setDataLoading(false);
      }
    },
    [applyAuthSuccess]
  );

  const verifyEmailNow = useCallback(async () => {
    const s = getStore();
    if (!s.currentUid || !s.users[s.currentUid]) return;
    s.users[s.currentUid].emailVerified = true;
    s.users[s.currentUid].updatedAt = Date.now();
    notifyStore();
  }, []);

  const sendPasswordReset = useCallback(async (_email: string) => {
    // Contact operations or cPanel administrator to reset credentials
  }, []);

  const logout = useCallback(async () => {
    setApiAuthToken(null);
    const s = getStore();
    if (s.currentUid && s.presence[s.currentUid]) {
      s.presence[s.currentUid] = {
        ...s.presence[s.currentUid],
        status: 'offline',
        lastSeenMs: Date.now(),
      };
    }
    s.currentUid = null;
    notifyStore();
  }, []);

  const refreshAuthUser = useCallback(async () => {
    const token = getApiAuthToken();
    if (!token) {
      notifyStore();
      return;
    }
    try {
      const res = await fetchApiJson<{
        hydration?: ServerPlayerHydration | null;
        overview?: ServerAdminOverview | null;
      }>('/api/auth/me');
      if (res.hydration) {
        hydratePlayerFromServer(res.hydration);
      }
      if (res.overview) {
        hydrateAdminFromServer(res.overview, res.hydration?.user?.uid);
      }
    } catch {
      notifyStore();
    }
  }, []);

  const getIdToken = useCallback(async () => {
    const token = getApiAuthToken();
    if (!token) throw new Error('Not authenticated');
    return token;
  }, []);

  const hasToken = Boolean(getApiAuthToken());
  const isBootstrappedAdmin =
    hasToken &&
    Boolean(firebaseUser?.emailVerified) &&
    (BOOTSTRAPPED_ADMIN_EMAILS as readonly string[]).includes(
      firebaseUser?.email?.toLowerCase() || ''
    );

  const isAdmin =
    hasToken &&
    (isBootstrappedAdmin ||
      (Boolean(firebaseUser?.emailVerified) && adminRecord?.status === 'Active'));

  const isApprovedPlayer =
    Boolean(firebaseUser?.emailVerified) &&
    userDoc?.kycStatus === 'Approved' &&
    userDoc?.accountStatus === 'Active';

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        authReady: true,
        userDoc,
        playerProfile,
        kycRecord,
        wallet,
        adminRecord,
        isAdmin,
        isApprovedPlayer,
        systemSettings: store.systemSettings,
        dataLoading,
        signInWithEmail,
        registerWithEmail,
        signInWithGoogle,
        signInDemoPlayer,
        claimAdminPassword,
        signInAdmin,
        verifyEmailNow,
        sendPasswordReset,
        logout,
        refreshAuthUser,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
