# Task: Implement Role Management Page

- **Date**: 2026-05-04
- **Status**: In Progress
- **Source**: User request for role page with company tabs

## 🎯 Goal

Create a premium Role Management page in the admin dashboard that allows administrators to manage custom roles for each company using a tabbed interface.

## 📋 Implementation Checklist

- [x] **Phase 1: Database & Schema**
  - [x] Step 1.1: Update `prisma/schema/auth.prisma` to add explicit relation from `custom_role` to `Company`.
  - [x] Step 1.2: Update `prisma/schema/business.prisma` to add `custom_roles` relation to `Company`.
  - [x] Step 1.3: Run `npx prisma db push` to sync changes.
- [x] **Phase 2: Backend Logic**
  - [x] Step 2.1: Create `backend/repositories/role.repository.ts`.
  - [x] Step 2.2: Create `backend/services/role.service.ts`.
  - [x] Step 2.3: Create `app/api/roles/route.ts` for listing and creation.
  - [x] Step 2.4: Create `app/api/roles/[id]/route.ts` for update and deletion.
- [x] **Phase 3: Frontend Components**
  - [x] Step 3.1: Create `components/admin/role-sheet.tsx` using `AdminFormSidebar` for adding/editing roles.
  - [x] Step 3.2: Create `components/admin/roles-page-client.tsx` with:
    - [x] Company tabs logic.
    - [x] Data table for roles within each tab.
    - [x] Integration with `role-sheet.tsx`.
- [x] **Phase 4: Page Implementation**
  - [x] Step 4.1: Create `app/[locale]/(dashboard)/dashboard/roles/page.tsx` to fetch companies and roles.
  - [x] Step 4.2: Update `components/app-sidebar.tsx` to include the "Roles" link in the Management section.
- [ ] **Phase 5: Verification**
  - [ ] Step 5.1: Verify tab switching works correctly.
  - [ ] Step 5.2: Verify role creation/editing correctly associates roles with companies.
  - [ ] Step 5.3: Verify UI matches the premium "luxury corporate" aesthetic.

## 🛠️ Technical Details

- **Affected Files**:
  - `prisma/schema/auth.prisma`
  - `prisma/schema/business.prisma`
  - `components/app-sidebar.tsx`
  - `app/[locale]/(dashboard)/dashboard/roles/page.tsx` (New)
  - `components/admin/roles-page-client.tsx` (New)
  - `components/admin/role-sheet.tsx` (New)
  - `lib/actions/role-actions.ts` (New)

## 📝 Notes & Discoveries

- Ensure permissions are handled as a string array in the form.
- Use `AdminFormSidebar` to maintain consistency with other management pages.
- The `companyId` in `custom_role` should be used to filter roles per tab.
