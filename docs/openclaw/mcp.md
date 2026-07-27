# PVI MCP Layer — Agent Access & Operation

**Pusat Kirim Duit Management System**

The **MCP (Model Context Protocol) server** exposes PVI tools and data to AI agents
(Zemetia / Hermes) through a single typed, permissioned surface. It is the operational
layer on top of the read-only [Hermes Views](./schema.md): where the views let an agent
*read* PVI via raw SQL, the MCP layer lets an agent *read and operate* PVI via tools —
with the **same role-based permissions and PT scoping as a human user**.

Built on the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`) via Vercel's
`mcp-handler` adapter — no hand-rolled protocol.

---

## Endpoint

| | |
|---|---|
| Transport | Streamable HTTP (MCP spec 2025-06-18) |
| URL | `POST /api/mcp` |
| Auth | `Authorization: Bearer <MCP_OWNER_KEY>` (required) |
| Route | [`src/app/api/[transport]/route.ts`](../../src/app/api/%5Btransport%5D/route.ts) — `mcp-handler` with `basePath: "/api"` |

A minimal client config:

```json
{
  "mcpServers": {
    "pvi": {
      "url": "https://app.zemetia.com/api/mcp",
      "headers": { "Authorization": "Bearer mcp_xxxxxxxx..." }
    }
  }
}
```

---

## Access model — one owner key (env var)

Today the MCP is for the **owner / super-admin only**, so there is no key table and no
migration. The key is a single env var:

```
MCP_OWNER_KEY=mcp_xxxxxxxxxxxxxxxx
```

- A request whose bearer token matches `MCP_OWNER_KEY` acts as **Owner** — `companyId =
  null` (unscoped, every PT) with the full permission set (`getPermissionsForRole("OWNER")`).
- If `MCP_OWNER_KEY` is unset, every request → 401 (the endpoint is effectively off).
- The token is compared in constant time; nothing is stored in the DB.

Generate a key:

```bash
node -e "console.log('mcp_'+require('crypto').randomBytes(24).toString('hex'))"
```

### Future: per-Role-PT keys (kepala cabang)

When kepala-cabang access is needed, the natural extension is a single `mcpKeyHash` column
on the existing `custom_role` table (which already encodes role name + PT + `permissions[]`).
`verifyMcpToken` would then look the token up there and build the caller from that role
instead of the fixed owner caller — the read/operate tools and their scoping need no change,
because they already key off `caller.companyId` + `caller.permissions`.

---

## Architecture

```
Agent ──POST /api/mcp (Bearer key)──▶ mcp-handler (Streamable HTTP, MCP SDK)
                                            │
                              withMcpAuth → verifyMcpToken(key)
                                            │  matches MCP_OWNER_KEY → owner McpCaller
                                            │  (companyId = null, all permissions)
                                            ▼
                                   registerAllTools(server)
                          ┌─────────────────┼───────────────────┐
                     READ tools        run_read_query       OPERATE tools
                          │             (global only)            │
                   hv_* views ◀──────── SELECT-only ───▶  src/backend/services/*
                (PT-scoped SQL)                          (validation + RBAC)
```

- **`verifyMcpToken`** ([auth.ts](../../src/backend/mcp/auth.ts)) compares the bearer token
  to `MCP_OWNER_KEY` and, on match, builds the owner `McpCaller` — structurally the app's
  `AdminCaller`, so it plugs straight into the existing services and permission helpers. It
  rides in `authInfo.extra.caller`.
- **`registerAllTools`** ([register.ts](../../src/backend/mcp/register.ts)) registers every
  tool once. Each handler reads the caller from `authInfo`, checks the tool's permission
  (`canAny`), then runs. Registration is static, so `tools/list` shows all tools; a key
  lacking a permission gets a clear *forbidden* error on call (data stays protected).
- **READ tools** ([read-tools.ts](../../src/backend/mcp/read-tools.ts)) back onto the
  `hv_*` views. PT scoping is forced into the `WHERE` clause; filters are a per-tool column
  whitelist bound as parameters (injection-safe).
- **OPERATE tools** ([operate-tools.ts](../../src/backend/mcp/operate-tools.ts)) call the
  existing `src/backend/services/*` — never raw SQL — inheriting the same validation and
  scope guards as the web UI.

The permission column below is the gate each tool checks against the caller. With today's
**owner key** the caller holds every permission and is unscoped, so all tools are available;
the gates matter for the future per-Role-PT keys.

---

## Tool catalog

### Read tools (over `hv_*` views)

Each gated by the matching web permission; PT-scoped automatically. Common args: `year`,
`month`, `period_label`, `company_code`, `limit`, plus per-tool ids/types.

| Tool | View | Permission |
|---|---|---|
| `get_companies` | `hv_companies` | any key |
| `get_branches` | `hv_branches` | any key |
| `get_employees` | `hv_employees` | `users.view` |
| `get_attendance` / `get_attendance_monthly` | `hv_attendance*` | `attendance.view_all` |
| `get_kpi_monthly` / `get_kpi_logs` / `get_kpi_definitions` | `hv_kpi_*` | `kpi.view_all` |
| `get_bonus_tiers` | `hv_bonus_tiers` | `kpi.view_all` |
| `get_payroll_monthly` | `hv_payroll_monthly` | `payroll.view_all` / `payroll.view_company` |
| `get_revenue_monthly` | `hv_revenue_monthly` | payroll / `kpi.view_all` |
| `get_bank_accounts` / `get_bank_balance_by_company` / `get_bank_daily` / `get_bank_mutations` | `hv_bank_*` | `bank.view` |
| `get_currency_stock` / `get_currency_stock_by_company` | `hv_currency_stock*` | `stock.view` / `currency.view` |
| `get_company_stock_items` | `hv_company_stock_items` | `company_stock.view` / `stockist.view` |
| `get_stockist_pockets` / `get_stockist_balances` / `get_stockist_stock_by_company` | `hv_stockist_*` | `stockist.view` |
| `get_stockist_mutations` / `get_stockist_daily_checks` / `get_stockist_head_confirmations` | `hv_stockist_*` | `stockist.view` |
| `get_kas_pockets` / `get_kas_daily` / `get_kas_balance_by_company` / `get_kas_head_confirmations` | `hv_kas_*` | `stockist.view` |
| `get_finance_confirmed_daily` | `hv_finance_confirmed_daily` | `stockist.view` / `bank.view` |
| `get_stock_daily` | `hv_stock_daily` (legacy) | `stock.view` |
| `run_read_query` | any `hv_*` | **global keys only** — ad-hoc read-only SELECT |

### Operate tools (through the service layer)

| Tool | Service | Permission |
|---|---|---|
| `get_price_benchmark` | price-benchmark (Patokan Harga list, global, optional `code` filter) | `currency.view` |
| `set_price_benchmark` | price-benchmark (upsert sell/buy adjustment rule for one currency) | `currency.manage` |
| `update_currency_rate` | currency-stock (updates buy/sell rate; branch-scope checked) | `currency.manage` |
| `create_bank_mutation` | bank-mutation (CREDIT/DEBIT + balance update; PT-scoped) | `bank.manage` |
| `confirm_stockist_head` | stockist head-confirmation (kepala cabang re-count per item) | `stockist.verify` |
| `confirm_kas_head` | kas head-confirmation (kepala cabang cash re-count) | `stockist.verify` |
| `record_stockist_mutation` | stockist (TOP_UP / WITHDRAWAL / ADJUSTMENT / OPENING, or TRANSFER_OUT to another pocket; updates balance) | `stockist.manage` |
| `record_kas_entry` | kas daily entry (upsert a pocket's cash balance for a date) | `stockist.manage` |
| `fill_stockist_daily_check` | stockist opname (today's physical count per pocket/item) | `stockist.manage` |

Every operate tool is a thin wrapper over an existing service, so it inherits that
service's validation and scope guards (e.g. `assertCompanyAccess`, today-only opname,
default-pocket protection).

---

## Safety guarantees

1. **Scope is hard.** A PT-scoped key can never read or write another PT — enforced in
   SQL `WHERE` (reads) and via service scope guards (writes).
2. **No raw writes.** Operate tools go through services only. `run_read_query` is
   `SELECT`-only, restricted to `hv_*`, single statement, and offered to **global keys
   only** (arbitrary SQL can't be safely PT-scoped).
3. **Permission per call.** Every tool checks the key's permission (from the role) before
   running; a lacking permission returns a *forbidden* result.
4. **Auth-sensitive data is unreachable.** Reads only touch `hv_*` views, which never
   expose passwords, sessions, or tokens.
5. **One secret, no DB.** The only credential is `MCP_OWNER_KEY` (compared in constant
   time, never stored). Rotate it by changing the env var; unset it to disable the endpoint.

---

## Setup / deploy

No migration — the endpoint is env-var gated only:

1. **Set the key** — add `MCP_OWNER_KEY` to the environment (see [.env.example](../../.env.example)):
   ```bash
   node -e "console.log('mcp_'+require('crypto').randomBytes(24).toString('hex'))"
   ```
2. Point the agent at `POST /api/mcp` with `Authorization: Bearer <that key>`.

---

## Related

- [schema.md](./schema.md) — the `hv_*` views every read tool backs onto (column reference)
- [credentials.md](./credentials.md) — the read-only `oc_pvi_reader` DB account (raw-SQL path)
