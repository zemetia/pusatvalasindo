// ─── Resource registry ───────────────────────────────────────────────────────
// Satu resource = satu halaman + service/API yang mendukungnya. Ini sumber
// kebenaran tunggal yang dibaca oleh:
//   • sidebar          (item muncul kalau viewScope != NONE)
//   • page guard       (requireResource)
//   • API guard        (authorize)
//   • UI Jabatan       (matriks izin)
//
// Menambah halaman baru = menambah satu entri di sini. Tidak ada migrasi DB,
// karena `RoleResourcePermission.resource` disimpan sebagai String.
//
// `legacy` memetakan resource ke permission string lama di lib/permissions.ts.
// Selama rollout bertahap, role yang belum punya baris RoleResourcePermission
// sama sekali akan jatuh balik ke array `permissions` lewat peta ini, sehingga
// tidak ada yang kehilangan akses di tengah migrasi. Lihat resolve.ts.

import { PERMISSIONS, type Permission } from "@/lib/permissions";

export type ResourceDef = {
  /** Kunci stabil yang tersimpan di DB. Jangan diubah setelah dipakai. */
  key: string;
  /** Label yang tampil di UI Jabatan. */
  label: string;
  /** Grup untuk pengelompokan di matriks izin. */
  group: string;
  /** Penjelasan singkat untuk admin yang mengatur izin. */
  description: string;
  /** Path halaman dashboard (tanpa prefix locale), kalau resource ini punya halaman. */
  page?: string;
  /** Prefix route API yang ditegakkan oleh resource ini — untuk audit & dokumentasi. */
  apis?: string[];
  /**
   * True untuk resource yang bukan halaman melainkan KEMAMPUAN tambahan
   * (mis. boleh mengubah angka tanggal lampau). Tidak punya sumbu baca/tulis —
   * matriks izin cuma menampilkan satu baris "Diizinkan untuk PT".
   */
  capability?: boolean;
  /**
   * True untuk halaman yang tidak punya sumbu tulis sama sekali (laporan &
   * rapor baca-saja). Panel Perizinan tidak menawarkan baris "Ubah ..." untuk
   * resource ini: sakelar yang tidak berpengaruh lebih buruk daripada tidak
   * ada sakelar — admin mengira ia memberi wewenang padahal tidak ada yang
   * membacanya. Tidak ada `authorize(..., "write")` untuk resource ini.
   */
  readOnly?: boolean;
  /**
   * Dimensi scope resource ini. Default `"company"`.
   *
   * • `"company"` — punya dimensi PT. Bisa OWN / SELECTED / ALL.
   * • `"self"`    — data milik sendiri. Tidak ada dimensi PT; ada atau tidak ada.
   * • `"global"`  — lintas seluruh PT dan tidak masuk akal dipecah per PT
   *                 (mis. definisi KPI dipakai bersama semua PT). Satu-satunya
   *                 mode bermakna adalah "Global", dan hanya Super Admin/Owner
   *                 yang boleh memberikannya — inilah jalur delegasi.
   */
  scoping?: "company" | "self" | "global";
  /** Permission lama yang setara, untuk fallback selama migrasi bertahap. */
  legacy?: { view?: Permission; write?: Permission };
};

