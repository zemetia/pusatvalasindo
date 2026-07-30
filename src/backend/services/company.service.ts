import prisma from "@/lib/prisma";
import { companyRepository } from "@/backend/repositories/company.repository";
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
} from "@/backend/repositories/company.repository";
import { ConflictError, NotFoundError } from "@/backend/errors/app-error";

/** Kode PT selalu disimpan huruf besar tanpa spasi — dipakai sebagai identitas pendek di UI. */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export const companyService = {
  getAll: () => companyRepository.findAll(),

  /** Daftar PT beserta jumlah cabang & pengguna di dalamnya — untuk halaman PT. */
  listWithCounts: async () => {
    const rows = await prisma.company.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { branches: true, custom_roles: true } },
        branches: { select: { _count: { select: { users: true } } } },
      },
    });

    // Pengguna tidak punya companyId sendiri — PT-nya diturunkan dari cabang
    // (lihat get-admin-caller), jadi jumlahnya dijumlahkan dari cabang-cabangnya.
    return rows.map(({ branches, _count, ...c }) => ({
      ...c,
      branchCount: _count.branches,
      roleCount: _count.custom_roles,
      userCount: branches.reduce((sum, b) => sum + b._count.users, 0),
    }));
  },

  getById: async (id: string) => {
    const company = await companyRepository.findById(id);
    if (!company) throw new NotFoundError("PT tidak ditemukan");
    return company;
  },

  create: async (data: CreateCompanyInput) => {
    const name = data.name.trim();
    const code = normalizeCode(data.code);

    if (await companyRepository.findByCode(code)) {
      throw new ConflictError(`Kode PT "${code}" sudah dipakai`);
    }
    if (await prisma.company.findUnique({ where: { name }, select: { id: true } })) {
      throw new ConflictError(`Nama PT "${name}" sudah dipakai`);
    }

    return companyRepository.create({ name, code });
  },

  update: async (id: string, data: UpdateCompanyInput) => {
    const company = await companyRepository.findById(id);
    if (!company) throw new NotFoundError("PT tidak ditemukan");

    const name = data.name?.trim();
    const code = data.code ? normalizeCode(data.code) : undefined;

    if (code && code !== company.code) {
      const clash = await companyRepository.findByCode(code);
      if (clash) throw new ConflictError(`Kode PT "${code}" sudah dipakai`);
    }
    if (name && name !== company.name) {
      const clash = await prisma.company.findUnique({ where: { name }, select: { id: true } });
      if (clash) throw new ConflictError(`Nama PT "${name}" sudah dipakai`);
    }

    return companyRepository.update(id, { ...data, name, code });
  },

  /**
   * Menghapus PT hanya kalau benar-benar kosong. PT adalah akar dari hampir
   * seluruh data (cabang, jabatan, rekening, stok, gaji); menghapusnya saat
   * masih dipakai akan menyisakan baris yatim atau ditolak foreign key di level
   * DB dengan pesan yang tidak bisa dibaca pemakai. Untuk PT yang sudah tidak
   * beroperasi, pakai tombol Nonaktifkan.
   */
  delete: async (id: string) => {
    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            branches: true,
            custom_roles: true,
            bankAccounts: true,
            companyStockItems: true,
            salaryComponents: true,
            roleKpis: true,
          },
        },
      },
    });
    if (!company) throw new NotFoundError("PT tidak ditemukan");

    const blockers: string[] = [];
    const c = company._count;
    if (c.branches) blockers.push(`${c.branches} cabang`);
    if (c.custom_roles) blockers.push(`${c.custom_roles} jabatan`);
    if (c.bankAccounts) blockers.push(`${c.bankAccounts} rekening bank`);
    if (c.companyStockItems) blockers.push(`${c.companyStockItems} item stok`);
    if (c.salaryComponents) blockers.push(`${c.salaryComponents} komponen gaji`);
    if (c.roleKpis) blockers.push(`${c.roleKpis} pemetaan KPI`);

    if (blockers.length > 0) {
      throw new ConflictError(
        `PT "${company.name}" masih dipakai oleh ${blockers.join(", ")}. ` +
          "Pindahkan atau hapus data tersebut dulu, atau nonaktifkan PT ini."
      );
    }

    await companyRepository.delete(id);
  },
};
