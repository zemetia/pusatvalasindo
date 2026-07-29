# Data Presentation Paradigm

← [Blueprint INDEX](./INDEX.md) | related: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [COMPONENTS.md](./COMPONENTS.md)

**This file is the single source of truth for how numbers are shown to users.** Every metric, KPI,
summary figure, total, balance, ratio, and analytics surface in this product follows it — no
exceptions, no per-page reinterpretation.

Token source: [src/app/globals.css](../../src/app/globals.css).

---

## 1. The Paradigm

> Don't use traditional dashboard cards. Present KPI metrics as **editorial-style financial
> highlights**. Typography is the primary visual hierarchy: large bold numbers, small muted labels,
> subtle inline comparisons, colored percentage pills, and generous whitespace. The layout should
> feel **integrated into the page** rather than separated into individual cards.
>
> Avoid boxed statistic cards. Display metrics as clean **data blocks with no visible borders or
> backgrounds**. Use typography, spacing, and alignment to create hierarchy instead of containers.
>
> Build analytics using **editorial layout principles instead of dashboard widgets**. Numbers
> dominate the visual hierarchy. Labels are small and secondary. Supporting information — percentage
> change, comparison period, trend — appears **inline**, not inside separate cards.
>
> Design references: Stripe Dashboard, Vercel Analytics, Linear, Apple financial reports.
> Minimal, elegant, typography-first. Avoid dashboard-card syndrome. Every metric should read as
> part of a **financial report**, not as a widget.

One-line test before shipping a screen: *if you deleted every border and background, would the
metrics still be readable and correctly ranked?* If yes, the hierarchy is real. If no, the
containers were doing the work — fix the typography.

---

## 2. Hard Rules

| # | Rule | Violation looks like |
|---|---|---|
| 1 | A metric is **never** wrapped in a bordered/filled box | `rounded-xl border bg-card p-4` around a single number |
| 2 | Hierarchy comes from **size, weight, color, and space** only | Equal-size text separated by boxes |
| 3 | The **number is the largest element** in its block | Label or icon competing with the value |
| 4 | Labels are small, muted, and sit **above** the value | `text-base` label in `text-foreground` |
| 5 | Comparison / delta / period is **inline**, adjacent to the value | A second card titled "vs last month" |
| 6 | Metric groups are separated by **space or a hairline rule**, not by cards | `gap-4` grid of `<Card>` |
| 7 | All numerals use `.tabular` (tabular-nums) | Digits shifting between renders, ragged columns |
| 8 | Colors come from tokens only | Raw hex, `text-green-500`, `bg-red-100` |
| 9 | No decorative icon per metric; icons only when they carry meaning | Icon-in-a-rounded-square per stat |
| 10 | No shadows, no gradients, no elevation on metric surfaces | `shadow-sm` on a stat block |
| 11 | Whitespace is generous and consistent — vertical rhythm beats density | Cramped `p-3` tiles |
| 12 | Metric text is `font-sans` (Inter) — the display face is marketing-only | `font-display` on a KPI number |

---

## 3. Typographic Scale for Metrics

Fixed scale. Pick a tier by importance; do not invent intermediate sizes.

| Tier | Use | Classes |
|---|---|---|
| Hero | The one number a page exists for (e.g. total saldo, net P&L) | `text-4xl sm:text-5xl font-semibold tracking-tight tabular` |
| Primary | Top-line metrics in a highlight row | `text-3xl font-semibold tracking-tight tabular` |
| Secondary | Supporting metrics, per-branch or per-currency figures | `text-2xl font-medium tracking-tight tabular` |
| Inline | Numbers inside prose, tables, list rows | `text-sm font-medium tabular` |
| Label | Every metric label | `text-xs font-medium uppercase tracking-wide text-muted-foreground` |
| Meta | Comparison period, source note, timestamp | `text-xs text-muted-foreground` |

Rules:
- `tracking-tight` on every value ≥ `text-2xl`; never on labels.
- Weight ceiling is `font-semibold`. `font-bold` reads as shouting at these sizes.
- Currency symbol and unit are set **smaller and muted** next to the value, never the same size.

```tsx
<p className="tabular text-3xl font-semibold tracking-tight">
  <span className="text-muted-foreground mr-1 text-lg font-normal">Rp</span>
  1.284.500.000
</p>
```

---

## 4. Anatomy of a Data Block

Order is fixed: **label → value → inline delta → meta**. No container element, no border, no
background, no padding of its own — spacing is owned by the parent layout.