export const RESOURCES: ResourceDef[] = [
  // ── Umum ───────────────────────────────────────────────────────────────────
  // Dulu ada entri "dashboard" di sini. Sudah dibuang: /dashboard adalah tujuan
  // redirect untuk SETIAP penolakan izin (lihat requireResource), jadi mencabutnya
  // hanya bisa berakhir sebagai loop redirect — sakelarnya mustahil dihormati.
  // Menampilkan sakelar yang tidak berpengaruh lebih buruk daripada tidak ada
  // sakelar sama sekali: admin mengira aksesnya sudah dicabut padahal tidak.
  // Halaman ringkasannya sendiri sudah menyaring isinya per izin (lihat
  // dashboard-pegawai.tsx), jadi yang terlihat di sana tetap mengikuti matriks.

  // ── Presensi ───────────────────────────────────────────────────────────────
  {
    key: "attendance.self",
    label: "Presensi Saya",
    group: "Presensi",
    description: "Clock-in/out dan riwayat kehadiran milik sendiri.",
    page: "/dashboard/attendance",
    apis: ["/api/attendance"],
    scoping: "self",
    legacy: { view: PERMISSIONS.ATTENDANCE_VIEW_OWN },
  },
  {
    key: "attendance.all",
    label: "Presensi Seluruh Karyawan",
    group: "Presensi",
    description:
      "Lihat kehadiran karyawan lain; hak tulis mencakup koreksi jam masuk/pulang, presensi manual, dan perubahan status (hadir, WFH, izin, sakit, cuti, alpa, libur).",
    // Per-PT (scoping default "company"): pemegang scope seluruh PT melihat
    // semua karyawan sekaligus, sedangkan HR satu PT hanya melihat PT-nya.
    page: "/dashboard/kpi/presensi",
    apis: ["/api/attendance", "/api/attendance/manage"],
    legacy: { view: PERMISSIONS.ATTENDANCE_VIEW_ALL, write: PERMISSIONS.ATTENDANCE_MANAGE },
  },

  // ── KPI ────────────────────────────────────────────────────────────────────
  {
    key: "kpi.self",
    label: "Input KPI Saya",
    group: "KPI",
    description: "Mengisi dan melihat KPI milik sendiri.",
    page: "/dashboard/kpi/self",
    apis: ["/api/kpi-entries"],
    scoping: "self",
    legacy: { view: PERMISSIONS.KPI_VIEW_OWN, write: PERMISSIONS.KPI_FILL_OWN },
  },
  // Tiga halaman di bawah ini adalah section "KPI" di sidebar, satu resource per
  // halaman supaya bisa didelegasikan terpisah. Semuanya `scoping: "global"`:
  // bobot dan definisi KPI dipakai bersama seluruh PT, jadi memecahnya per PT
  // akan menghasilkan konfigurasi yang saling bertentangan.
  //
  // Sengaja TANPA peta legacy — hari ini hanya role global yang berhak, dan
  // delegasi dilakukan eksplisit lewat matriks. Lihat catatan di resolve.ts.
  {
    key: "kpi.config",
    label: "Konfigurasi KPI",
    group: "KPI",
    description: "Bobot dan pemetaan KPI per jabatan.",
    page: "/dashboard/kpi",
    apis: ["/api/role-kpis"],
    scoping: "global",
  },
  {
    key: "kpi.definitions",
    label: "Definisi KPI",
    group: "KPI",
    description: "Daftar induk indikator KPI beserta cara penilaiannya.",
    page: "/dashboard/kpi/definitions",
    apis: ["/api/kpi-definitions"],
    scoping: "global",
  },
  {
    key: "kpi.review",
    label: "Penilaian & Persetujuan KPI",
    group: "KPI",
    description:
      "Menilai serta menyetujui/menolak entri KPI karyawan, dan mengunci periodenya. Tulis = boleh mencatat, menyetujui, menghapus, dan mengunci untuk PT tersebut.",
    page: "/dashboard/kpi/log",
    apis: [
      "/api/kpi-entries",
      "/api/kpi-entries/pending",
      "/api/kpi-entries/collect",
      "/api/kpi-periods",
      "/api/kpi-monthly-results",
    ],
    // SENGAJA per-PT, tidak seperti `kpi.config`/`kpi.definitions` di atas.
    // Yang dibagi seluruh PT adalah *definisi* dan *bobot* KPI; yang dinilai di
    // sini adalah entri milik karyawan, dan karyawan dimiliki satu PT lewat
    // cabangnya. Menjadikannya global berarti siapa pun yang boleh menilai ikut
    // menilai karyawan PT lain — lebih luas daripada perilaku yang berjalan
    // (dulu `assertKpiCompanyAccess` mengunci peninjau ke PT-nya sendiri).
    //
    // Tanpa peta legacy, sama seperti dua resource KPI di atas: gerbang lama
    // (`KPI_APPROVE` di kpi.service) tidak lagi berlaku begitu modulnya pindah
    // ke sini, dan pendelegasiannya harus eksplisit lewat matriks izin.
  },
  // ── Payroll ────────────────────────────────────────────────────────────────
  {
    key: "payroll.self",
    label: "Slip Gaji Saya",
    group: "Payroll",
    description: "Slip gaji milik sendiri.",
    scoping: "self",
    legacy: { view: PERMISSIONS.PAYROLL_VIEW_OWN },
  },
  {
    key: "payroll.manage",
    label: "Hitung Gaji",
    group: "Payroll",
    description: "Perhitungan dan proses penggajian seluruh karyawan.",
    page: "/dashboard/payroll",
    apis: ["/api/payroll"],
    // Per-PT (`scoping` default "company"): gaji dimiliki satu PT, jadi sebuah
    // jabatan bisa diberi wewenang menghitung gaji PT tertentu saja. Halamannya
    // menyaring daftar karyawan dengan scope ini sebelum orangnya dipilih.
    //
    // Sengaja TANPA peta legacy — sama seperti section KPI: sebelum didelegasikan
    // lewat matriks, hanya Owner & Super Admin yang berhak. Karyawan biasa tetap
    // melihat slip gajinya sendiri lewat `payroll.self`.
  },

  {
    key: "payroll.components",
    label: "Komponen Gaji",
    group: "Payroll",
    description:
      "Daftar induk tunjangan & potongan tambahan di luar gaji pokok, uang makan, transport, jabatan, dan BPJS.",
    page: "/dashboard/payroll/komponen",
    apis: ["/api/salary-components"],
    // Per-PT: tiap PT boleh punya daftar tunjangan sendiri. Komponen global
    // (companyId null) hanya bisa dibuat oleh pemegang scope seluruh PT.
    //
    // Tanpa peta legacy — sama seperti `payroll.manage`, hanya Owner & Super
    // Admin sebelum didelegasikan lewat matriks izin.
  },

  {
    key: "payroll.rules",
    label: "Rule Reward & Denda",
    group: "Payroll",
    description:
      "Aturan bonus, denda, dan potongan yang dipakai engine slip gaji, beserta hasil validasinya.",
    page: "/dashboard/payroll/rules",
    apis: ["/api/payroll-rules"],
    // `global` disengaja: rule berlaku lintas PT, dan sasaran per PT ditentukan
    // DI DALAM rule (`targets`), bukan oleh siapa yang boleh membuka halamannya.
    // Memecah izin ini per PT akan menjanjikan penyaringan yang tidak ada —
    // pemegangnya tetap melihat dan menyunting rule yang mengenai PT lain.
    //
    // Tulis di sini berarti: tier, nominal, sasaran, masa berlaku. TIDAK
    // termasuk SQL — itu `payroll.rules.sql` di bawah.
    scoping: "global",
  },

  {
    key: "payroll.rules.sql",
    label: "Ubah SQL Rule Gaji",
    group: "Payroll",
    description:
      "Menyunting query pengambil data di dalam rule gaji. Terpisah dari izin mengubah nominalnya — SQL menentukan APA yang diukur, tier menentukan BERAPA harganya, dan keduanya butuh keahlian yang berbeda.",
    // `capability`, bukan halaman: ia tidak membuka apa pun, ia membuka satu
    // field di halaman yang sudah dijaga `payroll.rules`.
    capability: true,
    // Sengaja TIDAK di-scope per PT. SQL rule membaca view lintas PT; memberi
    // seseorang wewenang menulisnya "hanya untuk PT A" adalah janji kosong,
    // karena query yang sama tetap bisa membaca baris PT lain.
    scoping: "global",
    // Tanpa peta legacy, dan itu inti dari resource ini: sebelum diberikan
    // eksplisit lewat matriks izin, TIDAK ADA yang bisa menyunting SQL rule —
    // termasuk pemegang `payroll.rules` dan `payroll.manage`.
  },

  // ── Laporan ────────────────────────────────────────────────────────────────
  // Section "Laporan" di sidebar. Ketiganya `scoping: "global"` — isinya
  // memang laporan lintas PT (peringkat karyawan antar cabang, posisi keuangan
  // konsolidasi, kurs pasar yang tidak dimiliki PT mana pun), jadi memecahnya
  // per PT tidak menghasilkan laporan yang bermakna. Halaman baca saja: tidak
  // ada sumbu tulis sama sekali.
  {
    key: "kpi.analytics",
    label: "Analisis Kinerja",
    group: "Laporan",
    description: "Agregat KPI lintas cabang dan periode.",
    page: "/dashboard/kpi/analisis",
    scoping: "global",
    readOnly: true,
    // Sengaja TANPA peta legacy: halaman ini memeringkat karyawan lintas PT dan
    // hari ini hanya terbuka untuk role global. Memberinya legacy KPI_VIEW_ALL
    // akan diam-diam membukanya untuk HR & Kepala Cabang saat rollout.
  },
  {
    key: "finance.report",
    label: "Laporan Finance",
    group: "Laporan",
    description: "Posisi keuangan konsolidasi seluruh PT.",
    page: "/dashboard/laporan-finance",
    scoping: "global",
    readOnly: true,
    // Tanpa peta legacy — hari ini global-only (requireGlobalPageCaller).
  },
  {
    key: "watcher.valas",
    label: "Watcher Valas",
    group: "Laporan",
    description: "Pemantauan pergerakan kurs.",
    page: "/dashboard/watcher-valas",
    apis: ["/api/watcher-valas", "/api/watcher-valas/scrape"],
    // Global: yang dipantau adalah kurs pasar (SmartDeal vs Yahoo Finance),
    // bukan data milik satu PT. Peta legacy dipertahankan supaya jabatan yang
    // belum dimigrasi tidak kehilangan akses; untuk resource global, legacy
    // menghasilkan akses penuh — sama seperti perilaku sekarang.
    scoping: "global",
    readOnly: true,
    legacy: { view: PERMISSIONS.STOCKIST_VIEW },
  },

  // ── Keuangan ───────────────────────────────────────────────────────────────
  {
    key: "bank.accounts",
    label: "Rekening Bank",
    group: "Keuangan",
    description: "Daftar rekening bank dan saldonya.",
    page: "/dashboard/bank-accounts",
    apis: ["/api/bank-accounts"],
    legacy: { view: PERMISSIONS.BANK_VIEW, write: PERMISSIONS.BANK_MANAGE },
  },
  {
    key: "bank.daily",
    label: "Saldo Bank Harian",
    group: "Keuangan",
    description: "Input saldo bank harian per cabang.",
    page: "/dashboard/stockist/bank",
    apis: ["/api/bank-harian"],
    legacy: { view: PERMISSIONS.BANK_VIEW, write: PERMISSIONS.BANK_DAILY_INPUT },
  },
  {
    key: "finance.receivable",
    label: "Dana Tertahan (Hutang)",
    group: "Keuangan",
    description:
      "Catatan uang yang belum masuk — hutang orang ke perusahaan, per tanggal. Tulis = boleh menambah pihak baru, mengubah nama & jumlahnya, dan menghapus barisnya. Mengubah baris bertanggal lampau tetap butuh izin ubah tanggal lampau.",
    page: "/dashboard/hutang",
    apis: ["/api/dana-tertahan"],
    // Per-PT (`scoping` default "company"): piutangnya milik satu PT, dan
    // halamannya berpindah PT seperti Saldo Bank Harian. Tanpa peta legacy —
    // modul baru, jadi tidak ada permission lama yang setara; sebelum
    // didelegasikan lewat matriks hanya Owner & Super Admin yang berhak.
  },
  {
    // Kemampuan, bukan halaman: hak MENYATAKAN LUNAS sengaja dipisah dari hak
    // ubah isi. Yang mencatat hutang (kasir/marketing) belum tentu yang berhak
    // menyatakan uangnya sudah masuk — kalau keduanya satu sakelar, orang yang
    // mencatat piutang bisa menghapusnya dari laporan sendiri.
    //
    // Berlaku untuk hari berjalan MAUPUN tanggal lampau, dan sengaja TIDAK ikut
    // digerbangi `daily.backdate`: pelunasan hari lampau adalah alur normalnya
    // (uangnya baru masuk hari ini untuk hutang minggu lalu), bukan pembetulan
    // angka yang sudah lewat.
    key: "finance.receivable.settle",
    label: "Menyatakan Dana Tertahan Lunas",
    group: "Keuangan",
    description:
      "Menandai hutang sudah dibayar, maupun membatalkan penandaan itu — untuk hari berjalan dan tanggal lampau. Tanpa ini, isi hutang boleh diubah tapi statusnya tidak.",
    capability: true,
    apis: ["/api/dana-tertahan"],
  },

  // ── Stok & Valas ───────────────────────────────────────────────────────────
  {
    key: "stockist.daily",
    label: "Stock & Kas Harian",
    group: "Stok & Valas",
    description: "Saldo mata uang dan kas harian per cabang.",
    page: "/dashboard/stockist",
    apis: ["/api/stockist"],
    legacy: { view: PERMISSIONS.STOCKIST_VIEW, write: PERMISSIONS.STOCKIST_MANAGE },
  },
  {
    // Bukan halaman, melainkan kemampuan tambahan yang berlaku untuk SEMUA input
    // harian (stock, kas, bank, cross-check). Sebelumnya dikunci ke isGlobalRole,
    // sehingga mustahil didelegasikan — dan di halaman Cross-Check sempat
    // menumpang variabel "boleh memilih PT", yang tidak ada kaitannya.
    key: "daily.backdate",
    label: "Ubah Angka Tanggal Lampau",
    group: "Stok & Valas",
    description:
      "Mengubah input harian untuk tanggal yang sudah lewat (stock, kas, bank, cross-check). Tanpa ini, hanya hari berjalan yang bisa diisi.",
    capability: true,
    // Tanpa peta legacy: hari ini hanya role global yang boleh, dan delegasinya
    // dilakukan eksplisit lewat matriks.
  },
  {
    key: "stockist.verify",
    label: "Cross-Check Stock",
    group: "Stok & Valas",
    description: "Verifikasi dan konfirmasi angka harian cabang.",
    page: "/dashboard/stockist/konfirmasi",
    apis: ["/api/stockist"],
    legacy: { view: PERMISSIONS.STOCKIST_VERIFY, write: PERMISSIONS.STOCKIST_VERIFY },
  },
  {
    key: "stock.pt",
    label: "Stock Management (PT)",
    group: "Stok & Valas",
    description: "Stok barang tingkat PT dan mutasinya.",
    page: "/dashboard/stock-management-pt",
    apis: ["/api/company-stock-items"],
    legacy: { view: PERMISSIONS.COMPANY_STOCK_VIEW, write: PERMISSIONS.COMPANY_STOCK_MANAGE },
  },
  {
    key: "currency",
    label: "Mata Uang & Kurs",
    group: "Stok & Valas",
    description: "Master mata uang yang dipakai seluruh modul valas.",
    page: "/dashboard/mata-uang",
    apis: ["/api/currencies", "/api/exchange-rates"],
    // Global: tabel `Currency` tidak punya kolom companyId — daftarnya satu untuk
    // seluruh PT. Sebelumnya resource ini company-scoped, jadi matriks menawarkan
    // pilihan "PT sendiri / PT tertentu" yang tidak berpengaruh apa pun: menambah
    // atau menghapus mata uang selalu berlaku ke semua PT. Sakelar yang tidak
    // berpengaruh lebih buruk daripada tidak ada sakelar.
    //
    // Stok valas per cabang TIDAK ikut ke sini — lihat `currency.stock` di bawah.
    scoping: "global",
    legacy: { view: PERMISSIONS.CURRENCY_VIEW, write: PERMISSIONS.CURRENCY_MANAGE },
  },
  {
    // Dipecah dari `currency`: `CurrencyStock` melekat pada cabang, jadi datanya
    // memang milik satu PT dan endpoint-nya menyaring dengan `authz.companyIds`
    // serta `assertCompany`. Kalau ia ikut jadi global, penyaringan itu mati —
    // `companyIds: null` berarti "semua PT" — dan stok seluruh PT terbuka lagi.
    key: "currency.stock",
    label: "Stok Valas per Cabang",
    group: "Stok & Valas",
    description: "Kuantitas dan kurs beli/jual mata uang yang dipegang tiap cabang.",
    apis: ["/api/currency-stock"],
    legacy: { view: PERMISSIONS.CURRENCY_VIEW, write: PERMISSIONS.CURRENCY_MANAGE },
  },
  {
    key: "currency.price",
    label: "Harga Valas",
    group: "Stok & Valas",
    description: "Harga beli & jual yang dipakai perusahaan hari ini.",
    page: "/dashboard/harga-valas",
    apis: ["/api/harga-valas"],
    // Global, dengan alasan yang sama seperti `currency`: `CurrencyPrice` unik
    // per mata uang tanpa companyId, jadi satu harga dipakai seluruh PT. Hak
    // tulis "untuk PT A saja" dulu tetap mengubah harga yang dipakai PT B & C.
    scoping: "global",
    legacy: { view: PERMISSIONS.CURRENCY_VIEW, write: PERMISSIONS.CURRENCY_MANAGE },
  },
  {
    key: "price.benchmark",
    label: "Patokan Harga",
    group: "Stok & Valas",
    description: "Harga patokan dan penyesuaiannya.",
    page: "/dashboard/patokan-harga",
    apis: ["/api/patokan-harga"],
    // Global: patokan harga adalah acuan tunggal yang dipakai seluruh PT —
    // memecahnya per PT akan menghasilkan dua harga acuan yang bertentangan.
    // Tanpa peta legacy: hanya role global sampai didelegasikan lewat matriks.
    scoping: "global",
  },
  // ── Koreksi ────────────────────────────────────────────────────────────────
  {
    key: "correction",
    label: "Persetujuan Koreksi",
    group: "Koreksi",
    description: "Pengajuan dan persetujuan koreksi angka harian.",
    page: "/dashboard/persetujuan-koreksi",
    apis: ["/api/koreksi"],
    // Global: keputusan koreksi mengubah saldo, jadi wewenangnya tidak dipecah
    // per PT. Tanpa peta legacy — hanya role global sampai didelegasikan.
    scoping: "global",
  },
  {
    // Kemampuan, bukan halaman: pemegangnya tidak perlu mengantre di Persetujuan
    // Koreksi — angka penggantinya langsung diterapkan. Jejaknya TIDAK hilang:
    // pengajuan tetap dibuat lalu ditandai APPROVED atas nama si pengubah, jadi
    // riwayat "pernah dikoreksi" dan alasannya tetap utuh.
    //
    // Sengaja per-PT (`scoping` default "company"), bukan dikunci ke role global:
    // wewenang ini bisa diberikan ke Kepala Cabang PT tertentu saja.
    key: "correction.direct",
    label: "Koreksi Langsung Tanpa Persetujuan",
    group: "Koreksi",
    description:
      "Mengubah angka harian stock, kas, dan bank tanpa menunggu ACC. Tanpa ini, angka pengganti hanya diajukan dan baru berlaku setelah disetujui.",
    capability: true,
    // Tanpa peta legacy: wewenangnya harus diberikan eksplisit lewat matriks.
  },

  // ── Manajemen ──────────────────────────────────────────────────────────────
  {
    key: "users",
    label: "Pengguna",
    group: "Manajemen",
    description:
      "Daftar pengguna beserta pembuatan, pengubahan, dan penghapusannya. Tulis = boleh tambah/ubah/hapus pengguna pada PT tersebut.",
    page: "/dashboard/users",
    apis: ["/api/users", "/api/admin/users"],
    // Per-PT: seorang pengguna dimiliki satu PT lewat cabangnya, jadi wewenang
    // mengelola pengguna bisa dibatasi per PT. Sebelumnya halamannya dikunci
    // `isAdminRole` — gerbang peran yang tak terlihat di matriks izin dan
    // mustahil didelegasikan ke HR. Kini gerbangnya resource ini.
    legacy: { view: PERMISSIONS.USERS_VIEW, write: PERMISSIONS.USERS_MANAGE },
  },
  {
    key: "users.detail",
    label: "Detail Karyawan",
    group: "Manajemen",
    description: "Rapor lengkap satu karyawan: KPI, gaji, dan kehadiran.",
    page: "/dashboard/users/[id]",
    readOnly: true,
    legacy: { view: PERMISSIONS.USERS_VIEW_DETAIL },
  },
  {
    key: "companies",
    label: "PT (Perusahaan)",
    group: "Manajemen",
    description: "Daftar badan usaha (PT) yang menaungi seluruh cabang.",
    page: "/dashboard/pt",
    apis: ["/api/companies"],
    // Global: PT adalah dimensi scope itu sendiri, jadi tidak bisa dipecah
    // per PT — sebuah jabatan yang boleh menambah/menghapus PT dengan sendirinya
    // bekerja lintas PT. Tanpa peta legacy: hanya Owner & Super Admin sampai
    // didelegasikan eksplisit lewat matriks izin.
    scoping: "global",
  },
  {
    key: "branches",
    label: "Cabang",
    group: "Manajemen",
    description:
      "Daftar kantor cabang per PT. Tulis = boleh tambah/ubah/hapus cabang pada PT tersebut.",
    page: "/dashboard/branches",
    apis: ["/api/branches"],
    legacy: { view: PERMISSIONS.BRANCHES_VIEW, write: PERMISSIONS.BRANCHES_MANAGE },
  },
  {
    key: "roles",
    label: "Jabatan & Akses",
    group: "Manajemen",
    description:
      "Kelola jabatan beserta matriks izinnya, lintas seluruh PT. Tulis = boleh tambah/ubah/hapus jabatan dan mengatur izinnya.",
    page: "/dashboard/roles",
    apis: ["/api/roles"],
    // Global: matriks izin adalah satu sistem yang sama untuk seluruh PT —
    // memecahnya per PT akan menghasilkan dua definisi wewenang yang saling
    // bertentangan, dan halamannya memang menampilkan jabatan semua PT.
    //
    // Sengaja TANPA peta legacy, meski ROLES_VIEW/ROLES_MANAGE masih ada di
    // beberapa jabatan (Admin, Kepala Cabang). Untuk resource global, fallback
    // legacy menghasilkan akses PENUH — jabatan yang hari ini hanya melihat
    // jabatan PT-nya sendiri akan mendadak melihat dan mengubah jabatan seluruh
    // PT. Di halaman inilah izin diberikan, jadi eskalasi di sini adalah
    // eskalasi atas segalanya. Karena itu default-nya hanya Super Admin & Owner,
    // dan pendelegasiannya harus eksplisit lewat matriks.
    scoping: "global",
  },
];

export type ResourceKey = string;

const BY_KEY = new Map(RESOURCES.map((r) => [r.key, r]));

export function getResource(key: ResourceKey): ResourceDef | undefined {
  return BY_KEY.get(key);
}

/** Resource dikelompokkan per `group`, urutannya mengikuti urutan deklarasi. */
export function resourcesByGroup(): { group: string; items: ResourceDef[] }[] {
  const groups: { group: string; items: ResourceDef[] }[] = [];
  for (const r of RESOURCES) {
    let g = groups.find((x) => x.group === r.group);
    if (!g) {
      g = { group: r.group, items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }
  return groups;
}
