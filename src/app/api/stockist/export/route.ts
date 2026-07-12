import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import { handleError } from "@/backend/helpers/handle-error";
import { requirePermission } from "@/backend/helpers/get-admin-caller";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCompanyAccess, stockistService } from "@/backend/services/stockist.service";
import { kasPocketRepository } from "@/backend/repositories/kas-pocket.repository";
import { kasDailyEntryRepository } from "@/backend/repositories/kas-daily-entry.repository";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type CheckStatus = "BELUM_REVIEW" | "BENAR" | "BEDA";

const STATUS_STYLE: Record<CheckStatus, { fill: string; font: string; label: string }> = {
  BENAR: { fill: "FFD7F2E3", font: "FF1B7A43", label: "Benar" },
  BEDA: { fill: "FFFAD4D4", font: "FFB42318", label: "Beda" },
  BELUM_REVIEW: { fill: "FFFCE8B8", font: "FF92610B", label: "Belum Review" },
};

const HEADER_FILL = "FF1F2937";
const HEADER_FONT = "FFFFFFFF";
const THIN_BORDER = { style: "thin" as const, color: { argb: "FFD1D5DB" } };

// GET /api/stockist/export?companyId=&date=YYYY-MM-DD
// Satu file Excel, 3 sheet: Stock (Mata Uang), Kas (Tunai), Bank — snapshot untuk tanggal terpilih.
// Stock, Kas, dan Bank semuanya milik 1 PT (dipakai bersama semua cabang di PT itu).
export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCKIST_VIEW);
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

    const [grid, kasPockets, kasEntries, kasPrevious] = await Promise.all([
      stockistService.getOrCreateGridForDate(companyId, date),
      kasPocketRepository.findAllByCompany(companyId, true),
      kasDailyEntryRepository.findByCompanyAndDate(companyId, date),
      kasDailyEntryRepository.findLatestBeforeDate(companyId, date),
    ]);

    const canViewBank = caller.permissions.includes(PERMISSIONS.BANK_VIEW);
    const [bankAccounts, bankEntries, bankPrevious] = canViewBank
      ? await Promise.all([
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
        ])
      : [[], [], []];

    const wb = new ExcelJS.Workbook();
    wb.creator = "Pusat Kirim Duit";
    wb.created = new Date();

    // --- Sheet 1: Stock (Mata Uang) — baris = nama mata uang, kolom = nama pocket ---
    const balanceMap = new Map(
      grid.balances.map((b) => [`${b.pocketId}:${b.companyStockItemId}`, Number(b.quantity)])
    );
    const checkMap = new Map(grid.checks.map((c) => [`${c.pocketId}:${c.companyStockItemId}`, c]));
    const activePockets = grid.pockets.filter((p) => p.isActive);

    const stockSheet = wb.addWorksheet("Stock (Mata Uang)", {
      views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
    });
    // Pocket "Total" (isDefault) sudah termasuk di activePockets dan otomatis jadi kolom
    // paling akhir (sortOrder-nya sengaja dibuat tinggi) — saldonya sudah dihitung backend.
    stockSheet.columns = [
      { header: "Mata Uang", key: "currency", width: 26 },
      ...activePockets.map((p) => ({ header: p.name, key: p.id, width: 16 })),
    ];

    const stockHeaderRow = stockSheet.getRow(1);
    stockHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: HEADER_FONT } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
    });
    stockHeaderRow.height = 22;

    for (const currency of grid.currencies) {
      const currencyLabel =
        currency.type === "LOGAM_MULIA" ? `${currency.name} (gram)` : currency.name;
      const rowValues: Record<string, string | number> = { currency: currencyLabel };
      for (const pocket of activePockets) {
        const check = checkMap.get(`${pocket.id}:${currency.id}`);
        const entered = check?.enteredQuantity;
        const balance = balanceMap.get(`${pocket.id}:${currency.id}`) ?? 0;
        rowValues[pocket.id] = entered !== null && entered !== undefined ? Number(entered) : balance;
      }
      const row = stockSheet.addRow(rowValues);

      const totalPocket = activePockets.find((p) => p.isDefault);
      if (totalPocket) {
        const totalCell = row.getCell(totalPocket.id);
        totalCell.font = { bold: true };
        totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEFF2" } };
      }

      row.getCell("currency").font = { bold: true };
      row.getCell("currency").alignment = { vertical: "middle", horizontal: "left" };
      row.getCell("currency").border = {
        top: THIN_BORDER,
        bottom: THIN_BORDER,
        left: THIN_BORDER,
        right: THIN_BORDER,
      };

      for (const pocket of activePockets) {
        const cell = row.getCell(pocket.id);
        cell.numFmt = "#,##0";
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

        // Cuma kasih warna status kalau sel ini memang sudah diisi opname-nya —
        // sel yang belum pernah diisi dibiarkan polos, tidak ditandai kuning.
        const check = checkMap.get(`${pocket.id}:${currency.id}`);
        if (check?.enteredQuantity !== null && check?.enteredQuantity !== undefined) {
          const style = STATUS_STYLE[check.status as CheckStatus];
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
          cell.font = { color: { argb: style.font } };
        }
      }
    }

    // Legend status warna
    stockSheet.addRow([]);
    const legendTitleRow = stockSheet.addRow(["Keterangan Warna"]);
    legendTitleRow.getCell(1).font = { bold: true };
    for (const status of ["BENAR", "BEDA", "BELUM_REVIEW"] as CheckStatus[]) {
      const style = STATUS_STYLE[status];
      const legendRow = stockSheet.addRow([style.label]);
      const cell = legendRow.getCell(1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
      cell.font = { color: { argb: style.font } };
      cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
    }

    // --- Sheet 2: Kas (Tunai) ---
    const kasEntryMap = new Map(kasEntries.map((e) => [e.kasPocketId, e]));
    const kasPrevMap = new Map(kasPrevious.map((e) => [e.kasPocketId, e]));
    const kasSheet = wb.addWorksheet("Kas (Tunai)", { views: [{ state: "frozen", ySplit: 1 }] });
    kasSheet.columns = [
      { header: "Pocket", key: "pocket", width: 24 },
      { header: "Saldo Kemarin", key: "kemarin", width: 18 },
      { header: "Saldo Hari Ini", key: "hariIni", width: 18 },
      { header: "Delta", key: "delta", width: 14 },
      { header: "Catatan", key: "catatan", width: 30 },
    ];
    styleHeaderRow(kasSheet.getRow(1));

    for (const p of kasPockets.filter((p) => p.isActive)) {
      const entry = kasEntryMap.get(p.id);
      const prev = kasPrevMap.get(p.id);
      const saldoHariIni = entry ? Number(entry.balance) : 0;
      const saldoKemarin = prev ? Number(prev.balance) : 0;
      const row = kasSheet.addRow({
        pocket: p.name,
        kemarin: saldoKemarin,
        hariIni: saldoHariIni,
        delta: saldoHariIni - saldoKemarin,
        catatan: entry?.note ?? "",
      });
      styleDataRow(row, ["kemarin", "hariIni", "delta"]);
    }

    // --- Sheet 3: Bank (rekening PT ini) ---
    if (canViewBank) {
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
        { header: "Tarik Cek", key: "tarikCek", width: 14 },
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
          tarikCek: entry ? Number(entry.tarikCek) : 0,
          catatan: entry?.note ?? "",
        });
        styleDataRow(row, ["kemarin", "hariIni", "tarikCek"]);
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const companyName = (company?.name ?? "pt").replace(/[^a-zA-Z0-9]+/g, "-");
    const filename = `export-stock-kas-bank-${companyName}-${dateStr}.xlsx`;

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
