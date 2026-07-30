import {
  salaryComponentRepository,
  type CreateSalaryComponentInput,
  type UpdateSalaryComponentInput,
} from "@/backend/repositories/salary-component.repository";
import { ConflictError, NotFoundError, ValidationError } from "@/backend/errors/app-error";

/** Bentuk siap-JSON: Decimal Prisma tidak bisa diserialisasi ke client. */
export type SalaryComponentDto = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  name: string;
  kind: "ALLOWANCE" | "DEDUCTION";
  defaultAmount: number | null;
  note: string | null;
  isActive: boolean;
};

export type UserSalaryComponentDto = {
  componentId: string;
  name: string;
  kind: "ALLOWANCE" | "DEDUCTION";
  amount: number;
  /** Komponen induknya sudah dinonaktifkan — nilainya tidak lagi ikut dihitung. */
  isActive: boolean;
};

type ComponentRecord = Awaited<ReturnType<typeof salaryComponentRepository.findById>>;

function toDto(c: NonNullable<ComponentRecord>): SalaryComponentDto {
  return {
    id: c.id,
    companyId: c.companyId,
    companyName: c.company?.name ?? null,
    name: c.name,
    kind: c.kind,
    defaultAmount: c.defaultAmount === null ? null : Number(c.defaultAmount),
    note: c.note,
    isActive: c.isActive,
  };
}

/** Nama unik per PT — pesannya lebih berguna daripada error unique Prisma. */
async function assertNameFree(companyId: string | null, name: string, exceptId?: string) {
  const existing = await salaryComponentRepository.findByName(companyId, name);
  if (existing && existing.id !== exceptId) {
    throw new ConflictError(`Komponen bernama "${name}" sudah ada`);
  }
}

export const salaryComponentService = {
  list: async (companyIds: string[] | null): Promise<SalaryComponentDto[]> => {
    const rows = await salaryComponentRepository.findAll(companyIds);
    return rows.map(toDto);
  },

  getById: async (id: string) => {
    const c = await salaryComponentRepository.findById(id);
    if (!c) throw new NotFoundError("Komponen gaji tidak ditemukan");
    return c;
  },

  create: async (input: CreateSalaryComponentInput): Promise<SalaryComponentDto> => {
    const name = input.name.trim();
    if (!name) throw new ValidationError("Nama komponen wajib diisi");
    const companyId = input.companyId ?? null;
    await assertNameFree(companyId, name);
    return toDto(await salaryComponentRepository.create({ ...input, name, companyId }));
  },

  update: async (
    id: string,
    input: UpdateSalaryComponentInput
  ): Promise<SalaryComponentDto> => {
    const current = await salaryComponentService.getById(id);
    const name = input.name?.trim();
    if (name !== undefined && !name) throw new ValidationError("Nama komponen wajib diisi");
    if (name && name !== current.name) {
      await assertNameFree(input.companyId ?? current.companyId, name, id);
    }
    return toDto(await salaryComponentRepository.update(id, { ...input, ...(name ? { name } : {}) }));
  },

  /**
   * Menghapus komponen ikut menghapus nilainya di semua karyawan (cascade), dan
   * itu diam-diam mengubah gaji orang. Jadi komponen yang masih terpasang
   * ditolak — nonaktifkan saja kalau tidak dipakai lagi.
   */
  remove: async (id: string): Promise<void> => {
    await salaryComponentService.getById(id);
    const used = await salaryComponentRepository.countAssignments(id);
    if (used > 0) {
      throw new ConflictError(
        `Komponen masih dipakai ${used} karyawan. Nonaktifkan komponen ini alih-alih menghapusnya.`
      );
    }
    await salaryComponentRepository.remove(id);
  },

  listForUser: async (userId: string): Promise<UserSalaryComponentDto[]> => {
    const rows = await salaryComponentRepository.findForUser(userId);
    return rows.map((r) => ({
      componentId: r.componentId,
      name: r.component.name,
      kind: r.component.kind,
      amount: Number(r.amount),
      isActive: r.component.isActive,
    }));
  },

  /**
   * Ganti seluruh komponen milik karyawan. `allowedCompanyIds === null` berarti
   * seluruh PT; kalau tidak, komponen milik PT di luar scope pemanggil ditolak
   * supaya admin satu PT tidak bisa memasang komponen PT lain.
   */
  replaceForUser: async (
    userId: string,
    items: { componentId: string; amount: number }[],
    allowedCompanyIds: string[] | null
  ): Promise<UserSalaryComponentDto[]> => {
    const ids = items.map((i) => i.componentId);
    if (new Set(ids).size !== ids.length) {
      throw new ValidationError("Ada komponen yang terpasang lebih dari sekali");
    }

    const known = await salaryComponentRepository.findAll(allowedCompanyIds);
    const byId = new Map(known.map((c) => [c.id, c]));
    for (const item of items) {
      const c = byId.get(item.componentId);
      if (!c) throw new NotFoundError("Komponen gaji tidak ditemukan atau di luar akses Anda");
      if (item.amount < 0) throw new ValidationError(`Nilai ${c.name} tidak boleh negatif`);
    }

    await salaryComponentRepository.replaceForUser(userId, items);
    return salaryComponentService.listForUser(userId);
  },
};
