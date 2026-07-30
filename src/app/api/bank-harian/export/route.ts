import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const HEADER_FILL = "FF1F2937";
const HEADER_FONT = "FFFFFFFF";
const THIN_BORDER = { style: "thin" as const, color: { argb: "FFD1D5DB" } };

// GET /api/bank-harian/export?companyId=&date=YYYY-MM-DD
// Export saldo bank harian (1 sheet) untuk 1 PT pada tanggal terpilih.
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
    // PT yang diminta diuji terhadap scope baca — sama seperti GET /api/bank-harian,
    // supaya export tidak jadi pintu belakang untuk PT di luar wewenang.
    const authz = await authorize("bank.daily", "view", { companyId });
    if (authz instanceof NextResponse) return authz;

    const date = new Date(dateStr);
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });

    const [bankAccounts, bankEntries, bankPrevious] = await Promise.all([
      prisma.bankAccount.findMany({
        where: { companyId, isActive: true },
        include: { currency: true },
        orderBy: [{ bankName: "asc" }],
      }),
      prisma.dailyBankEntry.findMany({
        where: { bankAccount: { companyId }, date },
      }),
      prisma.dailyBankEntry.findMany({
        where: { bankAccount: { companyId }, date: { lt: date } },
        orderBy: [{ bankAccountId: "asc" }, { date: "desc" }],
        distinct: ["bankAccountId"],
      }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Pusat Kirim Duit";
    wb.created = new Date();

    const bankEntryMap = new Map(bankEntries.map((e) => [e.bankAccountId, e]));
    const bankPrevMap = new Map(bankPrevious.map((e) => [e.bankAccountId, e]));
    const bankSheet = wb.addWorksheet("Bank", { views: [{ state: "frozen", ySplit: 1 }] });
    bankSheet.columns = [
      { header: "Bank", key: "bank", width: 16 },
      { header: "No Rekening", key: "noRek", width: 20 },
      { header: "Nama Rekening", key: "namaRek", width: 22 },
      { header: "Mata Uang", key: "mataUang", width: 12 },
      { header: "Saldo Kemarin", key: "kemarin", width: 18 },
      { header: "Saldo Hari Ini", key: "hariIni", width: 18 },
      { header: "Catatan", key: "catatan", width: 30 },
    ];
    styleHeaderRow(bankSheet.getRow(1));

    for (const a of bankAccounts) {
      const entry = bankEntryMap.get(a.id);
      const prev = bankPrevMap.get(a.id);
      const saldoHariIni = entry ? Number(entry.balance) : Number(a.balance);
      const saldoKemarin = prev ? Number(prev.balance) : 0;
      const row = bankSheet.addRow({
        bank: a.bankName,
        noRek: a.accountNumber ?? "",
        namaRek: a.accountName,
        mataUang: a.currency.code,
        kemarin: saldoKemarin,
        hariIni: saldoHariIni,
        catatan: entry?.note ?? "",
      });
      styleDataRow(row, ["kemarin", "hariIni"]);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const companyName = (company?.name ?? "pt").replace(/[^a-zA-Z0-9]+/g, "-");
    const filename = `export-bank-${companyName}-${dateStr}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  });
  row.height = 22;
}

function styleDataRow(row: ExcelJS.Row, numericKeys: string[]) {
  row.eachCell((cell, colNumber) => {
    cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
    const key = row.worksheet.getColumn(colNumber).key as string | undefined;
    if (key && numericKeys.includes(key)) {
      cell.numFmt = "#,##0";
      cell.alignment = { vertical: "middle", horizontal: "right" };
    }
  });
}
