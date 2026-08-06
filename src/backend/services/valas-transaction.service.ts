import prisma from "@/lib/prisma";
import type { Authz } from "@/backend/helpers/authz";
import { ForbiddenError, NotFoundError, ValidationError } from "@/backend/errors/app-error";
import { allowsCompany } from "@/lib/authz/resolve";
import { isPastDate, todayDateOnly } from "@/backend/helpers/date-only";
import { currencyPriceRepository } from "@/backend/repositories/currency-price.repository";
import { currencyRepository } from "@/backend/repositories/currency.repository";
import {
  valasTransactionRepository,
  type CreateValasTransactionInput,
  type ValasTransactionFilter,
  type ValasTransactionRecord,
} from "@/backend/repositories/valas-transaction.repository";
import type {
  ValasCustomerIdType,
  ValasPaymentMethod,
  ValasTransactionType,
} from "@src/generated/prisma/client";

/**
 * Ambang wajib identitas. Di atas nilai ini, transaksi tidak bisa disimpan tanpa
 * jenis + nomor identitas nasabah — kewajiban pelaporan KUPVA BB (PPATK), dan
 * satu-satunya alasan modul ini menyimpan data identitas sama sekali. Di bawah
 * ambang, identitas boleh diisi tapi tidak dipaksakan: memaksa fotokopi KTP
 * untuk penukaran 50 dolar hanya membuat kasir mengisi data palsu.
 *
 * Angkanya sengaja konstanta di kode, bukan setting: mengubahnya adalah
 * keputusan kepatuhan, bukan preferensi operasional.
 */
export const IDENTITY_REQUIRED_THRESHOLD = 100_000_000;

/** Satu baris transaksi sebagaimana dilihat halaman & API. */
export interface ValasTransactionRow {
  id: string;
  invoiceNo: string;
  date: string;
  type: ValasTransactionType;
  currencyId: string;
  currencyCode: string;
  currencyName: string;
  amount: number;
  rate: number;
  /** Harga Valas yang berlaku saat transaksi dibuat. Null = belum ada harganya. */
  priceRate: number | null;
  /** rate - priceRate, dari sudut untung perusahaan. Null bila priceRate null. */
  rateDelta: number | null;
  totalIdr: number;
  customerName: string;
  customerPhone: string | null;
  customerIdType: ValasCustomerIdType | null;
  customerIdNumber: string | null;
  customerAddress: string | null;
  paymentMethod: ValasPaymentMethod;
  bankAccountId: string | null;
  bankAccountLabel: string | null;
  note: string | null;
  status: "COMPLETED" | "VOID";
  voidedAt: string | null;
  voidReason: string | null;
  branchId: string | null;
  branchName: string | null;
  companyId: string;
  createdAt: string;
}

