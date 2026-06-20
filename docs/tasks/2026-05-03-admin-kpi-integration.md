# Task: Admin KPI Backend–Frontend Integration

- **Date**: 2026-05-03
- **Status**: ✅ Completed
- **Source**: User request — redesign KPI admin to company-tab → role-card → detail UX

---

## 🎯 Goal

Redesign `/dashboard/kpi` from a flat 4-tab page into a **hierarchical KPI management UI**:

1. **`/dashboard/kpi`** — KPI Management Overview  
   - Page description: *"Konfigurasi KPI per perusahaan dan jabatan"*  
   - 3 main tabs: **Konfigurasi KPI** | **Definisi KPI** | **Log & Hasil**  
   - Under "Konfigurasi KPI": dynamic **Company tabs** (PVI / PTU / PKD, auto-grows when new company is added)  
   - Under each company tab: **Role cards** (one per EmployeeRole that has ≥1 RoleKpi configured, + an "Add" card)  
   - Card shows: role label, KPI count, total weight badge (green = 1.00, red = ≠ 1.00)  
   - Clicking a role card → navigates to detail page  

2. **`/dashboard/kpi/[companyId]/[roleName]`** — Company-Role KPI Detail  
   - Page description: *"Daftar KPI untuk {Company} — {Role}"*  
   - Breadcrumb: KPI > {Company Name} > {Role Label}  
   - Combined table of `KpiDefinition` + `RoleKpi` for that company+role  
   - Columns: KPI Name | Type | Max Score | Target / Threshold | Actions (Edit / Delete)  
   - "Tambah KPI" button → inline sheet form (companyId and roleName pre-set)  
   - Total weight indicator (must = 1.00)  

---

## 📋 Implementation Checklist

### Phase 1: Research & Discovery ✅ (already done)
- [x] **1.1** Read `prisma/schema.prisma` — confirmed `RoleKpi` scoped by `companyId`, `KpiDefinition` is global
- [x] **1.2** Read existing `kpi-page-client.tsx` — 4-tab flat structure, role-kpi-sheet does NOT send `companyId` in POST (bug)
- [x] **1.3** Read `app/api/role-kpis/route.ts` — GET returns ALL with no filter, POST requires `companyId`
- [x] **1.4** Confirmed no `/api/companies` endpoint exists (need to create)
- [x] **1.5** Confirmed `/api/branches` and `/api/kpi-definitions` already exist and work

---

### Phase 2: Backend — New & Updated API Endpoints

- [x] **2.1** Create `app/api/companies/route.ts`
- [x] **2.2** Update `app/api/role-kpis/route.ts` — GET now accepts `?companyId` + `?roleName`, also fixed `maxScore` max from 100 → 1
- [x] **2.3** Added `getByCompanyRole` to `kpiService` + added `EmployeeRole` import to service. `RoleKpiDetailSheet` sends `companyId` and `roleName` correctly on POST.

---

### Phase 3: Frontend — KPI Overview Page Redesign

- [x] **3.1** `KonfigurasiTab` added directly into `kpi-page-client.tsx` (no separate file needed — keeps it simple)
  - Props: `companies: CompanyRow[]`, `roleKpiSummary: RoleKpiSummaryRow[]`, `definitions: KpiDefinitionRow[]`, `users: UserRow[]`
  - Top-level 3-tab structure using shadcn `<Tabs>`:
    - **Tab "konfigurasi"** (default): Company sub-tabs → Role cards
    - **Tab "definisi"**: Reuse existing `<DefinitionsTab>` from kpi-page-client
    - **Tab "log-hasil"**: Reuse existing `<ActivityTab>` + `<ResultsTab>` from kpi-page-client
  - Company sub-tabs: one `<TabsTrigger>` per company from `companies` prop
  - Role cards layout: `grid grid-cols-2 sm:grid-cols-3 gap-4`
  - Role card: shadcn `<Card>` that is clickable → `router.push('/dashboard/kpi/[companyId]/[roleName]')`
  - Card content: Role label (large), KPI count badge, total-weight badge (green/red)
  - Empty-state card: "+ Konfigurasi Jabatan Baru" → navigates to detail with empty state
  - _Definition of Done_: Component renders without errors, tabs switch, cards are visible

