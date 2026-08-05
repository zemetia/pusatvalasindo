// PKD — Pusat Kirim Duit. Satu akun contoh per posisi.
//
// SELURUH akun di sini berstatus 'BELUM_KONTRAK'. Itu bukan data sebenarnya —
// itu nilai paling aman. Status kontrak menentukan berhak-tidaknya seseorang
// atas bonus KPI (guard `belum_berkontrak` pada rule bonus), dan menebak
// "sudah berkontrak" berarti membayar orang yang belum berhak; uang yang sudah
// keluar tidak bisa ditarik lagi. HR wajib mengisi status sebenarnya lewat
// halaman Pengguna sebelum payroll pertama dijalankan.

import type { UserDef } from './types'

export const PKD_USERS: UserDef[] = [
  {
    id: 'usr_kepala_pkd',
    name: 'Kepala Cabang PKD',
    email: 'kepala@pkd.local',
    roleName: 'Kepala Cabang',
    companyCode: 'PKD',
    branchName: 'Pusat Kirim Duit',
    baseSalary: 6_000_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_teller_dalam_pkd',
    name: 'Teller Dalam PKD',
    email: 'teller.dalam@pkd.local',
    roleName: 'Teller Dalam',
    companyCode: 'PKD',
    branchName: 'Pusat Kirim Duit',
    baseSalary: 3_500_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_teller_luar_pkd',
    name: 'Teller Luar PKD',
    email: 'teller.luar@pkd.local',
    roleName: 'Teller Luar',
    companyCode: 'PKD',
    branchName: 'Pusat Kirim Duit',
    baseSalary: 3_500_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
  {
    id: 'usr_kurir_pkd',
    name: 'Kurir PKD',
    email: 'kurir@pkd.local',
    roleName: 'Kurir',
    companyCode: 'PKD',
    branchName: 'Pusat Kirim Duit',
    baseSalary: 2_800_000,
    employmentStatus: 'BELUM_KONTRAK',
  },
]