export function toRow(r: ValasTransactionRecord): ValasTransactionRow {
  const rate = Number(r.rate);
  const priceRate = r.priceRate == null ? null : Number(r.priceRate);

  return {
    id: r.id,
    invoiceNo: r.invoiceNo,
    date: r.date.toISOString().slice(0, 10),
    type: r.type,
    currencyId: r.currencyId,
    currencyCode: r.currency.code,
    currencyName: r.currency.name,
    amount: Number(r.amount),
    rate,
    priceRate,
    // Tanda mengikuti UNTUNG perusahaan, bukan selisih mentah: saat MENJUAL,
    // kurs di atas harga berarti untung (+); saat MEMBELI, kurs di bawah harga
    // yang berarti untung. Tanpa pembalikan ini, kolomnya membaca terbalik di
    // separuh transaksi.
    rateDelta:
      priceRate == null
        ? null
        : Math.round((r.type === "SELL" ? rate - priceRate : priceRate - rate) * 1e4) / 1e4,
    totalIdr: Number(r.totalIdr),
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerIdType: r.customerIdType,
    customerIdNumber: r.customerIdNumber,
    customerAddress: r.customerAddress,
    paymentMethod: r.paymentMethod,
    bankAccountId: r.bankAccountId,
    bankAccountLabel: r.bankAccount
      ? [r.bankAccount.bankName, r.bankAccount.accountNumber].filter(Boolean).join(" · ")
      : null,
    note: r.note,
    status: r.status,
    voidedAt: r.voidedAt?.toISOString() ?? null,
    voidReason: r.voidReason,
    branchId: r.branchId,
    branchName: r.branch?.name ?? null,
    companyId: r.companyId,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Gerbang tanggal, sama persis dengan modul harian lain: hari berjalan boleh
 * dicatat siapa pun yang berhak menulis, tanggal lampau butuh `daily.backdate`
 * untuk PT itu. Transaksi susulan memang terjadi (kasir lupa input kemarin),
 * tapi mencatat penjualan bertanggal mundur menggeser laporan yang sudah
 * di-cross-check — jadi wewenangnya sama dengan mengubah angka lampau.
 */
export function assertTransactionDate(authz: Authz, companyId: string, date: Date) {
  if (date.getTime() > todayDateOnly().getTime()) {
    throw new ValidationError("Tanggal transaksi tidak boleh di masa depan");
  }
  if (!isPastDate(date)) return;
  if (!allowsCompany(authz.subject, "daily.backdate", "write", companyId)) {
    throw new ForbiddenError("Tanggal sudah lewat — perlu izin ubah tanggal lampau");
  }
}

/** Membulatkan ke rupiah penuh: tidak ada pecahan sen di transaksi loket. */
function roundIdr(value: number): number {
  return Math.round(value);
}

/**
 * Nomor bukti: "{KODE_PT}/{JL|BL}/{YYMMDD}/{urut}". Urutannya per PT per jenis
 * per tanggal, dibaca dari nomor terbesar yang sudah ada (bukan COUNT — lihat
 * repository) lalu ditambah satu.
 */
function invoicePrefix(companyCode: string, type: ValasTransactionType, date: Date): string {
  const ymd = date.toISOString().slice(2, 10).replace(/-/g, "");
  return `${companyCode}/${type === "SELL" ? "JL" : "BL"}/${ymd}/`;
}

async function nextInvoiceNo(
  companyId: string,
  companyCode: string,
  type: ValasTransactionType,
  date: Date,
  attempt: number
): Promise<string> {
  const prefix = invoicePrefix(companyCode, type, date);
  const last = await valasTransactionRepository.lastInvoiceNoWithPrefix(companyId, prefix);
  const lastSeq = last ? Number(last.slice(prefix.length)) : 0;
  const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1 + attempt;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export type CreateValasTransactionArgs = {
  companyId: string;
  branchId?: string | null;
  date: Date;
  type: ValasTransactionType;
  currencyId: string;
  amount: number;
  /** Kurs manual. Kosong = pakai Harga Valas yang berlaku. */
  rate?: number | null;
  customerName: string;
  customerPhone?: string | null;
  customerIdType?: ValasCustomerIdType | null;
  customerIdNumber?: string | null;
  customerAddress?: string | null;
  paymentMethod?: ValasPaymentMethod;
  bankAccountId?: string | null;
  note?: string | null;
  createdBy: string | null;
};

export const valasTransactionService = {
  /**
   * Harga yang berlaku untuk satu sisi transaksi, dari Harga Valas.
   * BUY → `buyPrice` (kita membeli dari nasabah), SELL → `sellPrice`.
   */
  async priceFor(currencyId: string, type: ValasTransactionType): Promise<number | null> {
    const price = await currencyPriceRepository.findByCurrencyId(currencyId);
    if (!price) return null;
    return Number(type === "BUY" ? price.buyPrice : price.sellPrice);
  },

  /**
   * Daftar mata uang + harga beli/jual siap pakai untuk form. Sengaja hanya
   * mata uang AKTIF yang SUDAH punya harga: menawarkan mata uang tanpa harga
   * hanya memindahkan kegagalan ke tombol Simpan.
   */
  async priceOptions() {
    const rows = await currencyPriceRepository.findAllWithCurrency(true);
    return rows.flatMap((c) =>
      c.price
        ? [
            {
              currencyId: c.id,
              code: c.code,
              name: c.name,
              symbol: c.symbol,
              buyPrice: Number(c.price.buyPrice),
              sellPrice: Number(c.price.sellPrice),
            },
          ]
        : []
    );
  },

  async getById(id: string): Promise<ValasTransactionRow> {
    const row = await valasTransactionRepository.findById(id);
    if (!row) throw new NotFoundError("Transaksi tidak ditemukan");
    return toRow(row);
  },

  async list(filter: ValasTransactionFilter, limit?: number): Promise<ValasTransactionRow[]> {
    const rows = await valasTransactionRepository.findMany(filter, limit);
    return rows.map(toRow);
  },

  /**
   * Membuat satu transaksi. Kurs, total, dan nomor bukti selalu ditentukan di
   * sini — angka yang dikirim klien untuk ketiganya tidak pernah dipercaya.
   */
  async create(input: CreateValasTransactionArgs): Promise<ValasTransactionRow> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ValidationError("Jumlah valas harus lebih dari nol");
    }

    const [company, currency] = await Promise.all([
      prisma.company.findUnique({
        where: { id: input.companyId },
        select: { id: true, code: true },
      }),
      currencyRepository.findById(input.currencyId),
    ]);
    if (!company) throw new NotFoundError("PT tidak ditemukan");
    if (!currency) throw new NotFoundError("Mata uang tidak ditemukan");
    if (!currency.isActive) {
      throw new ValidationError(`Mata uang ${currency.code} sedang tidak aktif`);
    }

    const priceRate = await valasTransactionService.priceFor(input.currencyId, input.type);
    const rate = input.rate ?? priceRate;
    if (rate == null) {
      throw new ValidationError(
        `Harga ${input.type === "BUY" ? "beli" : "jual"} ${currency.code} belum diisi di Harga Valas — isi dulu atau masukkan kurs manual`
      );
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new ValidationError("Kurs harus lebih dari nol");
    }

    const totalIdr = roundIdr(input.amount * rate);

    // Ambang identitas diuji terhadap total yang SUDAH dihitung server, bukan
    // yang dikirim klien — kalau tidak, ambangnya bisa dilewati dengan mengirim
    // total palsu yang kecil.
    if (totalIdr >= IDENTITY_REQUIRED_THRESHOLD) {
      if (!input.customerIdType || !input.customerIdNumber?.trim()) {
        throw new ValidationError(
          `Transaksi ≥ Rp ${IDENTITY_REQUIRED_THRESHOLD.toLocaleString("id-ID")} wajib mencantumkan jenis dan nomor identitas nasabah`
        );
      }
    }

    const paymentMethod: ValasPaymentMethod = input.paymentMethod ?? "CASH";
    let bankAccountId = input.bankAccountId ?? null;
    if (paymentMethod === "TRANSFER") {
      if (!bankAccountId) {
        throw new ValidationError("Pembayaran transfer harus memilih rekening");
      }
      // Rekening milik PT lain tidak boleh dipakai — kalau lolos, mutasi
      // uangnya tercatat di PT yang bukan pemilik transaksinya.
      const account = await prisma.bankAccount.findUnique({
        where: { id: bankAccountId },
        select: { companyId: true, isActive: true },
      });
      if (!account || account.companyId !== input.companyId) {
        throw new ValidationError("Rekening tidak ditemukan pada PT ini");
      }
      if (!account.isActive) throw new ValidationError("Rekening sudah tidak aktif");
    } else {
      // Tunai tidak boleh menyimpan rekening — kalau tersimpan, laporan arus
      // bank ikut menghitung uang yang tidak pernah lewat bank.
      bankAccountId = null;
    }

    const base: Omit<CreateValasTransactionInput, "invoiceNo"> = {
      companyId: input.companyId,
      branchId: input.branchId ?? null,
      date: input.date,
      type: input.type,
      currencyId: input.currencyId,
      amount: input.amount,
      rate,
      priceRate,
      totalIdr,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone?.trim() || null,
      customerIdType: input.customerIdType ?? null,
      customerIdNumber: input.customerIdNumber?.trim() || null,
      customerAddress: input.customerAddress?.trim() || null,
      paymentMethod,
      bankAccountId,
      note: input.note?.trim() || null,
      createdBy: input.createdBy,
    };

    // Nomor bukti dijaga unique index, bukan lock: dua kasir yang menekan
    // Simpan pada detik yang sama menghasilkan satu P2002, yang di-retry dengan
    // nomor berikutnya. Lebih murah daripada mengunci tabel di setiap transaksi.
    for (let attempt = 0; attempt < 5; attempt++) {
      const invoiceNo = await nextInvoiceNo(
        company.id,
        company.code,
        input.type,
        input.date,
        attempt
      );
      try {
        return toRow(await valasTransactionRepository.create({ ...base, invoiceNo }));
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== "P2002") throw e;
      }
    }
    throw new ValidationError("Gagal membuat nomor bukti — coba simpan ulang");
  },

  /** Membatalkan transaksi. Menandai VOID, tidak menghapus. */
  async void(id: string, reason: string, userId: string | null): Promise<ValasTransactionRow> {
    const existing = await valasTransactionRepository.findById(id);
    if (!existing) throw new NotFoundError("Transaksi tidak ditemukan");
    if (existing.status === "VOID") {
      throw new ValidationError("Transaksi ini sudah dibatalkan");
    }
    if (!reason.trim()) {
      throw new ValidationError("Alasan pembatalan wajib diisi");
    }

    const count = await valasTransactionRepository.void(id, userId, reason.trim());
    if (count === 0) throw new ValidationError("Transaksi ini sudah dibatalkan");

    return valasTransactionService.getById(id);
  },
};

