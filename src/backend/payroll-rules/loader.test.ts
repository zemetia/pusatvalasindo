import { describe, expect, it } from "vitest";

import { activeRulesOn } from "./loader";
import type { LoadedRule, PayrollRule, RuleSet } from "./types";

/**
 * Rule bermasalah tidak boleh hilang diam-diam.
 *
 * Sebelumnya `activeRulesOn` menyaring rule yang punya error, sehingga rule
 * yang tanda tangannya tidak cocok — keadaan yang justru paling perlu terlihat
 * — membuat bonus karyawan lenyap tanpa jejak di slip. Sekarang ia ikut
 * dikembalikan, dan engine yang mengubahnya menjadi entri berstatus ERROR.
 */

function ruleOf(id: string, dari: string, sampai: string | null): PayrollRule {
  return {
    id,
    versi: 1,
    berlaku_dari: dari,
    berlaku_sampai: sampai,
    mode: "agregat",
    query: { sql: "SELECT 1", expect: "one_row" },
    tier_field: "x",
    tiers: [{ min: 0, nominal: 0, label: "x" }],
    default: { nominal: 0 },
    for: [{ company: "*", branch: "*", roles: "*" }],
  };
}

function loadedOf(id: string, errors: string[], dari = "2026-01-01", sampai: string | null = null): LoadedRule {
  return {
    rule: ruleOf(id, dari, sampai),
    file: `${id}@v1`,
    hash: "sig",
    rowId: id,
    errors,
    warnings: [],
  };
}

function setOf(rules: LoadedRule[]): RuleSet {
  return { rules, broken: [], hash: "h", versions: rules.map((r) => r.file) };
}

describe("activeRulesOn", () => {
  const akhirPeriode = new Date("2026-08-31T00:00:00Z");

  it("mengembalikan rule bermasalah, bukan membuangnya", () => {
    const set = setOf([
      loadedOf("sehat", []),
      loadedOf("tanda_tangan_rusak", ["Tanda tangan tidak cocok"]),
    ]);

    const hasil = activeRulesOn(set, akhirPeriode);

    expect(hasil.map((r) => r.rule.id)).toEqual(["sehat", "tanda_tangan_rusak"]);
    expect(hasil.find((r) => r.rule.id === "tanda_tangan_rusak")?.errors).toHaveLength(1);
  });

  it("tetap menyaring berdasarkan masa berlaku", () => {
    const set = setOf([
      loadedOf("belum_berlaku", [], "2026-09-01"),
      loadedOf("sudah_lewat", [], "2026-01-01", "2026-07-31"),
      loadedOf("berlaku", [], "2026-08-01", "2026-08-31"),
    ]);

    expect(activeRulesOn(set, akhirPeriode).map((r) => r.rule.id)).toEqual(["berlaku"]);
  });

  it("rule bermasalah yang sudah lewat masa berlakunya tetap tidak ikut", () => {
    const set = setOf([loadedOf("lama_dan_rusak", ["rusak"], "2026-01-01", "2026-07-31")]);

    expect(activeRulesOn(set, akhirPeriode)).toHaveLength(0);
  });
});
