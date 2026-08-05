export type UserDef = {
  id: string
  name: string
  email: string
  roleName: string
  /** null = role sistem global (SUPER_ADMIN / OWNER tanpa perusahaan spesifik) */
  companyCode: string | null
  /** null = tidak terikat cabang (owner, atau posisi lintas cabang) */
  branchName: string | null
  baseSalary?: number
  /**
   * Status ikatan kerja. Sengaja WAJIB diisi, tanpa nilai default di sini:
   * kolomnya menentukan berhak-tidaknya seseorang atas bonus, dan menebaknya
   * berarti membayar orang yang belum berhak. Karyawan yang statusnya memang
   * belum jelas ditulis eksplisit 'BELUM_KONTRAK'.
   */
  employmentStatus: 'BELUM_KONTRAK' | 'PROBATION' | 'PKWT' | 'PKWTT'
  /** Wajib untuk PKWT — tanpa ini kontraknya dianggap belum berbatas waktu. */
  contractEndDate?: string
}
