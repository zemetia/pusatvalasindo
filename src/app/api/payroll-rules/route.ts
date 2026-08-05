import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok } from "@/backend/helpers/api-response";
import { authorize } from "@/backend/helpers/authz";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { listRulesForUi, saveRuleVersion } from "@/backend/services/payroll-rule.service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus YYYY-MM-DD");

/** `"*"` atau daftar nilai. Field yang dihilangkan diperlakukan sebagai `"*"`. */
const targetSchema = z.object({
  company: z.union([z.literal("*"), z.array(z.string().min(1))]).optional(),
  branch: z.union([z.literal("*"), z.array(z.string().min(1))]).optional(),
  roles: z.union([z.literal("*"), z.array(z.string().min(1))]).optional(),
});

const tierSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  /** BERTANDA: positif menambah gaji, negatif menguranginya. */
  nominal: z.number().nullable(),
  perUnit: z.number().nullable(),
  unitField: z.string().max(60).nullable(),
  formula: z.string().max(500).nullable(),
  label: z.string().min(1, "Label tier wajib diisi").max(200),
  // Sanksi non-uang IKUT dikirim. Sebelumnya keduanya tidak ada di skema ini,
  // sehingga menyunting rule apa pun lewat halaman Rule diam-diam menghapus
  // "wajib masuk Sabtu" dan "disertai SP" dari tier yang membawanya.
  mandatorySaturday: z.boolean().optional(),
  warningLetter: z.boolean().optional(),
});

const ruleSchema = z.object({
  ruleKey: z.string().min(1).max(60),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable(),
  mode: z.enum(["AGREGAT", "PER_BARIS"]),
  sql: z.string().min(1).max(8000),
  tierField: z.string().min(1).max(60),
  constants: z.record(z.string(), z.number()).nullable(),
  guards: z
    .array(
      z.object({
        if: z.string().min(1).max(300),
        aksi: z.enum(["skip", "terapkan"]),
        flag: z.string().min(1).max(60),
        // Hanya bermakna pada `terapkan`. Bentuknya ditegakkan validator rule,
        // bukan di sini — pesan errornya perlu sama persis dengan yang muncul
        // saat rule dimuat, supaya HR tidak menghadapi dua bahasa berbeda.
        nominal: z.number().optional(),
        formula: z.string().max(500).optional(),
        label: z.string().max(200).optional(),
        mandatory_saturday: z.boolean().optional(),
        warning_letter: z.boolean().optional(),
      })
    )
    .nullable(),
  defaults: z.object({
    nominal: z.number().optional(),
    formula: z.string().max(500).optional(),
    label: z.string().max(200).optional(),
    flag: z.string().max(60).optional(),
  }),
  targets: z.array(targetSchema).min(1, "Rule harus punya minimal satu sasaran"),
  excepts: z.array(targetSchema).nullable(),
  note: z.string().max(2000).nullable(),
  changeNote: z.string().max(500).nullable(),
  tiers: z.array(tierSchema).min(1, "Rule harus punya minimal satu tier"),
});

type RuleBody = z.infer<typeof ruleSchema>;

export async function GET() {
  try {
    const authz = await authorize("payroll.rules", "view");
    if (authz instanceof NextResponse) return authz;

    return NextResponse.json(ok(await listRulesForUi()));
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Menyimpan rule = membuat VERSI BARU, bukan menimpa. Karena itu satu-satunya
 * metode tulis di sini POST — tidak ada PUT/DELETE, dan itu disengaja: rule
 * yang pernah dipakai menghitung gaji tidak boleh bisa dihapus.
 */
export const POST = withValidation(ruleSchema)(
  async (_req: NextRequest, ctx: { body: RuleBody }) => {
    try {
      const authz = await authorize("payroll.rules", "write");
      if (authz instanceof NextResponse) return authz;

      // Capability terpisah. Kalau tidak dipegang, service mempertahankan SQL
      // versi sebelumnya apa pun yang dikirim klien — pemeriksaannya tidak
      // berhenti di UI.
      const canEditSql = authz.can("payroll.rules.sql", "write");

      const rule = await saveRuleVersion(ctx.body, {
        userId: authz.userId,
        canEditSql,
      });

      return NextResponse.json(
        ok(rule, `Rule ${rule.ruleKey} disimpan sebagai versi ${rule.version}`),
        { status: 201 }
      );
    } catch (e) {
      return handleError(e);
    }
  }
);
