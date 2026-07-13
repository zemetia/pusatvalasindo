# Hermes Views — Database Schema Reference
**Pusat Kirim Duit Management System**

You have **read-only** access to a PostgreSQL database via the user `oc_pvi_reader`.  
You can only run `SELECT` queries. All accessible data is exposed through 28 views prefixed with `hv_`.  
Auth-sensitive data (passwords, session tokens, verification codes) is **never** exposed through any view.

---

## Available Views

| View | Description |
|------|-------------|
| `hv_companies` | All PT companies with branch & employee counts |
| `hv_branches` | All branches with company name and headcount |
| `hv_employees` | All employees with salary breakdown, role, and `context_summary` |
| `hv_attendance` | Daily attendance records with computed `work_hours` and status labels |
| `hv_attendance_monthly` | Monthly attendance summary (present/late/absent/etc.) per employee |
| `hv_kpi_definitions` | KPI definitions per role per company with weights and `weight_pct` |
| `hv_kpi_logs` | Individual KPI log entries per employee |
| `hv_kpi_monthly` | Monthly KPI results — score, grade (A/B/C/D), bonus, and `context_summary` |
| `hv_revenue` | Daily revenue entries per employee |
| `hv_revenue_monthly` | Monthly revenue summary (total, avg, max, min) per employee |
| `hv_payroll_monthly` | Full payroll estimate — salary + deductions + KPI + `context_summary` |
| `hv_bank_accounts` | Bank accounts with current balance per branch |
| `hv_bank_balance_by_company` | Total bank balance grouped by company and currency |
| `hv_bank_daily` | Daily bank balance snapshots |
| `hv_bank_mutations` | All bank CREDIT/DEBIT transactions |
| `hv_currency_stock` | Current foreign-currency stock per branch with IDR value estimates |
| `hv_currency_stock_by_company` | Currency stock totals with potential gross profit per company |
| `hv_stock_daily` | Daily stock entry records — legacy per-branch module (all asset types: valas, emas, perak, kas) |
| `hv_bonus_tiers` | Bonus matrix tier rules per company and role |
| `hv_company_stock_items` | Stockist stock item catalog (mata uang / logam mulia) per PT |
| `hv_stockist_pockets` | Stockist pocket list per PT (Kas Kecil, Finance Blue, Kurir A, dst), incl. auto "Total" pocket |
| `hv_stockist_balances` | Current stockist balance matrix (pocket × stock item); Total pocket never appears here |
| `hv_stockist_stock_by_company` | Stockist stock totals per PT per item — SQL equivalent of the app's on-the-fly "Total" pocket |
| `hv_stockist_mutations` | Stockist pocket mutation history (top up, withdrawal, transfer, adjustment) |
| `hv_stockist_daily_checks` | Daily opname (physical stock check) status per pocket per item |
| `hv_kas_pockets` | Cash (rupiah) pocket list per PT |
| `hv_kas_daily` | Daily cash balance entries per kas pocket |
| `hv_kas_balance_by_company` | Latest cash balance per pocket, summed per PT |

---

## AI-Ready Design Notes

Every view is designed to be LLM-friendly:

- **Enum columns** always have a companion `_label` column in Bahasa Indonesia  
  (e.g., `status` + `status_label`, `mutation_type` + `mutation_type_label`)
- **`period_label`** column on all time-series views — format `YYYY-MM` (e.g., `'2026-06'`)
- **`context_summary`** pre-formatted text on key views (`hv_employees`, `hv_kpi_monthly`, `hv_payroll_monthly`, `hv_bonus_tiers`) — useful for RAG embeddings
- **`COALESCE`** applied to all nullable text/numeric — no unexpected NULLs in output
- All monetary values are in **IDR** unless a `currency_code` column is present
- **`year`** and **`month`** as integers on all time-series views for easy filtering

---

## View Column Reference

### `hv_companies`
```
id, company_name, company_code, is_active, status_label,
active_branch_count, total_branch_count,
active_employee_count, total_employee_count, created_at
```

### `hv_branches`
```
id, branch_name, address, phone, is_active, status_label,
company_id, company_name, company_code,
active_employee_count, total_employee_count, created_at
```

### `hv_employees`
```
id, name, email, phone, is_active, status_label, join_date,
base_salary, meal_allowance, transport_allowance, total_fixed_salary, daily_rate,
branch_id, branch_name, company_id, company_name, company_code,
role_id, role_name, context_summary, created_at
```

