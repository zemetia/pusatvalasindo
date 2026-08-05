// PTU — Pusat Tukar Uang. Satu akun contoh per posisi, per cabang.
//
// SELURUH akun di sini berstatus 'BELUM_KONTRAK'. Itu bukan data sebenarnya —
// itu nilai paling aman. Status kontrak menentukan berhak-tidaknya seseorang
// atas bonus KPI (guard `belum_berkontrak` pada rule bonus), dan menebak
// "sudah berkontrak" berarti membayar orang yang belum berhak; uang yang sudah
// keluar tidak bisa ditarik lagi. HR wajib mengisi status sebenarnya lewat
// halaman Pengguna sebelum payroll pertama dijalankan.

import type { UserDef } from './types'

export const PTU_USERS: UserDef[] = [
  // ── Pluit ─────────────────────────────────────────────────────────────────
  {
    id: 'usr_kepala_ptu_pluit',
    name: 'Kepala Marketing Pluit',
    email: 'kepala.pluit@ptu.local',
    roleName: 'Kepala Marketing',
    companyCode: 'PTU',
    branchName: 'Pluit',
    baseSalary: 6_000_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_teller_dalam_ptu_pluit',
    name: 'Teller Dalam Pluit',
    email: 'teller.dalam.pluit@ptu.local',
    roleName: 'Teller Dalam',
    companyCode: 'PTU',
    branchName: 'Pluit',
    baseSalary: 3_500_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_teller_luar_ptu_pluit',
    name: 'Teller Luar Pluit',
    email: 'teller.luar.pluit@ptu.local',
    roleName: 'Teller Luar',
    companyCode: 'PTU',
    branchName: 'Pluit',
    baseSalary: 3_500_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_sales_ptu_pluit',
    name: 'Marketing Pluit',
    email: 'sales.pluit@ptu.local',
    roleName: 'Marketing',
    companyCode: 'PTU',
    branchName: 'Pluit',
    baseSalary: 3_800_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
]
