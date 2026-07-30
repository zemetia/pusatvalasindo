import { z, type ZodRawShape } from "zod";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { ForbiddenError, NotFoundError, ValidationError } from "@/backend/errors/app-error";
import { currencyStockService, companyIdOfBranch } from "@/backend/services/currency-stock.service";
import { bankAccountService } from "@/backend/services/bank-account.service";
import { bankMutationService } from "@/backend/services/bank-mutation.service";
import { stockistHeadConfirmationService } from "@/backend/services/stockist-head-confirmation.service";
import { stockistService, assertCompanyAccess } from "@/backend/services/stockist.service";
import { stockistPocketRepository } from "@/backend/repositories/stockist-pocket.repository";
import { kasPocketRepository } from "@/backend/repositories/kas-pocket.repository";
import { kasDailyEntryRepository } from "@/backend/repositories/kas-daily-entry.repository";
import { priceBenchmarkService } from "@/backend/services/price-benchmark.service";
import { BankMutationType, type StockistMutationType } from "@src/generated/prisma/client";
import type { McpCaller } from "@/backend/mcp/auth";

/**
 * OPERATE tools go through the existing service layer (validation + the same
 * scoping rules as the web UI) — never raw SQL. Each declares the permission(s)
 * it needs and a Zod input schema (the shape the MCP SDK registers).
 *
 * PT scoping: an operate tool must confirm the target belongs to the caller's
 * PT before mutating. Global keys (companyId null) may act on any PT.
 */

export type OperateTool = {
  name: string;
  description: string;
  permission: Permission[];
  inputSchema: ZodRawShape;
  handler: (args: Record<string, unknown>, caller: McpCaller) => Promise<unknown>;
};

function str(args: Record<string, unknown>, key: string, required = true): string {
  const v = args[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new ValidationError(`Missing required argument: ${key}`);
    return "";
  }
  return String(v);
}