### `hv_attendance`
```
id, user_id, employee_name, company_name, company_code, branch_name, role_name,
date, year, month, period_label,
check_in, check_out, work_hours (decimal, hours),
status (PRESENT|LATE|ABSENT|PERMISSION|SICK|HOLIDAY), status_label,
is_location_suspect, is_with_doctor_note, notes, created_at
```

### `hv_attendance_monthly`
```
user_id, employee_name, company_id, company_name, company_code,
branch_id, branch_name, role_name, year, month, period_label,
present_days, late_days, absent_days,
sick_days_with_note, sick_days_no_note, sick_days_total,
permission_days, holiday_days, total_recorded_days, suspect_location_days,
total_work_hours, avg_work_hours_per_day
```

### `hv_kpi_definitions`
```
id, kpi_id, kpi_name, kpi_type (EVENT|TARGET), kpi_type_label,
company_id, company_name, company_code, role_id, role_name,
max_score, target_value, threshold, weight, weight_pct, created_at
```

### `hv_kpi_logs`
```
id, employee_id, employee_name, company_id, company_name, company_code,
branch_name, role_name, kpi_id, kpi_name, kpi_type, kpi_type_label,
value, note, created_at, year, month, period_label
```

### `hv_kpi_monthly`
```
id, employee_id, employee_name, company_id, company_name, company_code,
branch_id, branch_name, role_name, month, year, period_label,
total_score, grade (A|B|C|D), grade_label,
bonus_amount, bonus_result, bonus_result_label,
breakdown_json, calculated_at, context_summary
```
> Grade scale: A ≥ 90, B ≥ 75, C ≥ 60, D < 60

### `hv_revenue`
```
id, employee_id, employee_name, company_id, company_name, company_code,
branch_id, branch_name, role_name,
amount, date, year, month, period_label, note, created_at
```

### `hv_revenue_monthly`
```
employee_id, employee_name, company_id, company_name, company_code,
branch_id, branch_name, role_name, year, month, period_label,
transaction_count, total_revenue, avg_revenue_per_entry,
max_single_entry, min_single_entry
```

### `hv_payroll_monthly`
**Payroll formula:**
- `daily_rate = total_fixed_salary / 24`
- `absence_deduction = (absent×2 + sick×1 + permission×1) × daily_rate`
- `late_deduction = 0` *(requires per-minute data — not yet stored in DB)*
- `kpi_net_effect = +bonus` for BONUS_CASH/TOP_PERFORMER, `-penalty` for PENALTY_DEDUCTION/PENALTY_SATURDAY
- `estimated_take_home = total_fixed_salary − absence_deduction + kpi_net_effect`

```
employee_id, employee_name, company_id, company_name, company_code,
branch_id, branch_name, role_name, month, year, period_label,
base_salary, meal_allowance, transport_allowance, total_gross_fixed, daily_rate,
present_days, late_days, absent_days, sick_days, permission_days, holiday_days,
suspect_location_days,
late_deduction, absence_deduction, total_deductions,
kpi_score, kpi_bonus, kpi_bonus_type, kpi_bonus_type_label, kpi_net_effect,
estimated_take_home_pay, context_summary
```
> `kpi_bonus_type` values: `BONUS_CASH`, `SAFE_ZONE`, `PENALTY_SATURDAY`, `PENALTY_DEDUCTION`, `TOP_PERFORMER`

### `hv_bank_accounts`
> Bank accounts are scoped per PT (Company), not per branch — a bank account is shared
> across all branches under the same company.
```
id, bank_name, account_number, account_name, current_balance,
is_active, status_label, note, sort_order,
company_id, company_name, company_code,
currency_code, currency_name, currency_symbol, created_at, updated_at
```

### `hv_bank_balance_by_company`
```
company_id, company_name, company_code,
currency_code, currency_symbol, currency_name,
active_account_count, total_account_count,
total_active_balance, total_balance
```

### `hv_bank_daily`
```
id, bank_account_id, bank_name, account_name,
company_id, company_name, company_code,
currency_code, currency_symbol,
date, year, month, period_label,
balance, tarik_cek, note, created_by, created_at
```

### `hv_bank_mutations`
```
id, bank_account_id, bank_name, account_name,
company_id, company_name, company_code,
currency_code, currency_symbol,
mutation_type (CREDIT|DEBIT), mutation_type_label,
amount, balance_after, description, created_by, created_at,
year, month, period_label
```