/**
 * Payload lengkap halaman Transaksi Valas, dipakai bersama oleh
 * `GET /api/valas-transactions` dan halaman yang dirender server — satu bentuk
 * data, jadi keduanya mustahil berbeda. Alasannya sama seperti Dana Tertahan:
 * DB-nya remote, jadi fetch pertama setelah hydrate adalah satu perjalanan penuh
 * browser → function → database yang bisa dihilangkan.
 *
 * Menegakkan scope PT si pemanggil — jangan dipanggil dengan companyId yang
 * belum divalidasi.
 */
export async function buildValasTransactionPayload(
  authz: Authz,
  companyId: string,
  date: Date,
  opts: { type?: ValasTransactionType; currencyId?: string; q?: string } = {}
) {
  if (!authz.canView(companyId)) {
    throw new ForbiddenError("Tidak punya akses ke PT ini");
  }

  const filter: ValasTransactionFilter = {
    companyIds: authz.companyIds,
    companyId,
    date,
    type: opts.type,
    currencyId: opts.currencyId,
    q: opts.q,
    includeVoid: true,
  };

  const [rows, summary, byCurrency, prices, bankAccounts] = await Promise.all([
    valasTransactionService.list(filter),
    // Rekap sengaja tanpa filter jenis/mata uang/pencarian: angkanya adalah
    // posisi hari itu, bukan ringkasan dari apa yang kebetulan sedang disaring
    // di layar — kalau ikut tersaring, totalnya berubah setiap kali user
    // mengetik di kotak cari dan tidak lagi bisa dicocokkan dengan setoran kas.
    valasTransactionRepository.summarize({ companyIds: authz.companyIds, companyId, date }),
    valasTransactionRepository.summarizeByCurrency({
      companyIds: authz.companyIds,
      companyId,
      date,
    }),
    valasTransactionService.priceOptions(),
    // Hanya rekening PT ini — form transfer tidak boleh menawarkan rekening PT
    // lain, dan service menolaknya lagi saat menyimpan.
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { bankName: "asc" }],
      select: { id: true, bankName: true, accountNumber: true, accountName: true },
    }),
  ]);

  const codeOf = new Map(prices.map((p) => [p.currencyId, p.code]));

  return {
    serverDate: todayDateOnly().toISOString().slice(0, 10),
    rows,
    summary: {
      ...summary,
      /** Selisih rupiah masuk vs keluar hari itu — bukan laba. */
      net: summary.buy.total - summary.sell.total,
    },
    byCurrency: byCurrency.map((c) => ({
      ...c,
      code: codeOf.get(c.currencyId) ?? rows.find((r) => r.currencyId === c.currencyId)?.currencyCode ?? "—",
    })),
    prices,
    bankAccounts,
    identityThreshold: IDENTITY_REQUIRED_THRESHOLD,
    canInput: authz.canWrite(companyId),
    canVoid: allowsCompany(authz.subject, "valas.transaction.void", "write", companyId),
  };
}

export type ValasTransactionPayload = Awaited<ReturnType<typeof buildValasTransactionPayload>>;
