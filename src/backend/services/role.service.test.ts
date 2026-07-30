import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError } from "../errors/app-error";

vi.mock("../repositories/role.repository", () => ({
  roleRepository: {
    findAll: vi.fn(),
    findByCompanyId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { roleService } from "./role.service";
import { roleRepository } from "../repositories/role.repository";

const PT_A = "pt-a";
const PT_B = "pt-b";

/** Pengatur yang didelegasikan: hanya boleh menyentuh jabatan PT A. */
const DELEGATED = [PT_A];
/** Super Admin/Owner: tanpa batas. */
const GLOBAL = null;

const roleRow = (over: Partial<{ name: string; companyId: string | null }> = {}) =>
  ({
    id: "role-1",
    name: "Kasir",
    description: null,
    companyId: PT_A,
    permissions: [],
    payrollCompanyIds: [],
    usesResourcePerms: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("roleService.create() — batas eskalasi", () => {
  it("menolak nama jabatan yang otomatis global bagi pengatur non-global", async () => {
    // "Owner" lolos lewat isGlobalRole, mendahului matriks izin — inilah
    // eskalasi penuh yang harus ditutup.
    for (const name of ["Owner", "owner", "SUPER_ADMIN", "super admin"]) {
      await expect(
        roleService.create({ name, companyId: PT_A, permissions: [] } as never, DELEGATED)
      ).rejects.toThrow(ForbiddenError);
    }
    expect(roleRepository.create).not.toHaveBeenCalled();
  });

  it("mengizinkan nama itu untuk Super Admin/Owner", async () => {
    await roleService.create({ name: "Owner", companyId: null, permissions: [] } as never, GLOBAL);
    expect(roleRepository.create).toHaveBeenCalledOnce();
  });

  it("menolak jabatan di PT luar wewenang, dan jabatan lintas PT", async () => {
    await expect(
      roleService.create({ name: "Kasir", companyId: PT_B, permissions: [] } as never, DELEGATED)
    ).rejects.toThrow(ForbiddenError);
    await expect(
      roleService.create({ name: "Kasir", companyId: null, permissions: [] } as never, DELEGATED)
    ).rejects.toThrow(ForbiddenError);
  });

  it("mengizinkan jabatan biasa di PT sendiri", async () => {
    await roleService.create({ name: "Kasir", companyId: PT_A, permissions: [] } as never, DELEGATED);
    expect(roleRepository.create).toHaveBeenCalledOnce();
  });
});

describe("roleService.update() — jabatan yang sedang diubah ikut diuji", () => {
  it("menolak mengubah jabatan global meski isian barunya wajar", async () => {
    vi.mocked(roleRepository.findById).mockResolvedValue(
      roleRow({ name: "Owner", companyId: null })
    );
    await expect(
      roleService.update("role-1", { description: "apa saja" }, DELEGATED)
    ).rejects.toThrow(ForbiddenError);
    expect(roleRepository.update).not.toHaveBeenCalled();
  });

  it("menolak mengubah jabatan milik PT lain", async () => {
    vi.mocked(roleRepository.findById).mockResolvedValue(roleRow({ companyId: PT_B }));
    await expect(roleService.update("role-1", { name: "Kasir 2" }, DELEGATED)).rejects.toThrow(
      ForbiddenError
    );
  });

  it("menolak mengganti nama jabatan biasa menjadi nama global", async () => {
    vi.mocked(roleRepository.findById).mockResolvedValue(roleRow());
    await expect(roleService.update("role-1", { name: "Owner" }, DELEGATED)).rejects.toThrow(
      ForbiddenError
    );
  });

  it("menolak memindahkan jabatan ke PT luar wewenang", async () => {
    vi.mocked(roleRepository.findById).mockResolvedValue(roleRow());
    await expect(roleService.update("role-1", { companyId: PT_B }, DELEGATED)).rejects.toThrow(
      ForbiddenError
    );
  });

  it("mengizinkan perubahan biasa di PT sendiri", async () => {
    vi.mocked(roleRepository.findById).mockResolvedValue(roleRow());
    await roleService.update("role-1", { name: "Kasir Senior" }, DELEGATED);
    expect(roleRepository.update).toHaveBeenCalledOnce();
  });
});

describe("roleService.delete()", () => {
  it("menolak menghapus jabatan global atau jabatan PT lain", async () => {
    vi.mocked(roleRepository.findById).mockResolvedValue(
      roleRow({ name: "Owner", companyId: null })
    );
    await expect(roleService.delete("role-1", DELEGATED)).rejects.toThrow(ForbiddenError);

    vi.mocked(roleRepository.findById).mockResolvedValue(roleRow({ companyId: PT_B }));
    await expect(roleService.delete("role-1", DELEGATED)).rejects.toThrow(ForbiddenError);
    expect(roleRepository.delete).not.toHaveBeenCalled();
  });

  it("mengizinkan Super Admin/Owner menghapus jabatan mana pun", async () => {
    vi.mocked(roleRepository.findById).mockResolvedValue(
      roleRow({ name: "Owner", companyId: null })
    );
    await roleService.delete("role-1", GLOBAL);
    expect(roleRepository.delete).toHaveBeenCalledOnce();
  });
});