### `hv_currency_stock`
```
id, branch_id, branch_name, company_id, company_name, company_code,
currency_id, currency_code, currency_name, currency_symbol,
quantity, buy_rate, sell_rate,
idr_value_at_buy_rate, idr_value_at_sell_rate, idr_value_at_mid_rate,
spread_per_unit, updated_at
```

### `hv_currency_stock_by_company`
```
company_id, company_name, company_code,
currency_code, currency_name, currency_symbol,
branch_count, total_quantity,
avg_buy_rate, avg_sell_rate,
total_idr_at_buy_rate, total_idr_at_sell_rate,
potential_gross_profit_idr
```

### `hv_stock_daily`
```
id, stock_item_id, stock_item_name, stock_item_code,
stock_item_type (CURRENCY|GOLD|SILVER|CASH), stock_item_type_label,
branch_id, branch_name, company_id, company_name, company_code,
date, year, month, period_label,
closing_qty, rate_idr, total_idr, qty1, qty2,
note, created_by, created_at
```

### `hv_bonus_tiers`
```
matrix_id, company_id, company_name, company_code,
role_id, role_name, tier_id,
min_score, max_score, result_type, result_type_label,
amount, is_top_performer, tier_description
```

### `hv_company_stock_items`
```
id, company_id, company_name, company_code,
item_name, item_code, item_type (CURRENCY|LOGAM_MULIA), item_type_label,
sort_order, is_active, status_label, created_at
```

### `hv_stockist_pockets`
> Pockets are scoped per PT, shared across all branches. `is_total_pocket = true` marks
> the auto-computed "Total" pocket, which is never manually mutated (see
> `hv_stockist_stock_by_company` for its SQL equivalent).
```
id, company_id, company_name, company_code,
pocket_name, pocket_code, is_total_pocket, is_active, status_label,
sort_order, created_at
```

### `hv_stockist_balances`
> Current balance matrix — one row per (pocket, stock item). The "Total" pocket is
> computed on the fly by the app and never persisted, so it never appears here.
```
id, pocket_id, pocket_name, company_id, company_name, company_code,
stock_item_id, stock_item_name, stock_item_type, stock_item_type_label,
quantity, updated_at
```

### `hv_stockist_stock_by_company`
```
company_id, company_name, company_code,
stock_item_id, stock_item_name, stock_item_type, stock_item_type_label,
pocket_count, total_quantity
```

### `hv_stockist_mutations`
```
id, pocket_id, pocket_name, company_id, company_name, company_code,
stock_item_id, stock_item_name, stock_item_type,
mutation_type (OPENING|TOP_UP|WITHDRAWAL|TRANSFER_IN|TRANSFER_OUT|ADJUSTMENT), mutation_type_label,
quantity, balance_after, note, created_by, created_at,
year, month, period_label
```

### `hv_stockist_daily_checks`
```
id, pocket_id, pocket_name, company_id, company_name, company_code,
stock_item_id, stock_item_name,
date, year, month, period_label,
status (BELUM_REVIEW|BEDA|BENAR), status_label,
entered_quantity, filled_at, filled_by, note, reviewed_by, reviewed_at, created_at
```

### `hv_kas_pockets`
```
id, company_id, company_name, company_code,
pocket_name, pocket_code, is_active, status_label, sort_order, created_at
```

### `hv_kas_daily`
```
id, kas_pocket_id, pocket_name, company_id, company_name, company_code,
date, year, month, period_label,
balance, note, created_by, created_at
```

### `hv_kas_balance_by_company`
```
company_id, company_name, company_code,
active_pocket_count, total_pocket_count, total_balance, as_of_date
```

---

## Common Query Patterns

### Berapa uang di bank tiap PT saat ini?
```sql
SELECT company_name, currency_code, currency_symbol,
       active_account_count, total_active_balance
FROM hv_bank_balance_by_company
ORDER BY company_name, currency_code;
```

### Estimasi gaji bersih semua karyawan bulan ini?
```sql
SELECT employee_name, company_name, branch_name, role_name,
       total_gross_fixed, total_deductions, kpi_bonus, estimated_take_home_pay
FROM hv_payroll_monthly
WHERE year = 2026 AND month = 6
ORDER BY company_name, estimated_take_home_pay DESC;
```