function num(args: Record<string, unknown>, key: string, required = true): number {
  const v = args[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new ValidationError(`Missing required argument: ${key}`);
    return NaN;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ValidationError(`Argument ${key} must be a number`);
  return n;
}

/** Parses a "YYYY-MM-DD" date as UTC-midnight, matching the services' convention. */
function parseDateOnly(raw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) throw new ValidationError(`date must be YYYY-MM-DD (got "${raw}")`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Asserts a company target is within the caller's PT (global keys pass through). */
function assertCompanyScope(caller: McpCaller, companyId: string) {
  if (caller.companyId && caller.companyId !== companyId) {
    throw new ForbiddenError("Tidak punya akses ke PT lain");
  }
}

export const OPERATE_TOOLS: OperateTool[] = [
  {
    name: "get_patokan_harga",
    description:
      "List Patokan Harga: every SmartDeal-quoted currency with its saved sell/buy adjustment rule (e.g. \"+5\", \"-10\", \"c5\", \"f0.05\", \"c0.1+5\", or empty for none). Returns the RULES, not prices — use get_harga_final for the resulting harga jual/beli. Global — not PT-scoped.",
    permission: [PERMISSIONS.CURRENCY_VIEW],
    inputSchema: {
      code: z.string().optional().describe("Filter to a single currency code, e.g. USD"),
    },
    handler: async (args) => {
      const rows = await priceBenchmarkService.getAll();
      const code = str(args, "code", false);
      return code ? rows.filter((r) => r.code === code.toUpperCase()) : rows;
    },
  },
  {
    name: "set_patokan_harga",
    description:
      "Set (upsert) the sell and/or buy price adjustment rule for one currency in Patokan Harga. Syntax: \"+5\"/\"-10\" adds/subtracts a flat amount, \"c5\" ceils to the nearest multiple of 5, \"f5\" floors to the nearest multiple of 5, \"f0.05\"/\"c0.05\" round to the nearest 0.05, \"c0.1+5\" chains a rounding step then an offset. Pass an empty string to clear a rule. Unset fields keep their current saved value.",
    permission: [PERMISSIONS.CURRENCY_MANAGE],
    inputSchema: {
      code: z.string().describe("Currency code, e.g. USD"),
      sell_adjustment: z.string().optional().describe('e.g. "+5", "-10", "c5", "f0.05", "c0.1+5", or "" to clear'),
      buy_adjustment: z.string().optional().describe('e.g. "+5", "-10", "c5", "f0.05", "c0.1+5", or "" to clear'),
    },
    handler: async (args, caller) => {
      const code = str(args, "code").toUpperCase();
      if (args.sell_adjustment === undefined && args.buy_adjustment === undefined) {
        throw new ValidationError("Provide at least one of sell_adjustment / buy_adjustment");
      }
      const current = (await priceBenchmarkService.getAll()).find((r) => r.code === code);
      return priceBenchmarkService.saveAdjustment({
        code,
        sellAdjustment: args.sell_adjustment === undefined ? current?.sellAdjustment ?? "" : str(args, "sell_adjustment", false),
        buyAdjustment: args.buy_adjustment === undefined ? current?.buyAdjustment ?? "" : str(args, "buy_adjustment", false),
        updatedBy: caller.id,
      });
    },
  },
  {
    name: "get_harga_final",
    description:
      "Harga jual/beli akhir per currency: the latest SmartDeal rate with the saved Patokan Harga rule already applied. Returns base_sell/base_buy (SmartDeal), the rule used, the resulting sell/buy, the spread, and when the base was scraped. Use this for \"berapa harga jual/beli USD kita\"; use get_patokan_harga when you only need the adjustment rules. Global — not PT-scoped.",
    permission: [PERMISSIONS.CURRENCY_VIEW],
    inputSchema: {
      code: z.string().optional().describe("Filter to a single currency code, e.g. USD"),
    },
    handler: async (args) => priceBenchmarkService.getQuotes(str(args, "code", false) || undefined),
  },
  {
    name: "update_currency_rate",
    description:
      "Update the buy and/or sell rate of a currency stock row (by its currency_stock id). At least one of buy_rate / sell_rate is required.",
    permission: [PERMISSIONS.CURRENCY_MANAGE],
    inputSchema: {
      currency_stock_id: z.string().describe("id from get_currency_stock"),
      buy_rate: z.number().optional(),
      sell_rate: z.number().optional(),
    },
    handler: async (args, caller) => {
      const id = str(args, "currency_stock_id");
      const buyRate = args.buy_rate === undefined ? undefined : num(args, "buy_rate");
      const sellRate = args.sell_rate === undefined ? undefined : num(args, "sell_rate");
      if (buyRate === undefined && sellRate === undefined) {
        throw new ValidationError("Provide at least one of buy_rate / sell_rate");
      }
      // MCP callers are resolved from a key, not a session, so they can't carry
      // an Authz — the PT of the stock's branch is checked with the same
      // company-scope guard the other MCP tools use.
      const stock = await currencyStockService.getById(id);
      if (stock.branchId) {
        const companyId = await companyIdOfBranch(stock.branchId);
        if (companyId) assertCompanyAccess(caller, companyId);
      }
      return currencyStockService.updateRates(id, buyRate, sellRate);
    },
  },
  {
    name: "create_bank_mutation",
    description:
      "Record a bank CREDIT (masuk) or DEBIT (keluar) on a bank account; updates the account balance atomically.",
    permission: [PERMISSIONS.BANK_MANAGE],
    inputSchema: {
      bank_account_id: z.string().describe("id from get_bank_accounts"),
      type: z.enum(["CREDIT", "DEBIT"]),
      amount: z.number().positive().describe("positive IDR (or account currency) amount"),
      description: z.string().optional(),
    },
    handler: async (args, caller) => {
      const bankAccountId = str(args, "bank_account_id");
      const typeRaw = str(args, "type").toUpperCase();
      if (typeRaw !== "CREDIT" && typeRaw !== "DEBIT") {
        throw new ValidationError("type must be CREDIT or DEBIT");
      }
      const amount = num(args, "amount");
      // Confirm the account is within the caller's PT before mutating.
      const account = await bankAccountService.getById(bankAccountId);
      assertCompanyScope(caller, account.companyId);
      return bankMutationService.create({
        bankAccountId,
        type: typeRaw === "CREDIT" ? BankMutationType.CREDIT : BankMutationType.DEBIT,
        amount,
        description: str(args, "description", false) || undefined,
        createdBy: caller.id,
      });
    },
  },
  {
    name: "confirm_stockist_head",
    description:
      "Kepala cabang: record the re-counted quantity for one stock item on a date (kepala cabang cross-check / reconciliation). The IDR value is no longer per item — use confirm_stockist_total_head for the single final stock total. Drives hv_stockist_head_confirmations.",
    permission: [PERMISSIONS.STOCKIST_VERIFY],
    inputSchema: {
      company_id: z.string().describe("PT id (from get_companies)"),
      company_stock_item_id: z.string().describe("id from get_company_stock_items"),
      date: z.string().describe("YYYY-MM-DD"),
      confirmed_quantity: z.number(),
      note: z.string().optional(),
    },
    handler: async (args, caller) => {
      const companyId = str(args, "company_id");
      assertCompanyScope(caller, companyId);
      return stockistHeadConfirmationService.upsertStockConfirmation({
        companyId,
        companyStockItemId: str(args, "company_stock_item_id"),
        date: parseDateOnly(str(args, "date")),
        confirmedQuantity: num(args, "confirmed_quantity"),
        note: str(args, "note", false) || undefined,
        // Pemanggil MCP selalu role global (lihat mcp/auth.ts), jadi kemampuan
        // ubah tanggal lampau memang melekat padanya.
        caller: { id: caller.id, canBackdate: true },
      });
    },
  },
  {
    name: "confirm_stockist_total_head",
    description:
      "Kepala cabang: record the single final IDR total for all stock (currencies + logam mulia) of a PT on a date. Drives hv_stockist_total_head_confirmations.",
    permission: [PERMISSIONS.STOCKIST_VERIFY],
    inputSchema: {
      company_id: z.string().describe("PT id (from get_companies)"),
      date: z.string().describe("YYYY-MM-DD"),
      confirmed_idr_value: z.number(),
      note: z.string().optional(),
    },
    handler: async (args, caller) => {
      const companyId = str(args, "company_id");
      assertCompanyScope(caller, companyId);
      return stockistHeadConfirmationService.upsertStockTotalConfirmation({
        companyId,
        date: parseDateOnly(str(args, "date")),
        confirmedIdrValue: num(args, "confirmed_idr_value"),
        note: str(args, "note", false) || undefined,
        // Pemanggil MCP selalu role global (lihat mcp/auth.ts), jadi kemampuan
        // ubah tanggal lampau memang melekat padanya.
        caller: { id: caller.id, canBackdate: true },
      });
    },
  },
  {
    name: "confirm_kas_head",
    description:
      "Kepala cabang: record the re-counted cash (kas) total for a PT on a date. Drives hv_kas_head_confirmations.",
    permission: [PERMISSIONS.STOCKIST_VERIFY],
    inputSchema: {
      company_id: z.string().describe("PT id (from get_companies)"),
      date: z.string().describe("YYYY-MM-DD"),
      confirmed_idr_value: z.number(),
      note: z.string().optional(),
    },
    handler: async (args, caller) => {
      const companyId = str(args, "company_id");
      assertCompanyScope(caller, companyId);
      return stockistHeadConfirmationService.upsertKasConfirmation({
        companyId,
        date: parseDateOnly(str(args, "date")),
        confirmedIdrValue: num(args, "confirmed_idr_value"),
        note: str(args, "note", false) || undefined,
        // Pemanggil MCP selalu role global (lihat mcp/auth.ts), jadi kemampuan
        // ubah tanggal lampau memang melekat padanya.
        caller: { id: caller.id, canBackdate: true },
      });
    },
  },
  {
    name: "confirm_bank_head",
    description:
      "Kepala cabang: record the re-counted total bank balance (all of the PT's accounts combined) on a date. Drives hv_bank_head_confirmations.",
    permission: [PERMISSIONS.STOCKIST_VERIFY],
    inputSchema: {
      company_id: z.string().describe("PT id (from get_companies)"),
      date: z.string().describe("YYYY-MM-DD"),
      confirmed_idr_value: z.number(),
      note: z.string().optional(),
    },
    handler: async (args, caller) => {
      const companyId = str(args, "company_id");
      assertCompanyScope(caller, companyId);
      return stockistHeadConfirmationService.upsertBankConfirmation({
        companyId,
        date: parseDateOnly(str(args, "date")),
        confirmedIdrValue: num(args, "confirmed_idr_value"),
        note: str(args, "note", false) || undefined,
        // Pemanggil MCP selalu role global (lihat mcp/auth.ts), jadi kemampuan
        // ubah tanggal lampau memang melekat padanya.
        caller: { id: caller.id, canBackdate: true },
      });
    },
  },
  {
    name: "record_stockist_mutation",
    description:
      "Record a stockist pocket mutation: TOP_UP / WITHDRAWAL / ADJUSTMENT / OPENING on one pocket, or TRANSFER_OUT to move stock into another pocket (pass to_pocket_id). Updates the pocket balance. ADJUSTMENT quantity may be negative; the others must be > 0.",
    permission: [PERMISSIONS.STOCKIST_MANAGE],
    inputSchema: {
      pocket_id: z.string().describe("id from get_stockist_pockets (source pocket)"),
      company_stock_item_id: z.string().describe("id from get_company_stock_items"),
      type: z.enum(["OPENING", "TOP_UP", "WITHDRAWAL", "TRANSFER_OUT", "ADJUSTMENT"]),
      quantity: z.number(),
      to_pocket_id: z.string().optional().describe("destination pocket — required when type = TRANSFER_OUT"),
      note: z.string().optional(),
    },
    handler: async (args, caller) => {
      const pocketId = str(args, "pocket_id");
      const companyStockItemId = str(args, "company_stock_item_id");
      const type = str(args, "type").toUpperCase();
      const quantity = num(args, "quantity");
      const note = str(args, "note", false) || undefined;

      const pocket = await stockistPocketRepository.findById(pocketId);
      if (!pocket) throw new NotFoundError("Pocket tidak ditemukan");
      assertCompanyAccess(caller, pocket.companyId);

      if (type === "TRANSFER_OUT") {
        const toPocketId = str(args, "to_pocket_id");
        const toPocket = await stockistPocketRepository.findById(toPocketId);
        if (!toPocket) throw new NotFoundError("Pocket tujuan tidak ditemukan");
        assertCompanyAccess(caller, toPocket.companyId);
        return stockistService.transferBetweenPockets({
          fromPocketId: pocketId,
          toPocketId,
          companyStockItemId,
          quantity,
          note,
          createdBy: caller.id,
        });
      }

      return stockistService.applyStockistMutation({
        pocketId,
        companyStockItemId,
        type: type as StockistMutationType,
        quantity,
        note,
        createdBy: caller.id,
      });
    },
  },
  {
    name: "record_kas_entry",
    description:
      "Upsert the daily cash (kas) balance for a kas pocket on a date. Overwrites the pocket's entry for that date.",
    permission: [PERMISSIONS.STOCKIST_MANAGE],
    inputSchema: {
      kas_pocket_id: z.string().describe("id from get_kas_pockets"),
      date: z.string().describe("YYYY-MM-DD"),
      balance: z.number().describe("cash balance in IDR"),
      note: z.string().optional(),
    },
    handler: async (args, caller) => {
      const kasPocketId = str(args, "kas_pocket_id");
      const pocket = await kasPocketRepository.findById(kasPocketId);
      if (!pocket) throw new NotFoundError("Kas pocket tidak ditemukan");
      assertCompanyAccess(caller, pocket.companyId);
      return kasDailyEntryRepository.upsert({
        kasPocketId,
        date: parseDateOnly(str(args, "date")),
        balance: num(args, "balance"),
        note: str(args, "note", false) || undefined,
        createdBy: caller.id,
      });
    },
  },
  {
    name: "fill_stockist_daily_check",
    description:
      "Fill the teller opname (physical stock count) for one pocket+item for TODAY. Today only, and this is the number kepala cabang reviews the next day.",
    permission: [PERMISSIONS.STOCKIST_MANAGE],
    inputSchema: {
      pocket_id: z.string().describe("id from get_stockist_pockets"),
      company_stock_item_id: z.string().describe("id from get_company_stock_items"),
      date: z.string().describe("YYYY-MM-DD (must be today)"),
      quantity: z.number().describe("counted quantity"),
    },
    handler: async (args, caller) => {
      const pocketId = str(args, "pocket_id");
      const pocket = await stockistPocketRepository.findById(pocketId);
      if (!pocket) throw new NotFoundError("Pocket tidak ditemukan");
      assertCompanyAccess(caller, pocket.companyId);
      return stockistService.fillDailyCheck({
        pocketId,
        companyStockItemId: str(args, "company_stock_item_id"),
        date: parseDateOnly(str(args, "date")),
        quantity: num(args, "quantity"),
        filledBy: caller.id,
      });
    },
  },
];
