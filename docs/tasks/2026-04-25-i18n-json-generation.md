# Task: Generate Comprehensive i18n JSON Files

- **Date**: 2026-04-25
- **Status**: In Progress
- **Source**: User request for translating all pages one by one into `id.json` and `en.json`.

## 🎯 Goal

Extract all hardcoded strings from every page and component in the application and generate complete `id.json` and `en.json` files to support full internationalization.

## 📋 Implementation Checklist

- [ ] **Phase 1: Research & Mapping**
  - [x] Identify all pages in `app/[locale]/` and its subdirectories.
  - [x] Identify common components in `components/` requiring translation.
  - [x] Map existing translations in `messages/en.json` and `messages/id.json`.

- [x] **Phase 2: Page-by-Page Extraction & Translation**
  - [x] **Home Page** (`app/[locale]/page.tsx`)
    - [x] Extract hardcoded strings.
    - [x] Generate ID/EN translations for `Common`, `Hero`, `ExchangeRates`, `Features`, `Testimonials`.
  - [x] **About Page** (`app/[locale]/about/page.tsx`)
    - [x] Extract hardcoded strings.
    - [x] Generate ID/EN translations for `AboutPage`.
  - [x] **Services Page** (`app/[locale]/services/page.tsx`)
    - [x] Extract hardcoded strings.
    - [x] Generate ID/EN translations for `ServicesPage`.
  - [x] **Contact Page** (`app/[locale]/contact/page.tsx`)
    - [x] Extract hardcoded strings.
    - [x] Generate ID/EN translations for `ContactPage`.
  - [x] **Login & Signup Pages** (`app/[locale]/login/page.tsx`, `app/[locale]/signup/page.tsx`)
    - [x] Extract hardcoded strings.
    - [x] Generate ID/EN translations for `Auth`.
  - [x] **Pusat Kirim Duit Page** (`app/[locale]/pusat-kirim-duit/page.tsx`)
    - [x] Extract hardcoded strings.
    - [x] Generate ID/EN translations for `PusatKirimDuit`.
  - [ ] **Dashboard Home** (`app/[locale]/(dashboard)/dashboard/page.tsx`)
    - [ ] Extract hardcoded strings.
    - [ ] Generate ID/EN translations for `Dashboard`.
  - [ ] **Dashboard Sub-pages** (Account, Bank Accounts, Branches, Employees, etc.)
    - [ ] Extract hardcoded strings from all sub-pages.
    - [ ] Generate ID/EN translations.

- [ ] **Phase 3: Component-level Extraction**
  - [ ] **Navigation & Footer** (`components/premium/Navbar.tsx`, `components/premium/Footer.tsx` if they exist)
  - [ ] **Sidebar** (`components/app-sidebar.tsx`)
  - [ ] **Modals & Forms** (In `components/admin/` or `components/ui/`)

- [x] **Phase 4: Final JSON Consolidation**
  - [x] Merge all translations into `messages/id.json`.
  - [x] Merge all translations into `messages/en.json`.
  - [x] Ensure consistent naming conventions (e.g., camelCase for keys).
  - [x] Verify JSON validity.

- [ ] **Phase 5: Verification**
  - [ ] Audit all pages to ensure no hardcoded strings are missed.
  - [ ] Check for consistency between ID and EN files.

## 🛠️ Technical Details

- Files affected:
  - `messages/id.json`
  - `messages/en.json`
  - All page files in `app/[locale]/`
- Dependencies: `next-intl` (already installed)

## 📝 Notes & Discoveries

- The project uses `next-intl` with a `[locale]` dynamic segment.
- Current JSON files are very basic and need significant expansion.
- Some pages might be using complex UI components from `premium/` folder.
