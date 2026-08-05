// PVI — Pusat Valas Indo. Satu akun contoh per posisi, per cabang.
//
// SELURUH akun di sini berstatus 'BELUM_KONTRAK'. Itu bukan data sebenarnya —
// itu nilai paling aman. Status kontrak menentukan berhak-tidaknya seseorang
// atas bonus KPI (guard `belum_berkontrak` pada rule bonus), dan menebak
// "sudah berkontrak" berarti membayar orang yang belum berhak; uang yang sudah
// keluar tidak bisa ditarik lagi. HR wajib mengisi status sebenarnya lewat
// halaman Pengguna sebelum payroll pertama dijalankan.

import type { UserDef } from './types'

export const PVI_USERS: UserDef[] = [
  // ── Cengkareng ────────────────────────────────────────────────────────────
  {
    id: 'usr_kepala_pvi_cengkareng',
    name: 'Kepala Cabang Cengkareng',
    email: 'kepala.cengkareng@pvi.local',
    roleName: 'Kepala Cabang',
    companyCode: 'PVI',
    branchName: 'Cengkareng',
    baseSalary: 6_000_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_teller_dalam_pvi_cengkareng',
    name: 'Teller Dalam Cengkareng',
    email: 'teller.dalam.cengkareng@pvi.local',
    roleName: 'Teller Dalam',
    companyCode: 'PVI',
    branchName: 'Cengkareng',
    baseSalary: 3_500_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_teller_luar_pvi_cengkareng',
    name: 'Teller Luar Cengkareng',
    email: 'teller.luar.cengkareng@pvi.local',
    roleName: 'Teller Luar',
    companyCode: 'PVI',
    branchName: 'Cengkareng',
    baseSalary: 3_500_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_kurir_pvi_cengkareng',
    name: 'Kurir Cengkareng',
    email: 'kurir.cengkareng@pvi.local',
    roleName: 'Kurir',
    companyCode: 'PVI',
    branchName: 'Cengkareng',
    baseSalary: 2_800_000,
    employmentStatus: 'BELUM_KONTRAK',
  },

  // ── Tangerang ─────────────────────────────────────────────────────────────
  {
    id: 'usr_kepala_pvi_tangerang',
    name: 'Kepala Cabang Tangerang',
    email: 'kepala.tangerang@pvi.local',
    roleName: 'Kepala Cabang',
    companyCode: 'PVI',
    branchName: 'Tangerang',
    baseSalary: 6_000_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_teller_dalam_pvi_tangerang',
    name: 'Teller Dalam Tangerang',
    email: 'teller.dalam.tangerang@pvi.local',
    roleName: 'Teller Dalam',
    companyCode: 'PVI',
    branchName: 'Tangerang',
    baseSalary: 3_500_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_sales_pvi_tangerang',
    name: 'Marketing Tangerang',
    email: 'sales.tangerang@pvi.local',
    roleName: 'Marketing',
    companyCode: 'PVI',
    branchName: 'Tangerang',
    baseSalary: 3_800_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
]
