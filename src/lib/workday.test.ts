import { describe, it, expect } from "vitest";
import { deriveAlphaDays, isWorkday } from "./workday";

// Agustus 2026: tanggal 1 jatuh hari Sabtu, jadi Minggu-nya adalah 2, 9, 16,
// 23, dan 30 — dipakai sebagai kasus uji "bukan hari kerja".
const NONE: ReadonlySet<string> = new Set();

describe("isWorkday", () => {
  it("Senin s/d Sabtu adalah hari kerja", () => {
    expect(isWorkday("2026-08-01", NONE)).toBe(true); // Sabtu
    expect(isWorkday("2026-08-03", NONE)).toBe(true); // Senin
  });

  it("Minggu bukan hari kerja", () => {
    expect(isWorkday("2026-08-02", NONE)).toBe(false);
    expect(isWorkday("2026-08-30", NONE)).toBe(false);
  });

  it("tanggal merah bukan hari kerja meski jatuh di hari kerja", () => {
    expect(isWorkday("2026-08-17", new Set(["2026-08-17"]))).toBe(false);
  });
});

describe("deriveAlphaDays", () => {
  const base = {
    year: 2026,
    month: 8,
    recordedDates: NONE,
    holidays: NONE,
    todayIso: "2026-08-10",
    joinIso: null,
  };

  it("hari kerja yang lewat tanpa baris presensi = alpha", () => {
    // 1 s/d 9 Agustus, minus Minggu (2 dan 9).
    expect(deriveAlphaDays(base)).toEqual([
      "2026-08-01",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
    ]);
  });

  it("hari yang punya baris presensi tidak pernah alpha — status barisnya yang bicara", () => {
    const alpha = deriveAlphaDays({
      ...base,
      recordedDates: new Set(["2026-08-03", "2026-08-04"]),
    });
    expect(alpha).not.toContain("2026-08-03");
    expect(alpha).not.toContain("2026-08-04");
  });

  it("tanggal merah dikecualikan", () => {
    expect(deriveAlphaDays({ ...base, holidays: new Set(["2026-08-06"]) })).not.toContain(
      "2026-08-06"
    );
  });

  it("hari ini dan sesudahnya tidak dinilai — harinya belum selesai", () => {
    const alpha = deriveAlphaDays(base);
    expect(alpha).not.toContain("2026-08-10");
    expect(alpha).not.toContain("2026-08-11");
  });

  it("hari sebelum karyawan bergabung tidak dinilai", () => {
    expect(deriveAlphaDays({ ...base, joinIso: "2026-08-05" })).toEqual([
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
    ]);
  });

  it("bulan yang seluruhnya belum lewat tidak menghasilkan alpha sama sekali", () => {
    expect(deriveAlphaDays({ ...base, todayIso: "2026-07-20" })).toEqual([]);
  });
});