```tsx
<div>
  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
    Saldo Bank Harian
  </p>
  <p className="tabular mt-2 text-3xl font-semibold tracking-tight">
    Rp 1.284.500.000
  </p>
  <div className="mt-2 flex items-baseline gap-2">
    <DeltaPill value={4.2} />
    <span className="text-muted-foreground text-xs">vs bulan lalu</span>
  </div>
</div>
```

Optional trailing line for a secondary comparison — still inline, still muted:

```tsx
<p className="text-muted-foreground mt-1 text-xs">
  Rata-rata 30 hari <span className="tabular text-foreground">Rp 1.232.900.000</span>
</p>
```

---

## 5. Layout — Highlight Rows, Not Grids of Cards

A metric group is a **row of data blocks in shared whitespace**, optionally divided by hairlines.

```tsx
{/* Editorial highlight row — dividers, not cards */}
<section className="border-border grid grid-cols-1 gap-8 border-y py-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:[&>*:not(:first-child)]:pl-8">
  <MetricBlock label="Total Transaksi" value="1.482" delta={6.1} period="vs bulan lalu" />
  <MetricBlock label="Volume" value="Rp 18,4 M" delta={-2.4} period="vs bulan lalu" />
  <MetricBlock label="Margin Kotor" value="Rp 412,7 jt" delta={11.8} period="vs bulan lalu" />
  <MetricBlock label="Rata-rata / Transaksi" value="Rp 12,4 jt" delta={0} period="vs bulan lalu" />
</section>
```

Layout rules:

| Aspect | Rule |
|---|---|
| Separation | `divide-x` hairlines on `lg+`, pure `gap` below `lg` — never a border box per metric |
| Section framing | At most a single `border-y` rule around a whole highlight row |
| Vertical rhythm | `py-8` inside a highlight row; `gap-10`–`gap-12` between page sections |
| Column count | 2–4 metrics per row. 5+ means the page has no point of view — rank and cut |
| Hero pattern | Lead with one hero metric on its own line, then a row of supporting metrics below |
| Alignment | Left-aligned throughout. Right-align only inside table numeric columns |
| Page width | Keep [PageShell](../../src/components/admin/page-shell.tsx) as the width owner; metric sections are plain `<section>` children |

---

## 6. Delta Pills

The only permitted colored surface in a metric block. Small, low-chroma, token-driven.

```tsx
<span className="bg-success-muted text-success inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular">
  <ArrowUpRight className="size-3" aria-hidden />
  4,2%
</span>
```

| Direction | Background | Text | Notes |
|---|---|---|---|
| Improvement | `bg-success-muted` | `text-success` | Prefix `+` or an up arrow, never both plus a caret |
| Deterioration | `bg-destructive/10` | `text-destructive` | |
| Flat (0 or below noise floor) | `bg-muted` | `text-muted-foreground` | Render `0,0%`, never hide it |
| Unknown / no baseline | — | `text-muted-foreground` | Render `—`, never `NaN%`, `∞`, or `100%` |

**Direction ≠ sign.** For inverse metrics (biaya, selisih kas, keterlambatan absensi, retur), a
negative percentage is an *improvement* and must render green. Decide the tone from a `goodWhen:
'up' | 'down'` prop, never from `value > 0`.

Other constraints: pill height must not exceed the label line-height; no pill on the label line; one
pill per metric; percentages use Indonesian decimal comma and one decimal place.

---

## 7. Number Formatting

| Case | Rule | Example |
|---|---|---|
| Locale | `id-ID` for all business figures | `1.284.500.000` |
| Currency | `Rp` prefix, muted, no space-eating symbol inflation; no decimals for IDR | `Rp 1.284.500` |
| Foreign currency | ISO code as a muted suffix, 2 decimals | `12.500,00 <span class="muted">USD</span>` |
| Compact (hero/row only) | `jt` / `M` with one decimal — never in tables or exports | `Rp 18,4 M` |
| Percentage | One decimal, comma separator, `%` attached | `4,2%` |
| Counts | Plain integer, no unit noise | `1.482` |
| Zero | `0`, styled `text-muted-foreground`; never `-` or blank | `0` |
| Null / not applicable | Em dash `—` in `text-muted-foreground` | `—` |
| Alignment | `.tabular` everywhere; right-align numeric table columns | |
| Rounding | Round at the presentation layer only; services return exact values | |

Format on the server where the value is fetched, so the client ships no formatting branch.

