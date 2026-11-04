/**
 * Tono del riquadro di uno stato di progetto (stile gi-status-tile in styles.scss): In Progress in
 * evidenza (azzurro), Pending in attesa (giallo), Completed chiuso bene (verde); gli altri neutri.
 */
export type StatusTone = 'accent' | 'warn' | 'good' | 'none';

const TONES: Readonly<Record<string, StatusTone>> = {
  IN_PROGRESS: 'accent',
  PENDING: 'warn',
  STANDBY: 'warn',
  COMPLETED: 'good',
};

export function statusTone(code: string): StatusTone {
  return TONES[code] ?? 'none';
}
