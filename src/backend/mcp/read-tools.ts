import prisma from "@/lib/prisma";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import type { McpCaller } from "@/backend/mcp/auth";

/**
 * READ tools back onto the read-only `hv_*` views (see docs/openclaw/schema.md).
 * Every identifier below (view name, filter columns, scope column, order-by) is a
 * developer-defined literal from that schema — never user input — so the dynamic
 * SQL is injection-safe; only values are bound as parameters.
 *
 * PT scoping is enforced here, not left to the agent: a company-scoped key
 * (companyId set) can only ever read its own PT's rows.
 */

type FilterType = "text" | "int" | "bool";

type Filter = { column: string; type: FilterType };

export type ReadTool = {
  name: string;
  description: string;
  /** null = any authenticated key; array = key must hold at least one. */
  permission: Permission[] | null;
  view: string;
  /** How company scoping is applied for PT-scoped keys. */
  scope: "company_id" | "id" | "company_code" | "none";
  /** Whitelisted exact-match filters: arg name → column. */
  filters: Record<string, Filter>;
  orderBy: string;
  defaultLimit: number;
  maxLimit: number;
};

const f = (column: string, type: FilterType = "text"): Filter => ({ column, type });

// Filters shared by most time-series views.
const PERIOD_FILTERS = {
  year: f("year", "int"),
  month: f("month", "int"),
  period_label: f("period_label"),
  company_code: f("company_code"),
};

