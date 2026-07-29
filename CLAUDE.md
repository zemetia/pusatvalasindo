# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Pusat Kirim Duit** management system — a web-based platform for a multi-branch money changer business in Tangerang. It is built on a Next.js + Better Auth + Prisma starter kit and is being extended into a full business management system covering attendance, payroll, KPIs, currency stock, and finance flow.

See `SYSTEM_PLAN.md` for the full architecture specification and module breakdown.

## Data Presentation Paradigm (MANDATORY)

**Paradigm source file: [`docs/blueprint/DATA_PRESENTATION.md`](docs/blueprint/DATA_PRESENTATION.md)** — read it before writing or modifying any UI that renders a metric, KPI, total, balance, ratio, chart, or analytics view.

Summary of the binding rules (the source file is authoritative):
- **No boxed statistic cards.** Metrics are borderless, background-less data blocks — no `border`, no `bg-card`, no `shadow`, no per-metric radius.
- **Typography is the hierarchy.** Large bold number, small muted uppercase label above it, generous whitespace. Separation via spacing and hairline rules, never containers.
- **Supporting info is inline** — percentage change (colored pill), comparison period, and trend sit next to the value, not in a separate card.
- **Editorial, not widgets.** Reference points: Stripe Dashboard, Vercel Analytics, Linear, Apple financial reports. Every metric should read as part of a financial report.
- `.tabular` on every numeral; `id-ID` number formatting; colors via design tokens only.
- Use the primitives in `src/components/admin/page-shell.tsx`: `MetricRow`, `MetricBlock`, `MetricValue`, `MetricLabel`, `DeltaPill`, `MetricInline`. The old `StatCard` / `StatGrid` were deleted — don't reintroduce boxed stat tiles.

Other blueprint docs live in `docs/blueprint/` — start at [`docs/blueprint/INDEX.md`](docs/blueprint/INDEX.md).

## Commands

```bash
# Development
npm run dev          # Start dev server with Turbopack

# Build (also runs prisma generate)
npm run build

# Linting
npm run lint

# Database
npx prisma migrate dev           # Apply migrations and regenerate client
npx prisma migrate dev --name <name>  # Create a named migration
npx prisma studio                # Open database GUI
npx prisma generate              # Regenerate client after schema changes

# Database seeding (via prisma.config.ts)
tsx prisma/seed.ts
```

## Architecture

### Tech Stack
- **Next.js 16** (App Router, React 19, Turbopack)
- **Better Auth** — email/password authentication with session management
- **Prisma 7** — PostgreSQL ORM using the Rust-free engine with `@prisma/adapter-pg`
- **Tailwind CSS v4** + **shadcn/ui** (new-york style, neutral base)
- **TypeScript** with strict mode

### Path Aliases
- `@/*` → `./src/` (e.g. `@/components` = `src/components`, `@/lib` = `src/lib`)
- `@src/*` → `./src/` (alias for legacy imports, same target as `@/*`; used for `@src/generated/prisma`)

### Key Files
| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | Better Auth server instance (uses Prisma adapter + PrismaPg) |
| `src/lib/auth-client.ts` | Client-side Better Auth hooks via `createAuthClient` |
| `src/lib/prisma.ts` | Singleton Prisma client (global instance in dev to avoid hot-reload leaks) |
| `src/lib/supabase.ts` | Lazy Supabase client getters (photo storage) |
| `prisma/schema/` | Modular DB schema (auth, business, kpi, attendance, bank, stock) |
| `prisma.config.ts` | Prisma config with migrations path and seed command |
| `src/app/api/auth/[...all]/route.ts` | Better Auth catch-all API route |
| `src/middleware.ts` | Auth guard + i18n routing + rate limiting + security headers |

### Application Structure
```
src/
  app/
    [locale]/
      layout.tsx         — Root locale layout (fonts, theme, i18n provider)
      (dashboard)/       — Protected route group
        layout.tsx       — Auth guard: redirects if no session; renders AppSidebar + SiteHeader
        dashboard/       — All dashboard pages (attendance, kpi, payroll, stock, bank, etc.)
      login/page.tsx     — Login page
      signup/page.jsx    — Sign-up page
    api/                 — All API routes
    globals.css          — Tailwind CSS v4 theme tokens
    layout.tsx           — Root layout (minimal passthrough)
    page.tsx             — Redirects to /en

  backend/
    errors/              — Custom error classes
    helpers/             — api-response, handle-error, get-admin-caller
    middleware/          — with-auth, with-role, with-validation
    repositories/        — Data access layer (25+ repositories)
    services/            — Business logic (kpi, payroll, user, bank, stock...)

  components/
    admin/               — Admin UI components (roles, users, KPI, payroll, stock, bank)
    attendance/          — Camera, GPS, history, live-clock
    auth/                — Login/signup forms
    account/             — Change password
    premium/             — Landing page sections
    ui/                  — shadcn/ui components (button, card, table, sidebar, etc.)
    app-sidebar.tsx      — Main collapsible sidebar
    site-header.tsx      — Top header bar

  lib/
    auth.ts              — Server-side auth
    auth-client.ts       — Client-side auth hooks
    prisma.ts            — DB client singleton
    supabase.ts          — Lazy Supabase client getters
    utils.ts             — cn() utility (clsx + tailwind-merge)

  hooks/                 — Custom React hooks
  i18n/                  — next-intl routing + request config
  generated/prisma/      — Generated Prisma client (do not edit)

prisma/
  schema/                — Modular schema files
  migrations/            — Migration history
  seed.ts + seeds/       — Seed scripts
```

### Authentication Flow
- Server components call `auth.api.getSession({ headers: await headers() })` to get session
- The `(dashboard)/layout.tsx` acts as the auth guard — returns early (blank) if no session
- Client components use `authClient` from `lib/auth-client.ts` for sign-in/sign-out/sign-up

### Prisma Client
- Generated to `src/generated/prisma` (not the default location)
- Uses `PrismaPg` adapter — connection via `DATABASE_URL` env var (no `url` in `schema.prisma`)
- After any schema change: run `npx prisma migrate dev` (triggers `prisma generate` automatically), or `npx prisma generate` alone for client-only updates
- The `build` script runs `prisma generate` before `next build`

### Environment Variables
```
BETTER_AUTH_SECRET=    # Random secret for session signing
BETTER_AUTH_URL=       # Full base URL (e.g., http://localhost:3000)
DATABASE_URL=          # PostgreSQL connection string
```

### Adding shadcn/ui Components
```bash
npx shadcn@latest add <component>
```

### Planned Modules (from SYSTEM_PLAN.md)
The system will be extended with these modules (not yet implemented):
1. **Absensi** — attendance with photo clock-in, leave/overtime workflows
2. **Payroll & Bonus** — salary components, KPI-linked bonuses, THR, payslips
3. **KPI** — weighted categories, monthly entry, grading (A/B/C/D)
4. **Stock Mata Uang** — currency inventory, buy/sell rates, inter-branch transfers
5. **Finance Flow** — accounts, transactions, daily closing, P&L
6. **Multi-User & Multi-Branch** — role-based access (Super Admin, Owner, Kepala Cabang, Kasir, HR, Akuntan)

Each new module should follow the existing pattern: server components for data fetching, Prisma for DB access, shadcn/ui for UI, with branch-scoped data isolation.