---

## 8. Tables

Tables are data, not widgets — the same paradigm applies.

- Header cells: `text-xs uppercase tracking-wide text-muted-foreground font-medium`.
- Row separation: hairline `border-b` only. No zebra striping, no per-row background.
- Numeric columns: `text-right tabular`.
- The table itself may live inside `SectionCard` (a *container for a dataset* is allowed — see §10),
  but individual figures inside it never get their own boxes.
- Row emphasis (totals, subtotals) comes from `font-semibold` and a `border-t`, not a fill.
- Status uses a text pill from the semantic tokens, sized like a delta pill.

---

## 9. Charts

Charts support the number; they never replace it.

- Always pair a chart with its headline value in the section header, styled per §3.
- Chrome minimum: no chart border, no chart background fill, no visible box.
- Gridlines: horizontal only, `border`-token color, or none.
- Axis labels: `text-xs text-muted-foreground`; drop the axis title when the label already says it.
- Series color: `primary` for the focus series, `muted-foreground` for comparison/baseline series.
  Add semantic colors only when the series *is* a status.
- Sparklines are preferred over full charts inside a highlight row — single stroke, no axes, no fill,
  aligned to the value's baseline.

---

## 10. When a Container *Is* Allowed

The ban targets metrics-in-boxes, not all surfaces. Containers remain correct for:

| Allowed | Not allowed |
|---|---|
| A dataset region — table, list, log — via `SectionCard` | A single number via `SectionCard`/`Card` |
| Forms, dialogs, sheets, popovers, dropdowns | A KPI "widget" grid |
| Interactive panels with their own controls | A metric wrapped for "visual grouping" |
| Error panels, banners, toasts | A stat given a border to "separate" it — use space |

If a container holds exactly one number, it is a violation. Remove the container.

---

## 11. States

No skeleton "cards" — skeletons mirror the typography, not a box.

```tsx
{/* Loading — block-shaped to the text it replaces */}
<div>
  <div className="bg-muted h-3 w-24 animate-pulse rounded" />
  <div className="bg-muted mt-3 h-8 w-40 animate-pulse rounded" />
</div>
```

- **Empty:** render the label and `—` at full metric size, with a muted one-line reason. Never
  collapse the block; a missing metric must keep its slot so the row doesn't reflow.
- **Error:** keep the label, render `—`, and surface the failure once at the section level (see
  `ErrorPanel`) rather than per metric.
- **Stale:** append a muted meta line — `Per 28 Jul 2026, 14:05`.

---

## 12. The Primitives

All live in [src/components/admin/page-shell.tsx](../../src/components/admin/page-shell.tsx) —
server-safe (no state), same as the rest of that file.

| Export | Use |
|---|---|
| `MetricRow` | Highlight row: optional title, `columns` 2–4, `divided` hairlines, `bordered` border-y |
| `MetricBlock` | One data block — `label`, `value`, `prefix`, `suffix`, `delta`, `deltaGoodWhen`, `period`, `meta`, `action`, `size`, `tone` |
| `MetricValue` | Bare number when you need custom composition around it |
| `MetricLabel` | The one label style (small, muted, uppercase) |
| `DeltaPill` | Percentage pill; `goodWhen: "up" \| "down"` decides the tone |
| `MetricInline` | Compact label-left / value-right row for narrow panels and sheets |

Stacking rows: give every row after the first `className="-mt-px"` so the adjacent `border-y`
hairlines collapse into a single rule instead of doubling.

`StatCard` and `StatGrid` — the old boxed pattern — **have been deleted**. Do not reintroduce a
component that wraps a single number in `bg-card rounded-xl border p-4 shadow-sm`.

---

## 13. Review Checklist

- [ ] No metric sits inside a bordered or filled box
- [ ] The number is visually dominant; the label is small, muted, above it
- [ ] Delta and comparison period are inline with the value
- [ ] Delta pill tone reflects *good/bad*, not the sign of the number
- [ ] `.tabular` on every numeral, including table cells
- [ ] All color via tokens (`muted-foreground`, `success`, `destructive`, `warning`, `info`, `primary`)
- [ ] Separation is whitespace or hairline rules — no per-metric shadows or radii
- [ ] Numbers formatted `id-ID`; zero renders `0`, missing renders `—`
- [ ] Loading/empty states preserve the block's slot and shape
- [ ] Row holds at most 4 metrics and the page leads with a clear hero figure

---

← [Blueprint INDEX](./INDEX.md)
