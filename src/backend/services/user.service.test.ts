import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError } from "../errors/app-error";

vi.mock("../repositories/user.repository", () => ({
  userRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { userService } from "./user.service";
import { userRepository } from "../repositories/user.repository";

const mockUser = {
  id: "user-1",
  name: "John Doe",
  email: "john@example.com",
  emailVerified: false,
  image: null,
  phone: null,
  branchId: null,
  customRoleId: null,
  baseSalary: null,
  joinDate: null,
  isActive: true,
  employmentStatus: "BELUM_KONTRAK",
  contractStartDate: null,
  contractEndDate: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  branch: null,
  customRole: null,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("userService.getAll()", () => {
  it("returns all users from repository", async () => {
    vi.mocked(userRepository.findAll).mockResolvedValue([mockUser]);
    const result = await userService.getAll();
    expect(result).toEqual([mockUser]);
    expect(userRepository.findAll).toHaveBeenCalledOnce();
  });
});

describe("userService.getById()", () => {
  it("returns user when found", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    const result = await userService.getById("user-1");
    expect(result).toEqual(mockUser);
  });

  it("throws NotFoundError when user does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    await expect(userService.getById("missing")).rejects.toThrow(NotFoundError);
    await expect(userService.getById("missing")).rejects.toThrow("User not found");
  });
});

describe("userService.update()", () => {
  it("updates and returns user", async () => {
    const updated = { ...mockUser, name: "Jane Doe" };
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(userRepository.update).mockResolvedValue(updated);
    const result = await userService.update("user-1", { name: "Jane Doe" });
    expect(result.name).toBe("Jane Doe");
  });

  it("throws NotFoundError when user does not exist before update", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    await expect(
      userService.update("missing", { name: "Jane" })
    ).rejects.toThrow(NotFoundError);
  });
});

describe("userService.delete()", () => {
  it("deletes user when found", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(userRepository.delete).mockResolvedValue(mockUser as any);
    await expect(userService.delete("user-1")).resolves.toBeUndefined();
  });

  it("throws NotFoundError when user does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    await expect(userService.delete("missing")).rejects.toThrow(NotFoundError);
  });
});