export const READ_TOOLS: ReadTool[] = [
  {
    name: "get_companies",
    description: "List PT companies with branch & employee counts.",
    permission: null,
    view: "hv_companies",
    scope: "id",
    filters: { company_code: f("company_code"), is_active: f("is_active", "bool") },
    orderBy: '"company_name" ASC',
    defaultLimit: 100,
    maxLimit: 500,
  },
  {
    name: "get_branches",
    description: "List branches with company name and headcount.",
    permission: null,
    view: "hv_branches",
    scope: "company_id",
    filters: { company_code: f("company_code"), is_active: f("is_active", "bool") },
    orderBy: '"company_name" ASC, "branch_name" ASC',
    defaultLimit: 200,
    maxLimit: 1000,
  },
  {
    name: "get_employees",
    description: "List employees with salary breakdown, role, and context_summary.",
    permission: [PERMISSIONS.USERS_VIEW],
    view: "hv_employees",
    scope: "company_id",
    filters: {
      company_code: f("company_code"),
      is_active: f("is_active", "bool"),
      role_name: f("role_name"),
      branch_id: f("branch_id"),
    },
    orderBy: '"company_name" ASC, "total_fixed_salary" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_attendance",
    description: "Daily attendance records with computed work_hours and status labels.",
    permission: [PERMISSIONS.ATTENDANCE_VIEW_ALL],
    view: "hv_attendance",
    scope: "company_code", // hv_attendance has no company_id column
    filters: { company_code: f("company_code"), year: f("year", "int"), month: f("month", "int"), status: f("status"), user_id: f("user_id") },
    orderBy: '"date" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_attendance_monthly",
    description: "Monthly attendance summary (present/late/absent/etc.) per employee.",
    permission: [PERMISSIONS.ATTENDANCE_VIEW_ALL],
    view: "hv_attendance_monthly",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS },
    orderBy: '"late_days" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_kpi_monthly",
    description: "Monthly KPI results — score, grade (A/B/C/D), bonus, context_summary.",
    permission: [PERMISSIONS.KPI_VIEW_ALL],
    view: "hv_kpi_monthly",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, grade: f("grade") },
    orderBy: '"total_score" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_kpi_logs",
    description: "Individual KPI log entries per employee.",
    permission: [PERMISSIONS.KPI_VIEW_ALL],
    view: "hv_kpi_logs",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS },
    orderBy: '"created_at" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_kpi_definitions",
    description: "KPI definitions per role per company with weights.",
    permission: [PERMISSIONS.KPI_VIEW_ALL],
    view: "hv_kpi_definitions",
    scope: "company_id",
    filters: { company_code: f("company_code"), role_name: f("role_name") },
    orderBy: '"company_name" ASC, "role_name" ASC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_bonus_tiers",
    description: "Bonus matrix tier rules per company and role.",
    permission: [PERMISSIONS.KPI_VIEW_ALL],
    view: "hv_bonus_tiers",
    scope: "company_id",
    filters: { company_code: f("company_code"), role_name: f("role_name") },
    orderBy: '"company_name" ASC, "role_name" ASC, "min_score" ASC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_payroll_monthly",
    description: "Full payroll estimate — salary + deductions + KPI + context_summary.",
    permission: [PERMISSIONS.PAYROLL_VIEW_ALL, PERMISSIONS.PAYROLL_VIEW_COMPANY],
    view: "hv_payroll_monthly",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS },
    orderBy: '"company_name" ASC, "estimated_take_home_pay" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_revenue_monthly",
    description: "Monthly revenue summary (total, avg, max, min) per employee.",
    permission: [PERMISSIONS.PAYROLL_VIEW_ALL, PERMISSIONS.PAYROLL_VIEW_COMPANY, PERMISSIONS.KPI_VIEW_ALL],
    view: "hv_revenue_monthly",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS },
    orderBy: '"total_revenue" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_bank_accounts",
    description: "Bank accounts with current balance per PT.",
    permission: [PERMISSIONS.BANK_VIEW],
    view: "hv_bank_accounts",
    scope: "company_id",
    filters: { company_code: f("company_code"), currency_code: f("currency_code"), is_active: f("is_active", "bool") },
    orderBy: '"company_name" ASC, "sort_order" ASC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_bank_balance_by_company",
    description: "Total bank balance grouped by company and currency.",
    permission: [PERMISSIONS.BANK_VIEW],
    view: "hv_bank_balance_by_company",
    scope: "company_id",
    filters: { company_code: f("company_code"), currency_code: f("currency_code") },
    orderBy: '"company_name" ASC, "currency_code" ASC',
    defaultLimit: 200,
    maxLimit: 1000,
  },
  {
    name: "get_bank_daily",
    description: "Daily bank balance snapshots.",
    permission: [PERMISSIONS.BANK_VIEW],
    view: "hv_bank_daily",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, bank_account_id: f("bank_account_id") },
    orderBy: '"date" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_bank_mutations",
    description: "All bank CREDIT/DEBIT transactions.",
    permission: [PERMISSIONS.BANK_VIEW],
    view: "hv_bank_mutations",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, bank_account_id: f("bank_account_id"), mutation_type: f("mutation_type") },
    orderBy: '"created_at" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_currency_stock",
    description: "Current foreign-currency stock per branch with IDR value estimates and spread.",
    permission: [PERMISSIONS.STOCK_VIEW, PERMISSIONS.CURRENCY_VIEW],
    view: "hv_currency_stock",
    scope: "company_id",
    filters: { company_code: f("company_code"), currency_code: f("currency_code"), branch_id: f("branch_id") },
    orderBy: '"company_name" ASC, "currency_code" ASC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_currency_stock_by_company",
    description: "Currency stock totals with potential gross profit per PT (rates overview).",
    permission: [PERMISSIONS.STOCK_VIEW, PERMISSIONS.CURRENCY_VIEW],
    view: "hv_currency_stock_by_company",
    scope: "company_id",
    filters: { company_code: f("company_code"), currency_code: f("currency_code") },
    orderBy: '"company_name" ASC, "currency_code" ASC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_company_stock_items",
    description: "Stockist stock item catalog (mata uang / logam mulia) per PT.",
    permission: [PERMISSIONS.COMPANY_STOCK_VIEW, PERMISSIONS.STOCKIST_VIEW],
    view: "hv_company_stock_items",
    scope: "company_id",
    filters: { company_code: f("company_code"), item_type: f("item_type"), is_active: f("is_active", "bool") },
    orderBy: '"company_name" ASC, "sort_order" ASC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_stockist_pockets",
    description: "Stockist pocket list per PT (Kas Kecil, Finance Blue, Kurir A, dst).",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_stockist_pockets",
    scope: "company_id",
    filters: { company_code: f("company_code"), is_active: f("is_active", "bool") },
    orderBy: '"company_name" ASC, "sort_order" ASC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_stockist_balances",
    description: "Current stockist balance matrix (pocket × stock item).",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_stockist_balances",
    scope: "company_id",
    filters: { company_code: f("company_code"), pocket_id: f("pocket_id"), stock_item_id: f("stock_item_id") },
    orderBy: '"company_name" ASC, "pocket_name" ASC',
    defaultLimit: 1000,
    maxLimit: 5000,
  },
  {
    name: "get_stockist_stock_by_company",
    description: "Stockist stock totals per PT per item (the aggregate 'Total' pocket).",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_stockist_stock_by_company",
    scope: "company_id",
    filters: { company_code: f("company_code"), stock_item_id: f("stock_item_id") },
    orderBy: '"company_name" ASC, "stock_item_name" ASC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_stockist_mutations",
    description: "Stockist pocket mutation history (top up, withdrawal, transfer, adjustment).",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_stockist_mutations",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, pocket_id: f("pocket_id"), stock_item_id: f("stock_item_id"), mutation_type: f("mutation_type") },
    orderBy: '"created_at" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_stockist_daily_checks",
    description: "Daily opname (physical stock check) status per pocket per item.",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_stockist_daily_checks",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, pocket_id: f("pocket_id"), stock_item_id: f("stock_item_id"), status: f("status") },
    orderBy: '"date" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_stockist_head_confirmations",
    description: "Kepala cabang re-counted stock total per item/date vs system, with selisih.",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_stockist_head_confirmations",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, stock_item_id: f("stock_item_id"), is_match: f("is_match", "bool") },
    orderBy: '"date" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_kas_pockets",
    description: "Cash (rupiah) pocket list per PT.",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_kas_pockets",
    scope: "company_id",
    filters: { company_code: f("company_code"), is_active: f("is_active", "bool") },
    orderBy: '"company_name" ASC, "sort_order" ASC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_kas_daily",
    description: "Daily cash balance entries per kas pocket.",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_kas_daily",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, kas_pocket_id: f("kas_pocket_id") },
    orderBy: '"date" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_kas_balance_by_company",
    description: "Latest cash balance per pocket, summed per PT.",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_kas_balance_by_company",
    scope: "company_id",
    filters: { company_code: f("company_code") },
    orderBy: '"company_name" ASC',
    defaultLimit: 200,
    maxLimit: 1000,
  },
  {
    name: "get_kas_head_confirmations",
    description: "Kepala cabang re-counted cash total per date vs system, with selisih.",
    permission: [PERMISSIONS.STOCKIST_VIEW],
    view: "hv_kas_head_confirmations",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, is_match: f("is_match", "bool") },
    orderBy: '"date" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_finance_confirmed_daily",
    description: "Finance source of truth — kepala cabang confirmed stock+kas total per PT per day.",
    permission: [PERMISSIONS.STOCKIST_VIEW, PERMISSIONS.BANK_VIEW],
    view: "hv_finance_confirmed_daily",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, is_fully_reconciled: f("is_fully_reconciled", "bool") },
    orderBy: '"date" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  {
    name: "get_stock_daily",
    description: "Legacy per-branch daily stock entries (all asset types: valas, emas, perak, kas).",
    permission: [PERMISSIONS.STOCK_VIEW],
    view: "hv_stock_daily",
    scope: "company_id",
    filters: { ...PERIOD_FILTERS, branch_id: f("branch_id"), stock_item_id: f("stock_item_id"), stock_item_type: f("stock_item_type") },
    orderBy: '"date" DESC',
    defaultLimit: 500,
    maxLimit: 2000,
  },
];

