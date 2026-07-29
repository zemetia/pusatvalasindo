import { describe, it, expect } from "vitest";
import {
  MAX_PERIOD_DAYS,
  daysBetween,
  enumerateDates,
  monthGrid,
  resolvePeriod,
} from "./finance-period";

const TODAY = "2026-07-28"; // Selasa

describe("resolvePeriod()", () => {
  it("menerjemahkan tiap preset ke rentang yang benar", () => {
    const cases = [
      ["hari-ini", "2026-07-28", "2026-07-28"],
      ["kemarin", "2026-07-27", "2026-07-27"],
      ["7-hari", "2026-07-22", "2026-07-28"],
      ["30-hari", "2026-06-29", "2026-07-28"],
      ["bulan-ini", "2026-07-01", "2026-07-28"],
      ["bulan-lalu", "2026-06-01", "2026-06-30"],
      ["kuartal-ini", "2026-07-01", "2026-07-28"],
      ["tahun-ini", "2026-01-01", "2026-07-28"],
    ] as const;

    for (const [preset, from, to] of cases) {
      const range = resolvePeriod({ preset, today: TODAY });
      expect([preset, range.from, range.to]).toEqual([preset, from, to]);
    }
  });

  it("membuat periode pembanding sepanjang periode terpilih, tepat sebelumnya", () => {
    const range = resolvePeriod({ preset: "7-hari", today: TODAY });
    expect(range.prevTo).toBe("2026-07-21");
    expect(range.prevFrom).toBe("2026-07-15");
    expect(daysBetween(range.prevFrom, range.prevTo)).toBe(range.days);
  });

  it("tidak mempercayai parameter URL", () => {
    // Preset asing → 30 hari.
    expect(resolvePeriod({ preset: "drop-table", today: TODAY }).from).toBe("2026-06-29");
    // Tanggal ngawur → jatuh ke rentang preset.
    expect(
      resolvePeriod({ preset: "custom", from: "2026-02-31", to: "bukan-tanggal", today: TODAY })
        .from,
    ).toBe("2026-06-29");
    // Terbalik → ditukar.
    const swapped = resolvePeriod({
      preset: "custom",
      from: "2026-07-20",
      to: "2026-07-10",
      today: TODAY,
    });
    expect([swapped.from, swapped.to]).toEqual(["2026-07-10", "2026-07-20"]);
  });

  it("memotong rentang custom yang terlalu panjang dari ujung awal", () => {
    const range = resolvePeriod({
      preset: "custom",
      from: "2000-01-01",
      to: "2026-07-28",
      today: TODAY,
    });

    expect(range.days).toBe(MAX_PERIOD_DAYS);
    expect(range.to).toBe("2026-07-28"); // ujung akhir dipertahankan
    expect(enumerateDates(range.prevFrom, range.to)).toHaveLength(MAX_PERIOD_DAYS * 2);
  });
});

describe("monthGrid()", () => {
  it("menyusun bulan dalam pekan Senin–Minggu", () => {
    const weeks = monthGrid("2026-07"); // 1 Juli 2026 = Rabu
    expect(weeks[0]).toEqual([
      null,
      null,
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});