### Skor KPI semua karyawan bulan ini?
```sql
SELECT employee_name, company_name, role_name,
       total_score, grade, grade_label, bonus_amount, bonus_result_label
FROM hv_kpi_monthly
WHERE year = 2026 AND month = 6
ORDER BY total_score DESC;
```

### Berapa kali karyawan terlambat bulan ini?
```sql
SELECT employee_name, company_name, branch_name,
       late_days, absent_days, present_days, suspect_location_days
FROM hv_attendance_monthly
WHERE year = 2026 AND month = 6
ORDER BY late_days DESC;
```

### Stok USD tiap PT saat ini?
```sql
SELECT company_name, currency_code, total_quantity,
       avg_buy_rate, avg_sell_rate, total_idr_at_buy_rate,
       potential_gross_profit_idr
FROM hv_currency_stock_by_company
WHERE currency_code = 'USD'
ORDER BY company_name;
```

### Semua karyawan aktif dan gaji mereka?
```sql
SELECT name, company_name, branch_name, role_name,
       base_salary, meal_allowance, transport_allowance,
       total_fixed_salary, daily_rate
FROM hv_employees
WHERE is_active = true
ORDER BY company_name, total_fixed_salary DESC;
```

### Transaksi bank PT tertentu minggu ini?
```sql
SELECT bank_name, account_name, mutation_type_label,
       amount, balance_after, description, created_at
FROM hv_bank_mutations
WHERE company_name = 'Nama PT'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Berapa kas & stockist tiap PT saat ini?
```sql
SELECT company_name, total_pocket_count, active_pocket_count, total_balance, as_of_date
FROM hv_kas_balance_by_company
ORDER BY company_name;

SELECT company_name, stock_item_name, stock_item_type_label,
       pocket_count, total_quantity
FROM hv_stockist_stock_by_company
ORDER BY company_name, stock_item_name;
```

### Opname stockist yang belum direview hari ini?
```sql
SELECT company_name, pocket_name, stock_item_name,
       entered_quantity, filled_by, filled_at
FROM hv_stockist_daily_checks
WHERE status = 'BELUM_REVIEW' AND date = CURRENT_DATE
ORDER BY company_name, pocket_name;
```

### Context summary untuk AI — karyawan dengan payroll bulan ini?
```sql
SELECT context_summary
FROM hv_payroll_monthly
WHERE year = 2026 AND month = 6
ORDER BY company_name, employee_name;
```

---

## Notes for Query Writing

- **Filter by company:** use `company_name` or `company_code` (e.g., `'PVI'`, `'PKD'`)
- **Filter by period:** use integer columns `year` and `month` (e.g., `year = 2026 AND month = 6`), or `period_label = '2026-06'`
- **Payroll view** only shows rows where the employee has at least one attendance record that month
- **Currency codes** follow ISO 4217 (`'USD'`, `'SGD'`, `'MYR'`, etc.)
- **All monetary values in IDR** unless a `currency_code` column is present (bank accounts can hold foreign currency balances)
- **Attendance status values:** `PRESENT`, `LATE`, `ABSENT`, `PERMISSION`, `SICK`, `HOLIDAY`
- **Bank mutation types:** `CREDIT` (masuk), `DEBIT` (keluar)
- **KPI bonus types:** `BONUS_CASH`, `SAFE_ZONE`, `PENALTY_SATURDAY`, `PENALTY_DEDUCTION`, `TOP_PERFORMER`
- **`spread_per_unit`** in `hv_currency_stock` = sell_rate − buy_rate (profitability per unit)
- **`potential_gross_profit_idr`** in `hv_currency_stock_by_company` = total at sell − total at buy
- **Bank accounts and Stockist/Kas pockets are scoped per PT (`company_id`), not per branch** — a bank account or pocket is shared across all branches under the same company. None of `hv_bank_*`, `hv_stockist_*`, or `hv_kas_*` have a `branch_id`/`branch_name` column.
- **`hv_stock_daily`** is the legacy per-branch stock module (predates Stockist/Kas); for current PT-level stock and cash, prefer `hv_stockist_*` and `hv_kas_*` views.
- **`is_total_pocket = true`** in `hv_stockist_pockets` marks the app's auto-computed "Total" row — it never has balances or mutations of its own; use `hv_stockist_stock_by_company` for the aggregate instead.
- **Stockist mutation types:** `OPENING`, `TOP_UP`, `WITHDRAWAL`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`
- **Stockist daily-check status:** `BELUM_REVIEW` (belum direview), `BEDA` (selisih), `BENAR` (cocok)
