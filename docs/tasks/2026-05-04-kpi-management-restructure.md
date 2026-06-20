# Task: KPI Management Restructure

- **Date**: 2026-05-04
- **Status**: ✅ Completed
- **Source**: User request — split KPI tabs into separate pages, rename sidebar to KPI Management

---

## 🎯 Goal

Restructure the KPI module from a single tabbed page into **4 separate pages**, each accessible from the sidebar under a "KPI Management" section. The overview page becomes a simple Konfigurasi view (Company tabs → Role cards only, no tabs wrapper).

### Final URL Structure
| URL | Page |
|-----|------|
| `/dashboard/kpi` | Konfigurasi KPI — Company tabs + Role cards |
| `/dashboard/kpi/definitions` | Definisi KPI — CRUD for KpiDefinition |
| `/dashboard/kpi/log` | Log KPI — Activity log (events + revenue) |
| `/dashboard/kpi/calculate` | Hitung KPI — Monthly KPI calculation + results |
| `/dashboard/kpi/[companyId]/[roleName]` | Detail — per company/role KPI config (unchanged) |

---

## 📋 Implementation Checklist

### Phase 1: Research & Discovery ✅
- [x] **1.1** Read `kpi-page-client.tsx` — confirmed 4 tab functions: `KonfigurasiTab`, `DefinitionsTab`, `ActivityTab`, `ResultsTab`
- [x] **1.2** Read `app-sidebar.tsx` — `navKPI` is a flat array with 1 item: `{ title: "KPI", url: "/dashboard/kpi" }`
- [x] **1.3** Read `nav-main.tsx` — NavMain only supports flat items (no sub-items); will use group label "KPI Management" with 4 flat items
- [x] **1.4** Confirmed existing API routes: `/api/kpi-definitions`, `/api/kpi-logs`, `/api/kpi-monthly-results`, `/api/revenues`
- [x] **1.5** Confirmed existing kpi route files: only `page.tsx` and `[companyId]/[roleName]/page.tsx` exist

---

### Phase 2: Create Separate Client Components

- [ ] **2.1** Create `components/admin/kpi/definitions-page-client.tsx`
  - Extract the full `DefinitionsTab` function body from `kpi-page-client.tsx`
  - Props: `{ definitions: KpiDefinitionRow[] }`
  - Imports: `KpiDefinitionSheet`, `KpiDefinitionRow`, `KPI_TYPE_LABELS` from `../kpi-definition-sheet`
  - _Definition of Done_: File compiles, exports `DefinitionsPageClient`

- [ ] **2.2** Create `components/admin/kpi/log-page-client.tsx`
  - Extract the full `ActivityTab` function body from `kpi-page-client.tsx`
  - Props: `{ users: UserRow[], definitions: KpiDefinitionRow[], roleKpis: RoleKpiRow[] }`
  - Imports: `UserRow`, `RoleKpiRow`, `ROLE_LABELS` from `../role-kpi-sheet`; `KpiDefinitionRow`, `KPI_TYPE_LABELS` from `../kpi-definition-sheet`
  - _Definition of Done_: File compiles, exports `LogPageClient`

- [ ] **2.3** Create `components/admin/kpi/calculate-page-client.tsx`
  - Extract the full `ResultsTab` function body from `kpi-page-client.tsx`
  - Props: `{ users: UserRow[] }`
  - Imports: `UserRow` from `../role-kpi-sheet` (via kpi-page-client export or direct)
  - _Definition of Done_: File compiles, exports `CalculatePageClient`

---

### Phase 3: Create Server Pages

- [ ] **3.1** Create `app/[locale]/(dashboard)/dashboard/kpi/definitions/page.tsx`
  - Fetches: `prisma.kpiDefinition.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }], include: { _count: { select: { roleKpis: true, logs: true } } } })`
  - Serializes definitions map
  - Renders page header + `<DefinitionsPageClient>`
  - Page title: "Definisi KPI" / subtitle: "Daftarkan nama KPI dan tipenya. Setiap KPI dapat dipakai oleh banyak jabatan."
  - _Definition of Done_: `npm run build` passes, page loads

- [ ] **3.2** Create `app/[locale]/(dashboard)/dashboard/kpi/log/page.tsx`
  - Fetches: `users` (where role not null, include branch), `definitions` (findMany), `roleKpis` (findMany with definition select, NO companyId filter)
  - Serializes roleKpis (Decimal → string)
  - Renders page header + `<LogPageClient>`
  - Page title: "Log KPI" / subtitle: "Catat pelanggaran event dan revenue karyawan per periode."
  - _Definition of Done_: Page loads, employee dropdown populated

- [ ] **3.3** Create `app/[locale]/(dashboard)/dashboard/kpi/calculate/page.tsx`
  - Fetches: `users` (where role not null, include branch)
  - Serializes users
  - Renders page header + `<CalculatePageClient>`
  - Page title: "Hitung KPI" / subtitle: "Hitung skor KPI bulanan karyawan dan lihat hasil grading."
  - _Definition of Done_: Page loads, employee dropdown populated, calculate button works

---

### Phase 4: Simplify Overview Page

