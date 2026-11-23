import { getStore, notifyStore, pushNotification } from '../../lib/localStore';
import type { AdminLogRecord } from '../../shared/types';

export async function writeAdminLog(params: {
  adminUid: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
}): Promise<void> {
  const store = getStore();
  const logId = `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const entry: AdminLogRecord = {
    logId,
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    createdAt: Date.now(),
  };
  store.adminLogs = [entry, ...store.adminLogs];
  notifyStore();
}

export async function createPlayerNotification(params: {
  uid: string;
  title: string;
  message: string;
  category: 'kyc' | 'wallet' | 'tournament' | 'support' | 'system';
}): Promise<void> {
  pushNotification(params.uid, {
    title: params.title,
    message: params.message,
    category: params.category,
  });
}