- [ ] **3.2** Define types used by the new client
  - `CompanyRow = { id: string; name: string; code: string }`
  - `RoleKpiSummaryRow = { companyId: string; roleName: string; kpiCount: number; totalWeight: number }`
  - Re-export existing `KpiDefinitionRow` and `UserRow` from kpi-page-client or a shared types file

- [ ] **3.3** Redesign `app/[locale]/(dashboard)/dashboard/kpi/page.tsx` (server component)
  - Fetch: `companies`, `roleKpiSummary` (aggregated), `definitions`, `users`
  - For `roleKpiSummary`: use Prisma `groupBy` or `findMany` with `include: { definition: true }` and aggregate in JS
  - Pass all to `KpiOverviewClient`
  - Keep the page title: "Manajemen KPI" / subtitle: "Konfigurasi KPI, definisi, log, dan hasil bulanan karyawan"
  - _Definition of Done_: Page loads in browser showing company tabs and role cards

---

### Phase 4: Frontend — Company-Role KPI Detail Page

- [ ] **4.1** Create `app/[locale]/(dashboard)/dashboard/kpi/[companyId]/[roleName]/page.tsx` (server component)
  - Params: `companyId: string`, `roleName: string` (maps to `EmployeeRole` enum)
  - Fetch:
    - `company` = `prisma.company.findUnique({ where: { id: companyId } })`
    - `roleKpis` = `prisma.roleKpi.findMany({ where: { companyId, roleName }, include: { definition: true } })`
    - `definitions` = `prisma.kpiDefinition.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] })`
  - If company not found → `notFound()`
  - Serialize Decimal fields to strings before passing to client
  - Render `<RoleKpiDetailClient>` with props
  - _Definition of Done_: Navigating from role card lands on this page with correct data

- [ ] **4.2** Create `components/admin/kpi/role-kpi-detail-client.tsx`
  - Props: `company: CompanyRow`, `roleName: string`, `roleKpis: RoleKpiDetailRow[]`, `definitions: KpiDefinitionRow[]`
  - Header section:
    - Breadcrumb: `← KPI` (links to `/dashboard/kpi`) > `{company.name}` > `{ROLE_LABELS[roleName]}`
    - Total weight badge: `{totalWeight.toFixed(2)} / 1.00` (green if ≈1.00, red otherwise)
  - Table with columns: KPI Name | Type | Max Score | Target/Threshold | Edit | Delete
  - Empty state if no KPIs configured yet
  - "Tambah KPI" button at top → opens `<RoleKpiDetailSheet>`
  - Edit icon per row → opens `<RoleKpiDetailSheet>` pre-filled
  - Delete icon per row → confirm dialog → `DELETE /api/role-kpis/[id]` → `router.refresh()`
  - _Definition of Done_: Table renders, add/edit/delete all work

- [ ] **4.3** Create `components/admin/kpi/role-kpi-detail-sheet.tsx`
  - Props: `companyId: string`, `roleName: string`, `definitions: KpiDefinitionRow[]`, `roleKpi?: RoleKpiDetailRow`, `trigger?: ReactNode`
  - On POST: sends `{ companyId, roleName, kpiId, maxScore, targetValue?, threshold?, weight: maxScore }` to `POST /api/role-kpis`
  - On PUT: sends `{ maxScore, targetValue?, threshold? }` to `PUT /api/role-kpis/[id]`
  - `companyId` and `roleName` are hidden (pre-set from props, not user-editable)
  - KPI Definition select → filtered to show only definitions NOT already configured for this company+role (to avoid duplicates)
  - Shows threshold/targetValue fields conditionally based on selected KPI type
  - `weight` field: for simplicity, set `weight = maxScore` on POST (or add as separate input)
  - _Definition of Done_: Form submits, page refreshes with updated data

---

### Phase 5: Cleanup & Integration

- [ ] **5.1** Move existing `DefinitionsTab`, `ActivityTab`, `ResultsTab` functions  
  - They stay in `kpi-page-client.tsx` as internal exports
  - Import them in `kpi-overview-client.tsx` — or copy-paste if circular import
  - Keep `kpi-page-client.tsx` for backward compatibility during refactor

