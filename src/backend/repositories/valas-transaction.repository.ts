import prisma from "@/lib/prisma";
import { Prisma } from "@src/generated/prisma/client";
import type {
  ValasCustomerIdType,
  ValasPaymentMethod,
  ValasTransactionType,
} from "@src/generated/prisma/client";

/**
 * Transaksi Jual & Beli Valas.
 *
 * Dua pola baca yang harus tetap terpisah, sama seperti Dana Tertahan:
 *
 * • **Per tanggal** (`findMany`) — isi halaman loket. Boleh kosong.
 * • **Rekap rentang** (`summarize`, `summarizeByCurrency`) — angka laporan,
 *   dihitung di database supaya jumlah baris tidak ikut terbawa ke Node.
 *
 * Baris VOID selalu dikecualikan dari rekap tapi TETAP ikut di daftar: bukti
 * bernomor yang hilang dari layar adalah lubang di jejak audit.
 */

const listSelect = {
  id: true,
  invoiceNo: true,
  date: true,
  type: true,
  currencyId: true,
  amount: true,
  rate: true,
  priceRate: true,
  totalIdr: true,
  customerName: true,
  customerPhone: true,
  customerIdType: true,
  customerIdNumber: true,
  customerAddress: true,
  paymentMethod: true,
  bankAccountId: true,
  note: true,
  status: true,
  voidedAt: true,
  voidReason: true,
  branchId: true,
  companyId: true,
  createdBy: true,
  createdAt: true,
  currency: { select: { code: true, name: true, symbol: true } },
  branch: { select: { name: true } },
  bankAccount: { select: { bankName: true, accountNumber: true } },
} satisfies Prisma.ValasTransactionSelect;

export type ValasTransactionRecord = Prisma.ValasTransactionGetPayload<{
  select: typeof listSelect;
}>;

export type ValasTransactionFilter = {
  /** null = seluruh PT (pemanggil global). */
  companyIds: string[] | null;
  companyId?: string;
  /** Tanggal tunggal — dipakai halaman loket. */
  date?: Date;
  /** Rentang tanggal — dipakai laporan. Diabaikan kalau `date` diisi. */
  from?: Date;
  to?: Date;
  type?: ValasTransactionType;
  currencyId?: string;
  /** Cari di nomor bukti / nama nasabah / nomor identitas. */
  q?: string;
  /** Default: ikut menampilkan yang VOID. */
  includeVoid?: boolean;
};

