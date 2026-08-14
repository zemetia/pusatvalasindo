import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import { handleError } from "@/backend/helpers/handle-error";
import { authorize } from "@/backend/helpers/authz";
import { stockistHeadConfirmationService } from "@/backend/services/stockist-head-confirmation.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const HEADER_FILL = "FF1F2937";
const HEADER_FONT = "FFFFFFFF";
const THIN_BORDER = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
const MATCH_FILL = "FFD7F2E3";
const MATCH_FONT = "FF1B7A43";
const MISMATCH_FILL = "FFFAD4D4";
const MISMATCH_FONT = "FFB42318";

/**
 * Kolom jam di file ini berisi JAM KLOP saja — sama seperti halamannya. Baris yang masih
 * selisih dibiarkan kosong: jam pengisian pada baris yang belum cocok terbaca seolah baris
 * itu sudah beres.
 */
function jamKlop(isMatch: boolean, iso: Date | string | null | undefined) {
  if (!isMatch || !iso) return "";
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// GET /api/stockist/head-confirmation/export?companyId=&date=YYYY-MM-DD
// Export lengkap hasil cross-check kepala cabang: Ringkasan, Stock Harian, Kas, Bank — 1 file, 4 sheet.
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
    // Scope BACA resource cross-check untuk PT yang diminta — export tidak boleh
    // lebih longgar dari halamannya.
    const authz = await authorize("stockist.verify", "view", { companyId });
    if (authz instanceof NextResponse) return authz;

    const date = new Date(dateStr);
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });

    const [stockRows, stockTotal, kas, bankConfirmation, companyTotal, bankAccounts, bankEntries] = await Promise.all([
      stockistHeadConfirmationService.getStockConfirmationGrid(companyId, date),
      stockistHeadConfirmationService.getStockTotalConfirmation(companyId, date),
      stockistHeadConfirmationService.getKasConfirmation(companyId, date),
      stockistHeadConfirmationService.getBankConfirmation(companyId, date),
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

    // Total IDR stock kini satu angka final dari kepala cabang, bukan penjumlahan per item.
    const stockTotalIdr = stockTotal ? Number(stockTotal.confirmedIdrValue) : 0;
    const kasTotalIdr = kas.confirmedIdrValue ?? 0;
    const bankTotalIdr = bankConfirmation.confirmedIdrValue ?? 0;
    const grandTotal = companyTotal
      ? Number(companyTotal.totalIdr)
      : stockTotalIdr + kasTotalIdr + bankTotalIdr;
    const stockSystemSum = stockRows.reduce((sum, r) => sum + r.systemTotal, 0);
    const stockKepcabSum = stockRows.reduce((sum, r) => sum + (r.confirmedQuantity ?? 0), 0);

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
    r = ringkasan.addRow({ label: "Total Bank (Kepala Cabang, IDR)", value: bankTotalIdr });
    styleDataRow(r, ["value"]);
    r = ringkasan.addRow({ label: "Total Bank (Sistem, IDR)", value: bankConfirmation.systemTotal });
    styleDataRow(r, ["value"]);
    for (const [code, total] of bankByCurrency) {
      r = ringkasan.addRow({ label: `Saldo Bank per Mata Uang (${code})`, value: total });
      styleDataRow(r, ["value"]);
    }
    ringkasan.addRow({});
    r = ringkasan.addRow({ label: "Total Keseluruhan (Stock + Kas + Bank, IDR)", value: grandTotal });
    r.getCell("label").font = { bold: true };
    r.getCell("value").font = { bold: true };
    styleDataRow(r, ["value"]);

    // --- Sheet 2: Stock Harian ---
    const stockSheet = wb.addWorksheet("Stock Harian", { views: [{ state: "frozen", ySplit: 1 }] });
    stockSheet.columns = [
      { header: "Item", key: "item", width: 24 },
      { header: "Total Sistem", key: "sistem", width: 16 },
      { header: "Total Kepala Cabang", key: "kepcab", width: 20 },
      { header: "Selisih", key: "selisih", width: 16 },
      { header: "Jam Klop", key: "jam", width: 16 },
    ];
    styleHeaderRow(stockSheet.getRow(1));
    for (const row of stockRows) {
      const label = row.item.type === "LOGAM_MULIA" ? `${row.item.name} (gram)` : row.item.name;
      const dataRow = stockSheet.addRow({
        item: label,
        sistem: row.systemTotal,
        kepcab: row.confirmedQuantity ?? "",
        selisih: row.selisih ?? "",
        jam: jamKlop(row.isMatch, row.confirmedAt),
      });
      styleDataRow(dataRow, ["sistem", "kepcab", "selisih"]);
      if (row.confirmedQuantity !== null) {
        const cell = dataRow.getCell("selisih");
        const fill = row.isMatch ? MATCH_FILL : MISMATCH_FILL;
        const font = row.isMatch ? MATCH_FONT : MISMATCH_FONT;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        cell.font = { color: { argb: font } };
      }
    }

    // Baris total: kuantitas beda mata uang dijumlahkan mentah (permintaan client — cukup untuk
    // melihat ada/tidaknya selisih keseluruhan), lalu satu total IDR final di bawahnya.
    const stockTotalRow = stockSheet.addRow({
      item: "TOTAL KESELURUHAN",
      sistem: stockSystemSum,
      kepcab: stockKepcabSum,
      selisih: stockKepcabSum - stockSystemSum,
      jam: "",
    });
    styleDataRow(stockTotalRow, ["sistem", "kepcab", "selisih"]);
    stockTotalRow.font = { bold: true };
    const totalSelisihCell = stockTotalRow.getCell("selisih");
    const totalMatch = stockKepcabSum - stockSystemSum === 0;
    totalSelisihCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: totalMatch ? MATCH_FILL : MISMATCH_FILL },
    };
    totalSelisihCell.font = { bold: true, color: { argb: totalMatch ? MATCH_FONT : MISMATCH_FONT } };

    const stockIdrRow = stockSheet.addRow({
      item: "TOTAL IDR (FINAL)",
      sistem: "",
      kepcab: stockTotalIdr,
      selisih: "",
      // Baris ini tidak punya total sistem sendiri — klop-nya ikut kecocokan kuantitas
      // seluruh item di atasnya (sama seperti di halaman cross-check).
      jam: jamKlop(totalMatch, stockTotal?.confirmedAt),
    });
    styleDataRow(stockIdrRow, ["kepcab"]);
    stockIdrRow.font = { bold: true };

    // --- Sheet 3: Kas ---
    const kasSheet = wb.addWorksheet("Kas");
    kasSheet.columns = [
      { header: "Total Sistem", key: "sistem", width: 18 },
      { header: "Total Kepala Cabang", key: "kepcab", width: 20 },
      { header: "Selisih", key: "selisih", width: 16 },
      { header: "Jam Klop", key: "jam", width: 16 },
    ];
    styleHeaderRow(kasSheet.getRow(1));
    const kasRow = kasSheet.addRow({
      sistem: kas.systemTotal,
      kepcab: kas.confirmedIdrValue ?? "",
      selisih: kas.selisih ?? "",
      jam: jamKlop(kas.isMatch, kas.matchedAt),
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

    // Cross-check bank di bawah daftar rekening: total sistem vs total kepala cabang.
    bankSheet.addRow({});
    const bankCheckHeader = bankSheet.addRow({
      bank: "CROSS-CHECK BANK",
      noRek: "Total Sistem",
      namaRek: "Total Kepala Cabang",
      mataUang: "Selisih",
      saldo: "Jam Klop",
    });
    styleHeaderRow(bankCheckHeader);
    const bankCheckRow = bankSheet.addRow({
      bank: "",
      noRek: bankConfirmation.systemTotal,
      namaRek: bankConfirmation.confirmedIdrValue ?? "",
      mataUang: bankConfirmation.selisih ?? "",
      saldo: jamKlop(bankConfirmation.isMatch, bankConfirmation.matchedAt),
    });
    styleDataRow(bankCheckRow, ["noRek", "namaRek", "mataUang"]);
    if (bankConfirmation.confirmedIdrValue !== null) {
      const cell = bankCheckRow.getCell("mataUang");
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bankConfirmation.isMatch ? MATCH_FILL : MISMATCH_FILL },
      };
      cell.font = { color: { argb: bankConfirmation.isMatch ? MATCH_FONT : MISMATCH_FONT } };
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