function clampLimit(raw: unknown, def: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

function scopeColumn(tool: ReadTool): string | null {
  if (tool.scope === "none") return null;
  return tool.scope; // "company_id" | "id" | "company_code"
}

/**
 * Executes a read tool: applies PT scoping + whitelisted filters, returns rows.
 * Company-scoped keys are forced to their own PT; global keys see everything.
 */
export async function runReadTool(
  tool: ReadTool,
  args: Record<string, unknown>,
  caller: McpCaller
): Promise<unknown[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  // PT scope (skipped for global keys, which have companyId === null).
  const scopeCol = scopeColumn(tool);
  if (caller.companyId && scopeCol) {
    const value = scopeCol === "company_code" ? caller.companyCode : caller.companyId;
    if (value) {
      params.push(value);
      where.push(`"${scopeCol}" = $${params.length}`);
    }
  }

  // Whitelisted exact-match filters.
  for (const [arg, filter] of Object.entries(tool.filters)) {
    const v = args[arg];
    if (v === undefined || v === null || v === "") continue;
    let value: unknown = v;
    if (filter.type === "int") value = Number(v);
    else if (filter.type === "bool") value = v === true || v === "true";
    else value = String(v);
    params.push(value);
    where.push(`"${filter.column}" = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = clampLimit(args.limit, tool.defaultLimit, tool.maxLimit);
  const sql = `SELECT * FROM "${tool.view}" ${whereSql} ORDER BY ${tool.orderBy} LIMIT ${limit}`;

  return prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);
}

/**
 * `run_read_query` escape hatch — an ad-hoc read-only SELECT restricted to
 * `hv_*` views. Only offered to GLOBAL keys (companyId === null): PT-scoped keys
 * must use the structured tools above, which enforce company scoping (raw SQL
 * can't be reliably scoped and could leak across PTs).
 */
const FORBIDDEN_SQL = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|merge|call|do|vacuum|analyze)\b/i;

export async function runReadQuery(sqlRaw: string): Promise<unknown[]> {
  const sql = sqlRaw.trim().replace(/;+\s*$/, "");
  const lower = sql.toLowerCase();

  if (!lower.startsWith("select") && !lower.startsWith("with")) {
    throw new Error("Only SELECT queries are allowed");
  }
  if (sql.includes(";")) throw new Error("Multiple statements are not allowed");
  if (FORBIDDEN_SQL.test(sql)) throw new Error("Only read-only SELECT is allowed");

  // Every table referenced after FROM/JOIN must be an hv_ view.
  const refs = [...sql.matchAll(/\b(?:from|join)\s+"?([a-zA-Z_][a-zA-Z0-9_.]*)"?/gi)];
  for (const m of refs) {
    const name = (m[1] ?? "").replace(/^public\./i, "").toLowerCase();
    if (!name.startsWith("hv_")) {
      throw new Error(`Query may only reference hv_* views (got "${m[1]}")`);
    }
  }

  return prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
}
