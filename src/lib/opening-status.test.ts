import { describe, expect, it } from 'vitest';

import { branches } from '@/config/group';
import { getOpeningStatus } from './opening-status';

const hours = branches[0].hours;
// 2026-09-21 adalah Senin. WIB = UTC+7.
const wib = (iso: string) => new Date(`${iso}+07:00`);

describe('getOpeningStatus', () => {
  it('buka pada jam kerja', () => {
    expect(getOpeningStatus(hours, wib('2026-09-21T10:00:00'))).toEqual({ open: true, label: 'Buka sampai 16.30' });
  });
  it('tutup sebelum jam buka', () => {
    expect(getOpeningStatus(hours, wib('2026-09-21T07:00:00')).label).toBe('Tutup, buka pukul 08.00');
  });
  it('Sabtu tutup lebih awal', () => {
    expect(getOpeningStatus(hours, wib('2026-09-26T13:59:00')).open).toBe(true);
    expect(getOpeningStatus(hours, wib('2026-09-26T14:00:00')).open).toBe(false);
  });
  it('Minggu tutup, buka lagi Senin', () => {
    expect(getOpeningStatus(hours, wib('2026-09-27T10:00:00')).label).toBe('Tutup, buka besok 08.00');
  });
  it('Jumat sore menunjuk ke Sabtu', () => {
    expect(getOpeningStatus(hours, wib('2026-09-25T17:00:00')).label).toBe('Tutup, buka besok 08.00');
  });
});
