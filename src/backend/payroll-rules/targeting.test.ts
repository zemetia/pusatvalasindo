import { describe, expect, it } from "vitest";

import { ruleTargetsEmployee } from "./engine";
import { targetingIsUsable } from "./validate";
import type { EmployeeContext, PayrollRule, RuleTarget } from "./types";

/**
 * Rule bermasalah tetap harus tahu siapa sasarannya.
 *
 * Sebelumnya engine mendorong entri "rule bermasalah" untuk SETIAP rule yang
 * gagal validasi ke SETIAP karyawan, tanpa melihat `for`/`except`. Akibatnya
 * seorang teller menerima baris keterangan tentang rule kurir dan rule kepala
 * cabang — rule yang memang tidak pernah dimaksudkan untuk dirinya.
 */

function ruleOf(sasaran: RuleTarget[], except?: RuleTarget[]): PayrollRule {
  return {
    id: "contoh",
    versi: 1,
    berlaku_dari: "2026-01-01",
    berlaku_sampai: null,
    mode: "agregat",
    query: { sql: "SELECT 1", expect: "one_row" },
    tier_field: "x",
    tiers: [{ min: 0, nominal: 0, label: "x" }],
    default: { nominal: 0 },
    for: sasaran,
    except,
  };
}

function empOf(roleName: string): EmployeeContext {
  return {
    id: "emp1",
    name: "Karyawan",
    companyCode: "PVI",
    branchName: "Tangerang",
    roleName,
    gaji_pokok: 5_000_000,
    tgl_masuk: null,
    companyId: "c1",
    branchId: "b1",
    customRoleId: "r1",
  };
}

describe("penyaringan sasaran untuk rule bermasalah", () => {
  it("rule kurir tidak menyasar teller", () => {
    const rule = ruleOf([{ company: ["PVI"], roles: ["Kurir"] }]);
    expect(ruleTargetsEmployee(rule, empOf("Teller Dalam"))).toBe(false);
    expect(ruleTargetsEmployee(rule, empOf("Kurir"))).toBe(true);
  });

  it("sasaran yang sah bisa dipercaya untuk menyaring", () => {
    expect(targetingIsUsable(ruleOf([{ company: ["PVI"], roles: ["Kurir"] }]))).toBe(true);
    expect(targetingIsUsable(ruleOf([{ company: "*", branch: "*", roles: "*" }]))).toBe(true);
  });

  /**
   * Justru bagian sasarannya yang rusak → jangan dipakai menyaring. Kalau
   * dipakai, `for: []` mencocokkan nol orang dan rule lenyap dari semua slip:
   * kegagalan senyap yang persis ingin dicegah oleh entri ERROR.
   */
  it("sasaran yang rusak TIDAK boleh dipakai menyaring", () => {
    expect(targetingIsUsable(ruleOf([]))).toBe(false);
    expect(targetingIsUsable(ruleOf([{ roles: [] }]))).toBe(false);
    expect(targetingIsUsable(ruleOf([{ roles: [123 as unknown as string] }]))).toBe(false);
    expect(targetingIsUsable(ruleOf([{ roles: ["Kurir"] }], [null as unknown as RuleTarget]))).toBe(
      false
    );
  });

  it("`except` selalu menang atas `for`", () => {
    const rule = ruleOf([{ company: "*" }], [{ roles: ["Kepala Cabang"] }]);
    expect(ruleTargetsEmployee(rule, empOf("Kepala Cabang"))).toBe(false);
    expect(ruleTargetsEmployee(rule, empOf("Teller Dalam"))).toBe(true);
  });
});
