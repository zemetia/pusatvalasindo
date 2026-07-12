import prisma from "@/lib/prisma";

// sortOrder tinggi supaya pocket "Total" selalu urutan paling akhir lewat orderBy yang sudah ada,
// tanpa perlu logic sorting terpisah di pemanggilnya.
const TOTAL_POCKET_SORT_ORDER = 999999;

export const stockistPocketRepository = {
  findAllByCompany: (companyId: string, onlyActive = false) =>
    prisma.stockistPocket.findMany({
      where: { companyId, deletedAt: null, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

  findById: (id: string) => prisma.stockistPocket.findUnique({ where: { id } }),

  create: (data: { companyId: string; name: string; code?: string | null; sortOrder?: number }) =>
    prisma.stockistPocket.create({ data }),

  update: (
    id: string,
    data: { name?: string; code?: string | null; sortOrder?: number; isActive?: boolean }
  ) => prisma.stockistPocket.update({ where: { id }, data }),

  // Soft delete — baris tetap ada supaya histori mutasi/opname lama tidak yatim, hanya disembunyikan
  // dari daftar aktif (deletedAt filter di findAllByCompany) dan dinonaktifkan sekaligus.
  softDelete: (id: string) =>
    prisma.stockistPocket.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    }),

  // Pocket "Total" adalah pocket sungguhan (row asli), tapi isinya tidak pernah ditulis manual —
  // saldonya selalu dihitung ulang dari pocket lain tiap request (lihat stockist.service.ts).
  // Get-or-create supaya otomatis ada begitu grid stockist sebuah PT pertama kali dibuka.
  ensureTotalPocket: async (companyId: string) => {
    const existing = await prisma.stockistPocket.findFirst({ where: { companyId, isDefault: true } });
    if (existing) return existing;
    try {
      return await prisma.stockistPocket.create({
        data: { companyId, name: "Total", isDefault: true, sortOrder: TOTAL_POCKET_SORT_ORDER },
      });
    } catch {
      // Race: request lain barusan membuatnya duluan — ambil yang sudah ada.
      const created = await prisma.stockistPocket.findFirst({ where: { companyId, isDefault: true } });
      if (created) return created;
      throw new Error("Gagal membuat pocket Total");
    }
  },
};
