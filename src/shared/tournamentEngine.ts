import type { TournamentRecord } from './types';

export function getKampalaDateString(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Kampala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatTournamentStartTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString('en-UG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getCountdownLabel(targetOrTournament: string | TournamentRecord): string {
  const iso =
    typeof targetOrTournament === 'string'
      ? targetOrTournament
      : targetOrTournament.startTimeIso;
  if (
    typeof targetOrTournament !== 'string' &&
    (targetOrTournament.status === 'Completed' || targetOrTournament.status === 'completed')
  ) {
    return 'Completed';
  }
  if (
    typeof targetOrTournament !== 'string' &&
    (targetOrTournament.status === 'Bracket Active' || targetOrTournament.status === 'in_progress')
  ) {
    return 'Bracket Active';
  }
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return 'Starting Soon';
  const diff = target - Date.now();
  if (diff <= 0) return 'Live Now';
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `Starts in ${hrs}h ${remMins}m`;
  return `Starts in ${Math.max(1, remMins)}m`;
}