function whereOf(filter: ValasTransactionFilter): Prisma.ValasTransactionWhereInput {
  const where: Prisma.ValasTransactionWhereInput = {};

  // Scope PT ditegakkan sebagai IRISAN, bukan pilihan: `companyId` dari query
  // tetap harus berada di dalam `companyIds` milik pemanggil. Kalau salah satu
  // saja yang dipakai, query bisa lolos ke PT lain.
  if (filter.companyIds) where.companyId = { in: filter.companyIds };
  if (filter.companyId) {
    where.companyId = filter.companyIds
      ? { in: filter.companyIds.filter((id) => id === filter.companyId) }
      : filter.companyId;
  }

  if (filter.date) where.date = filter.date;
  else if (filter.from || filter.to) {
    where.date = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  if (filter.type) where.type = filter.type;
  if (filter.currencyId) where.currencyId = filter.currencyId;
  if (!filter.includeVoid) where.status = "COMPLETED";

  const q = filter.q?.trim();
  if (q) {
    where.OR = [
      { invoiceNo: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerIdNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export type CreateValasTransactionInput = {
  companyId: string;
  branchId: string | null;
  invoiceNo: string;
  date: Date;
  type: ValasTransactionType;
  currencyId: string;
  amount: number;
  rate: number;
  priceRate: number | null;
  totalIdr: number;
  customerName: string;
  customerPhone?: string | null;
  customerIdType?: ValasCustomerIdType | null;
  customerIdNumber?: string | null;
  customerAddress?: string | null;
  paymentMethod: ValasPaymentMethod;
  bankAccountId?: string | null;
  note?: string | null;
  createdBy: string | null;
};

export const valasTransactionRepository = {
  findById(id: string) {
    return prisma.valasTransaction.findUnique({ where: { id }, select: listSelect });
  },

  findMany(filter: ValasTransactionFilter, limit = 200) {
    return prisma.valasTransaction.findMany({
      where: whereOf(filter),
      select: listSelect,
      // Terbaru di atas: kasir hampir selalu mencari transaksi yang baru saja
      // dibuat. `invoiceNo` sebagai pemecah seri karena dua transaksi bisa
      // tercatat pada milidetik yang sama.
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { invoiceNo: "desc" }],
      take: limit,
    });
  },

  /**
   * Membuat satu transaksi. `invoiceNo` datang dari service (lihat
   * `nextInvoiceSequence`) dan dilindungi unique index — service yang me-retry
   * saat dua kasir menekan Simpan bersamaan.
   */
  create(data: CreateValasTransactionInput) {
    return prisma.valasTransaction.create({
      data: {
        companyId: data.companyId,
        branchId: data.branchId,
        invoiceNo: data.invoiceNo,
        date: data.date,
        type: data.type,
        currencyId: data.currencyId,
        amount: new Prisma.Decimal(data.amount),
        rate: new Prisma.Decimal(data.rate),
        priceRate: data.priceRate == null ? null : new Prisma.Decimal(data.priceRate),
        totalIdr: new Prisma.Decimal(data.totalIdr),
        customerName: data.customerName,
        customerPhone: data.customerPhone ?? null,
        customerIdType: data.customerIdType ?? null,
        customerIdNumber: data.customerIdNumber ?? null,
        customerAddress: data.customerAddress ?? null,
        paymentMethod: data.paymentMethod,
        bankAccountId: data.bankAccountId ?? null,
        note: data.note ?? null,
        createdBy: data.createdBy,
      },
      select: listSelect,
    });
  },

  /**
   * Nomor urut terakhir yang terpakai untuk satu PT pada satu tanggal & jenis.
   * Dibaca dari `invoiceNo` terbesar, bukan dari COUNT — transaksi yang
   * dibatalkan tetap memegang nomornya, jadi menghitung baris akan mendaur
   * ulang nomor yang sudah tercetak di bukti nasabah.
   */
  async lastInvoiceNoWithPrefix(companyId: string, prefix: string): Promise<string | null> {
    const row = await prisma.valasTransaction.findFirst({
      where: { companyId, invoiceNo: { startsWith: prefix } },
      orderBy: { invoiceNo: "desc" },
      select: { invoiceNo: true },
    });
    return row?.invoiceNo ?? null;
  },

  /**
   * Membatalkan transaksi. Menandai, tidak menghapus — dan hanya kalau statusnya
   * masih COMPLETED, supaya pembatalan kedua tidak menimpa alasan & pelaku yang
   * pertama. `count: 0` berarti barisnya sudah dibatalkan orang lain.
   */
  async void(id: string, userId: string | null, reason: string) {
    const result = await prisma.valasTransaction.updateMany({
      where: { id, status: "COMPLETED" },
      data: { status: "VOID", voidedAt: new Date(), voidedBy: userId, voidReason: reason },
    });
    return result.count;
  },

  /** Rekap satu sisi (BUY atau SELL) untuk satu filter, dihitung di DB. */
  async summarize(filter: ValasTransactionFilter) {
    const rows = await prisma.valasTransaction.groupBy({
      by: ["type"],
      where: whereOf({ ...filter, includeVoid: false }),
      _sum: { totalIdr: true },
      _count: { _all: true },
    });

    const pick = (type: ValasTransactionType) => {
      const row = rows.find((r) => r.type === type);
      return { total: Number(row?._sum.totalIdr ?? 0), count: row?._count._all ?? 0 };
    };

    return { buy: pick("BUY"), sell: pick("SELL") };
  },

  /**
   * Rekap per mata uang: berapa unit masuk (BUY) dan keluar (SELL) beserta
   * nilai rupiahnya. Inilah angka yang dibandingkan dengan pergerakan stok
   * harian saat cross-check.
   */
  async summarizeByCurrency(filter: ValasTransactionFilter) {
    const rows = await prisma.valasTransaction.groupBy({
      by: ["currencyId", "type"],
      where: whereOf({ ...filter, includeVoid: false }),
      _sum: { amount: true, totalIdr: true },
      _count: { _all: true },
    });
    return rows.map((r) => ({
      currencyId: r.currencyId,
      type: r.type,
      amount: Number(r._sum.amount ?? 0),
      totalIdr: Number(r._sum.totalIdr ?? 0),
      count: r._count._all,
    }));
  },
};