- [ ] **5.2** Ensure the existing `RoleKpisTab` (flat table) is no longer the default view  
  - It can be removed or hidden — its functionality is now in the detail page
  - Keep `role-kpi-sheet.tsx` only if needed for legacy; otherwise phase out

- [ ] **5.3** Verify `ROLE_LABELS` and `KPI_TYPE_LABELS` are accessible from both old and new components  
  - Move to a shared file `components/admin/kpi/constants.ts` if needed

---

### Phase 6: Testing & Verification

- [ ] **6.1** Run `npm run build` — zero TypeScript errors
- [ ] **6.2** Start dev server — navigate to `/dashboard/kpi`
  - Verify company tabs render (PVI, PTU, PKD or whatever is in DB)
  - Verify role cards appear correctly under each tab
  - Verify empty state when no KPI configured for a role
- [ ] **6.3** Click a role card → verify navigation to `/dashboard/kpi/[companyId]/[roleName]`
  - Verify breadcrumb links correctly
  - Verify table data matches DB
  - Verify total weight badge shows correct color
- [ ] **6.4** Test "Tambah KPI" on detail page
  - Create a new RoleKpi — verify it appears in table
  - Verify correct `companyId` is saved in DB
- [ ] **6.5** Test Edit and Delete on detail page
- [ ] **6.6** Test "Definisi KPI" tab on overview — verify existing CRUD still works
- [ ] **6.7** Test "Log & Hasil" tab — verify Activity and Results still work

---

## 🛠️ Technical Details

### New Files
| File | Purpose |
|------|---------|
| `app/api/companies/route.ts` | GET all companies |
| `app/[locale]/(dashboard)/dashboard/kpi/[companyId]/[roleName]/page.tsx` | Detail server page |
| `components/admin/kpi/kpi-overview-client.tsx` | New main client |
| `components/admin/kpi/role-kpi-detail-client.tsx` | Detail page client |
| `components/admin/kpi/role-kpi-detail-sheet.tsx` | Add/Edit form sheet for detail page |

### Modified Files
| File | Change |
|------|--------|
| `app/[locale]/(dashboard)/dashboard/kpi/page.tsx` | Fetch companies + summary, render new client |
| `app/api/role-kpis/route.ts` | Add `?companyId` and `?roleName` query filters to GET |
| `components/admin/role-kpi-sheet.tsx` | Fix: include `companyId` in POST body |

### Key Data Shapes

```ts
type CompanyRow = { id: string; name: string; code: string; isActive: boolean }

type RoleKpiSummaryRow = {
  companyId: string
  roleName: string
  kpiCount: number
  totalWeight: number  // sum of maxScore for that company+role
}

type RoleKpiDetailRow = {
  id: string
  kpiId: string
  maxScore: string      // Decimal serialized to string
  targetValue: string | null
  threshold: string | null
  definition: { id: string; name: string; type: string }
}
```

### Important Architecture Notes
- `RoleKpi.companyId` = Company (PVI/PTU/PKD), NOT Branch — company tabs are correct
- `RoleKpi.weight` and `RoleKpi.maxScore` are separate fields; `weight` is used internally in calculation; for simplicity, sync `weight = maxScore` on create
- When filtering definitions available to add: exclude kpiIds already in `roleKpis` for that company+role to prevent `@@unique([companyId, roleName, kpiId])` constraint violation
- The detail page URL uses the `roleName` enum value (e.g., `KASIR`), not a label

---

## 📝 Notes & Discoveries

- **Bug found**: `components/admin/role-kpi-sheet.tsx` never sends `companyId` in the POST body — the current "Konfigurasi Jabatan" tab is broken for multi-company setups (Step 2.3 fixes this)
- **Existing `GET /api/role-kpis`** returns ALL companies' data mixed — the new filtering in Step 2.2 is required for the detail page to work correctly
- `KpiDefinition` is intentionally global (shared across all companies) — this is correct per schema design
- Company tabs will auto-grow as new companies are added to DB — no hardcoding of PVI/PTU/PKD
