import type { OpeningHours } from '@/config/group';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const DAY_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fmt = (t: string) => t.replace(':', '.');

export interface OpeningStatus {
  open: boolean;
  /** Teks singkat untuk badge, mis. "Buka sampai 16.30" */
  label: string;
}

/** Status buka/tutup berdasarkan jam WIB (UTC+7), independen dari zona waktu browser. */
export function getOpeningStatus(hours: OpeningHours[], now: Date = new Date()): OpeningStatus {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const day = wib.getUTCDay();
  const minutes = wib.getUTCHours() * 60 + wib.getUTCMinutes();

  const today = hours.find((h) => h.days.includes(DAYS[day]));
  if (today && minutes >= toMin(today.opens) && minutes < toMin(today.closes)) {
    return { open: true, label: `Buka sampai ${fmt(today.closes)}` };
  }
  if (today && minutes < toMin(today.opens)) {
    return { open: false, label: `Tutup, buka pukul ${fmt(today.opens)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const next = hours.find((h) => h.days.includes(DAYS[d]));
    if (next) {
      const when = i === 1 ? 'besok' : DAY_ID[d];
      return { open: false, label: `Tutup, buka ${when} ${fmt(next.opens)}` };
    }
  }
  return { open: false, label: 'Tutup' };
}
