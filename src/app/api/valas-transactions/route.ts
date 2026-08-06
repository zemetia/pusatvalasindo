import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { withValidation } from "@/backend/middleware/with-validation";
import {
  assertTransactionDate,
  buildValasTransactionPayload,
  valasTransactionService,
} from "@/backend/services/valas-transaction.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const typeEnum = z.enum(["BUY", "SELL"]);
const idTypeEnum = z.enum(["KTP", "SIM", "PASSPORT", "KITAS", "NPWP", "LAINNYA"]);

const createSchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().min(1).nullish(),
  date: z.string().regex(DATE_RE),
  type: typeEnum,
  currencyId: z.string().min(1),
  amount: z.number().positive(),
  // Kurs opsional: kosong berarti "pakai Harga Valas yang berlaku". Total
  // sengaja TIDAK diterima dari klien — selalu dihitung ulang di service.
  rate: z.number().positive().nullish(),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().max(30).nullish(),
  customerIdType: idTypeEnum.nullish(),
  customerIdNumber: z.string().max(50).nullish(),
  customerAddress: z.string().max(300).nullish(),
  paymentMethod: z.enum(["CASH", "TRANSFER"]).optional(),
  bankAccountId: z.string().min(1).nullish(),
  note: z.string().max(500).nullish(),
});

type CreateBody = z.infer<typeof createSchema>;

/**
 * GET /api/valas-transactions?companyId=&date=YYYY-MM-DD[&type=&currencyId=&q=]
 *
 * Transaksi PT itu pada tanggal tersebut, beserta rekapnya dan daftar harga
 * yang berlaku. Bentuk payload-nya sama persis dengan yang dirender server di
 * halaman — satu fungsi, satu bentuk data.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const companyId = sp.get("companyId");
    const dateStr = sp.get("date");
    if (!companyId || !dateStr || !DATE_RE.test(dateStr)) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "companyId dan date (YYYY-MM-DD) wajib diisi"),
        { status: 400 }
      );
    }

    // PT yang diminta ikut diperiksa terhadap scope baca — bukan cuma "punya
    // izin transaksi valas".
    const authz = await authorize("valas.transaction", "view", { companyId });
    if (authz instanceof NextResponse) return authz;

    const typeParam = sp.get("type");
    const parsedType = typeEnum.safeParse(typeParam);

    const payload = await buildValasTransactionPayload(
      authz,
      companyId,
      new Date(dateStr),
      {
        type: parsedType.success ? parsedType.data : undefined,
        currencyId: sp.get("currencyId") ?? undefined,
        q: sp.get("q") ?? undefined,
      }
    );

    return NextResponse.json(ok(payload));
  } catch (e) {
    return handleError(e);
  }
}

/**
 * POST /api/valas-transactions — mencatat satu transaksi jual/beli.
 *
 * Kurs default diambil dari Harga Valas (BUY → harga beli, SELL → harga jual)
 * dan di-snapshot ke barisnya. Total dihitung server, jadi ambang wajib
 * identitas tidak bisa dilewati dengan mengirim angka kecil.
 */
export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const authz = await authorize("valas.transaction", "write", {
        companyId: ctx.body.companyId,
      });
      if (authz instanceof NextResponse) return authz;

      const date = new Date(ctx.body.date);
      assertTransactionDate(authz, ctx.body.companyId, date);

      const row = await valasTransactionService.create({
        ...ctx.body,
        date,
        // Cabang default-nya cabang si pemanggil. Yang dikirim klien dipakai
        // hanya kalau ada — halaman tidak menawarkannya, tapi MCP/integrasi bisa.
        branchId: ctx.body.branchId ?? authz.branchId,
        createdBy: authz.userId,
      });

      return NextResponse.json(ok(row, `Transaksi ${row.invoiceNo} tercatat`));
    } catch (e) {
      return handleError(e);
    }
  }
);