- [ ] **4.1** Update `components/admin/kpi-page-client.tsx`
  - Remove the outer `<Tabs>` wrapper entirely
  - Remove `DefinitionsTab`, `ActivityTab`, `ResultsTab` functions (they now live in separate files)
  - Remove unused imports: `useState`, `useMemo`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Input`, `Label`, `KpiDefinitionSheet`, `KPI_TYPE_LABELS`
  - `KpiPageClient` props: only `{ companies: CompanyRow[], roleKpiSummary: RoleKpiSummaryRow[] }`
  - `KpiPageClient` body: just render `<KonfigurasiTab companies={companies} roleKpiSummary={roleKpiSummary} />`
  - Keep exports: `CompanyRow`, `RoleKpiSummaryRow`, `KpiDefinitionRow`, `RoleKpiRow`, `UserRow` (for page.tsx imports)
  - _Definition of Done_: No unused imports, component renders KonfigurasiTab only

- [ ] **4.2** Update `app/[locale]/(dashboard)/dashboard/kpi/page.tsx`
  - Remove fetching of `definitions`, `roleKpis`, `users` (no longer needed by overview page)
  - Only fetch: `companies`, `roleKpisRaw` (for summary computation)
  - Pass only `companies` and `roleKpiSummary` to `KpiPageClient`
  - _Definition of Done_: Page loads faster, no unused data fetched

---

### Phase 5: Sidebar Update

- [ ] **5.1** Update `components/app-sidebar.tsx`
  - Add icons: `IconListDetails` (already imported), `IconReport`, `IconChartBar` (already imported)
  - Replace `navKPI` array with 4 items:
    ```ts
    { title: "Konfigurasi", url: "/dashboard/kpi", icon: IconTargetArrow },
    { title: "Definisi KPI", url: "/dashboard/kpi/definitions", icon: IconListDetails },
    { title: "Log KPI", url: "/dashboard/kpi/log", icon: IconReport },
    { title: "Hitung KPI", url: "/dashboard/kpi/calculate", icon: IconChartBar },
    ```
  - Update NavMain call: `label="KPI Management"`
  - _Definition of Done_: Sidebar shows 4 KPI items under "KPI Management" label

---

### Phase 6: Verification

- [ ] **6.1** TypeScript check — no errors in new/modified files
- [ ] **6.2** Sidebar shows "KPI Management" section with 4 items, correct active states
- [ ] **6.3** `/dashboard/kpi` — shows company tabs + role cards (no outer tabs)
- [ ] **6.4** `/dashboard/kpi/definitions` — loads definition list, Add/Edit/Delete work
- [ ] **6.5** `/dashboard/kpi/log` — employee selector loads, log entries and revenue CRUD work
- [ ] **6.6** `/dashboard/kpi/calculate` — employee selector loads, calculate button returns result with grade
- [ ] **6.7** `/dashboard/kpi/[companyId]/[roleName]` — detail page unaffected

---

## 🛠️ Technical Details

### New Files
| File | Purpose |
|------|---------|
| `components/admin/kpi/definitions-page-client.tsx` | Definitions CRUD client (extracted from kpi-page-client) |
| `components/admin/kpi/log-page-client.tsx` | Log & Revenue client (extracted from kpi-page-client) |
| `components/admin/kpi/calculate-page-client.tsx` | Monthly KPI calculation client (extracted from kpi-page-client) |
| `app/[locale]/(dashboard)/dashboard/kpi/definitions/page.tsx` | Server page for Definitions |
| `app/[locale]/(dashboard)/dashboard/kpi/log/page.tsx` | Server page for Log KPI |
| `app/[locale]/(dashboard)/dashboard/kpi/calculate/page.tsx` | Server page for Hitung KPI |

### Modified Files
| File | Change |
|------|--------|
| `components/admin/kpi-page-client.tsx` | Remove tabs + 3 tab functions, simplify props |
| `app/[locale]/(dashboard)/dashboard/kpi/page.tsx` | Remove unused data fetches |
| `components/app-sidebar.tsx` | Expand navKPI to 4 items, rename label |

### Key Type Sources
- `KpiDefinitionRow`, `KPI_TYPE_LABELS` → `components/admin/kpi-definition-sheet.tsx`
- `RoleKpiRow`, `ROLE_LABELS` → `components/admin/role-kpi-sheet.tsx`
- `UserRow`, `CompanyRow`, `RoleKpiSummaryRow` → exported from `kpi-page-client.tsx`

---

## 📝 Notes & Discoveries

- `ActivityTab` needs `roleKpis` from `role-kpi-sheet.tsx`'s `RoleKpiRow` type (not the summary type) — it filters by `roleName` and `definition.type`
- `ResultsTab` only needs `users` — it calls `/api/kpi-monthly-results` with POST
- The `MONTH_NAMES` and `getGrade` helpers can be kept local to each client file (copy-paste), or moved to a shared utils — for now keep local (simpler)
- NavMain active-state logic: `normalizedPathname.startsWith(item.url + "/")` — `/dashboard/kpi` will be active on all KPI sub-pages; individual items will activate correctly since each has a unique URL
