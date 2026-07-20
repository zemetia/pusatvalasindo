import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess } from "@/backend/services/stockist.service";
import { stockistHeadConfirmationService } from "@/backend/services/stockist-head-confirmation.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const HEADER_FILL = "FF1F2937";
const HEADER_FONT = "FFFFFFFF";
const THIN_BORDER = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
const MATCH_FILL = "FFD7F2E3";
const MATCH_FONT = "FF1B7A43";
const MISMATCH_FILL = "FFFAD4D4";
const MISMATCH_FONT = "FFB42318";

// GET /api/stockist/head-confirmation/export?companyId=&date=YYYY-MM-DD
// Export lengkap hasil cross-check kepala cabang: Ringkasan, Stock Harian, Kas, Bank — 1 file, 4 sheet.
export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCKIST_VERIFY);
    if (caller instanceof NextResponse) return caller;

    const companyId = req.nextUrl.searchParams.get("companyId");
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!companyId || !dateStr || !DATE_RE.test(dateStr)) {
      return NextResponse.json(
        { error: "companyId dan date (YYYY-MM-DD) wajib diisi" },
        { status: 400 }
      );
    }
    assertCompanyAccess(caller, companyId);

    const date = new Date(dateStr);
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });

    const [stockRows, kas, companyTotal, bankAccounts, bankEntries] = await Promise.all([
      stockistHeadConfirmationService.getStockConfirmationGrid(companyId, date),
      stockistHeadConfirmationService.getKasConfirmation(companyId, date),
      stockistHeadConfirmationService.getCompanyTotal(companyId, date),
      prisma.bankAccount.findMany({
        where: { companyId, isActive: true },
        include: { currency: true },
        orderBy: [{ bankName: "asc" }],
      }),
      prisma.dailyBankEntry.findMany({ where: { bankAccount: { companyId }, date } }),
    ]);

    const bankEntryMap = new Map(bankEntries.map((e) => [e.bankAccountId, e]));
    const bankByCurrency = new Map<string, number>();
    for (const a of bankAccounts) {
      const entry = bankEntryMap.get(a.id);
      const saldo = entry ? Number(entry.balance) : Number(a.balance);
      bankByCurrency.set(a.currency.code, (bankByCurrency.get(a.currency.code) ?? 0) + saldo);
    }

    const stockTotalIdr = stockRows.reduce((sum, r) => sum + (r.confirmedIdrValue ?? 0), 0);
    const kasTotalIdr = kas.confirmedIdrValue ?? 0;
    const grandTotal = companyTotal ? Number(companyTotal.totalIdr) : stockTotalIdr + kasTotalIdr;

    const wb = new ExcelJS.Workbook();
    wb.creator = "Pusat Kirim Duit";
    wb.created = new Date();

    // --- Sheet 1: Ringkasan ---
    const ringkasan = wb.addWorksheet("Ringkasan");
    ringkasan.columns = [
      { header: "Keterangan", key: "label", width: 34 },
      { header: "Nilai", key: "value", width: 24 },
    ];
    styleHeaderRow(ringkasan.getRow(1));
    ringkasan.addRow({ label: `PT`, value: company?.name ?? "-" });
    ringkasan.addRow({ label: "Tanggal", value: dateStr });
    ringkasan.addRow({});
    let r = ringkasan.addRow({ label: "Total Stock (Kepala Cabang, IDR)", value: stockTotalIdr });
    styleDataRow(r, ["value"]);
    r = ringkasan.addRow({ label: "Total Kas (Kepala Cabang, IDR)", value: kasTotalIdr });
    styleDataRow(r, ["value"]);
    for (const [code, total] of bankByCurrency) {
      r = ringkasan.addRow({ label: `Total Bank (${code})`, value: total });
      styleDataRow(r, ["value"]);
    }
    ringkasan.addRow({});
    r = ringkasan.addRow({ label: "Total Keseluruhan (Stock + Kas, IDR)", value: grandTotal });
    r.getCell("label").font = { bold: true };
    r.getCell("value").font = { bold: true };
    styleDataRow(r, ["value"]);

    // --- Sheet 2: Stock Harian ---
    const stockSheet = wb.addWorksheet("Stock Harian", { views: [{ state: "frozen", ySplit: 1 }] });
    stockSheet.columns = [
      { header: "Item", key: "item", width: 24 },
      { header: "Total Sistem", key: "sistem", width: 16 },
      { header: "Total Kepala Cabang", key: "kepcab", width: 20 },
      { header: "Total IDR", key: "idr", width: 20 },
      { header: "Selisih", key: "selisih", width: 16 },
      { header: "Jam Konfirmasi", key: "jam", width: 16 },
    ];
    styleHeaderRow(stockSheet.getRow(1));
    for (const row of stockRows) {
      const label = row.item.type === "LOGAM_MULIA" ? `${row.item.name} (gram)` : row.item.name;
      const dataRow = stockSheet.addRow({
        item: label,
        sistem: row.systemTotal,
        kepcab: row.confirmedQuantity ?? "",
        idr: row.confirmedIdrValue ?? "",
        selisih: row.selisih ?? "",
        jam: row.confirmedAt ? new Date(row.confirmedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
      });
      styleDataRow(dataRow, ["sistem", "kepcab", "idr", "selisih"]);
      if (row.confirmedQuantity !== null) {
        const cell = dataRow.getCell("selisih");
        const fill = row.isMatch ? MATCH_FILL : MISMATCH_FILL;
        const font = row.isMatch ? MATCH_FONT : MISMATCH_FONT;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        cell.font = { color: { argb: font } };
      }
    }

    // --- Sheet 3: Kas ---
    const kasSheet = wb.addWorksheet("Kas");
    kasSheet.columns = [
      { header: "Total Sistem", key: "sistem", width: 18 },
      { header: "Total Kepala Cabang", key: "kepcab", width: 20 },
      { header: "Selisih", key: "selisih", width: 16 },
      { header: "Jam Konfirmasi", key: "jam", width: 16 },
    ];
    styleHeaderRow(kasSheet.getRow(1));
    const kasRow = kasSheet.addRow({
      sistem: kas.systemTotal,
      kepcab: kas.confirmedIdrValue ?? "",
      selisih: kas.selisih ?? "",
      jam: kas.confirmedAt ? new Date(kas.confirmedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
    });
    styleDataRow(kasRow, ["sistem", "kepcab", "selisih"]);
    if (kas.confirmedIdrValue !== null) {
      const cell = kasRow.getCell("selisih");
      const fill = kas.isMatch ? MATCH_FILL : MISMATCH_FILL;
      const font = kas.isMatch ? MATCH_FONT : MISMATCH_FONT;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.font = { color: { argb: font } };
    }

    // --- Sheet 4: Bank ---
    const bankSheet = wb.addWorksheet("Bank", { views: [{ state: "frozen", ySplit: 1 }] });
    bankSheet.columns = [
      { header: "Bank", key: "bank", width: 16 },
      { header: "No Rekening", key: "noRek", width: 20 },
      { header: "Nama Rekening", key: "namaRek", width: 22 },
      { header: "Mata Uang", key: "mataUang", width: 12 },
      { header: "Saldo Hari Ini", key: "saldo", width: 18 },
    ];
    styleHeaderRow(bankSheet.getRow(1));
    for (const a of bankAccounts) {
      const entry = bankEntryMap.get(a.id);
      const saldo = entry ? Number(entry.balance) : Number(a.balance);
      const bankRow = bankSheet.addRow({
        bank: a.bankName,
        noRek: a.accountNumber ?? "",
        namaRek: a.accountName,
        mataUang: a.currency.code,
        saldo,
      });
      styleDataRow(bankRow, ["saldo"]);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const companyName = (company?.name ?? "pt").replace(/[^a-zA-Z0-9]+/g, "-");
    const filename = `cross-check-${companyName}-${dateStr}.xlsx`;

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
