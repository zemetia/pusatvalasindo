import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import { assertHeldFundEditableDate } from "@/backend/helpers/held-fund-guard";
import { heldFundRepository } from "@/backend/repositories/held-fund.repository";
import { buildHeldFundPayload, toHeldFundRow } from "@/backend/services/held-fund.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  companyId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  // Wajib, tanpa default: arah hutang menentukan apakah uangnya akan masuk atau
  // keluar, dan menebaknya untuk pemanggil yang lupa mengirim akan mencatat
  // kewajiban ke sisi yang salah tanpa siapa pun sadar.
  kind: z.enum(["CREDIT", "DEBIT"]),
  name: z.string().min(1).max(120),
  // Jumlahnya opsional: alur normalnya "tambah nama dulu, angkanya diisi di
  // grid" (pop-up tambah hanya menanyakan nama), jadi 0 adalah nilai awal yang sah.
  amount: z.number().optional(),
  note: z.string().max(500).nullable().optional(),
});

type CreateBody = z.infer<typeof createSchema>;

// GET /api/dana-tertahan?companyId=&date=YYYY-MM-DD
// Baris hutang PT itu pada tanggal tersebut + posisi tertahan lintas tanggal.
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!companyId || !dateStr || !DATE_RE.test(dateStr)) {
      return NextResponse.json(
        { error: "companyId dan date (YYYY-MM-DD) wajib diisi" },
        { status: 400 }
      );
    }
    // PT yang diminta ikut diperiksa terhadap scope baca — bukan cuma "punya
    // izin dana tertahan".
    const authz = await authorize("finance.receivable", "view", { companyId });
    if (authz instanceof NextResponse) return authz;

    return NextResponse.json(ok(await buildHeldFundPayload(authz, companyId, new Date(dateStr))));
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/dana-tertahan — body { companyId, date, name, amount?, note? }
// Menambah satu pihak yang uangnya belum masuk pada tanggal itu.
export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await authorize("finance.receivable", "write", {
        companyId: ctx.body.companyId,
      });
      if (caller instanceof NextResponse) return caller;

      const date = new Date(ctx.body.date);
      assertHeldFundEditableDate(caller, ctx.body.companyId, date);

      const created = await heldFundRepository.create({
        companyId: ctx.body.companyId,
        date,
        kind: ctx.body.kind,
        name: ctx.body.name.trim(),
        amount: ctx.body.amount,
        note: ctx.body.note,
        createdBy: caller.userId,
      });

      return NextResponse.json(ok(toHeldFundRow(created), "Dana tertahan ditambahkan"));
    } catch (e) {
      return handleError(e);
    }
  }
);
