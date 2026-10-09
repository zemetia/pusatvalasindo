import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Primitif layout untuk seluruh halaman admin.
 *
 * Tujuannya satu: setiap halaman punya lebar, padding, ritme jarak, dan bentuk
 * kartu yang persis sama. Sebelum ini tiap halaman menuliskan sendiri
 * `px-4 lg:px-6` / `gap-4` / `gap-6` / `gap-8` sehingga tidak ada dua halaman
 * yang benar-benar sejajar.
 *
 * Semua komponen di sini aman dipakai dari Server Component (tidak ada state).
 */

/* ── Kerangka halaman ─────────────────────────────────────────────────────── */

export function PageShell({
  children,
  className,
  width = "default",
}: {
  children: ReactNode;
  className?: string;
  /** `narrow` untuk halaman form/pengaturan, `full` untuk grid & tabel lebar. */
  width?: "narrow" | "default" | "full";
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 lg:px-6",
        width === "narrow" && "max-w-3xl",
        width === "default" && "max-w-[1600px]",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── Header halaman ───────────────────────────────────────────────────────── */

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Label kecil di atas judul, mis. nama modul induk. */
  eyebrow?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="bg-card text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-sm">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      )}
    </div>
  );
}

/* ── Kartu section ────────────────────────────────────────────────────────── */

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Tombol / kontrol di kanan judul. */
  action?: ReactNode;
  /** Baris kontrol (search, filter) tepat di bawah judul. */
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Matikan padding badan kartu — dipakai saat isinya tabel penuh lebar. */
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  title,
  description,
  icon,
  action,
  toolbar,
  footer,
  children,
  padded = true,
  className,
  bodyClassName,
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || action);

  return (
    <section
      className={cn(
        "bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm",
        className
      )}
    >
      {hasHeader && (
        <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
              )}
              {description && (
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>
          {action && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
          )}
        </header>
      )}

      {toolbar && (
        <div
          className={cn(
            "bg-muted/30 flex flex-wrap items-center gap-2 border-y px-5 py-3",
            !hasHeader && "border-t-0"
          )}
        >
          {toolbar}
        </div>
      )}

      {!toolbar && hasHeader && <div className="border-b" />}

      <div className={cn(padded && "px-5 py-4", bodyClassName)}>{children}</div>

      {footer && (
        <div className="bg-muted/30 text-muted-foreground border-t px-5 py-3 text-xs">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Pendorong kanan di dalam `toolbar` SectionCard. */
export function ToolbarSpacer() {
  return <div className="ml-auto" />;
}

/* ── Empty state ──────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className
      )}
    >
      {icon && (
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm text-pretty">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ── Panel error ──────────────────────────────────────────────────────────── */

/**
 * Ditampilkan saat query halaman gagal. Sebelumnya tiap halaman menyalin blok
 * `<pre>` merah yang sama — pesan teknis tetap ditampilkan (berguna saat
 * debugging), tapi dibungkus supaya tidak terlihat seperti halaman rusak.
 */
export function ErrorPanel({
  title = "Gagal memuat data",
  source,
  message,
}: {
  title?: string;
  /** Nama halaman/query yang gagal, mis. "users/page". */
  source?: string;
  message: string;
}) {
  return (
    <PageShell>
      <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-destructive/20 bg-destructive/5 flex items-start gap-3 border-b px-5 py-4">
          <span className="bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded-lg">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
              aria-hidden="true"
            >
              <path d="M12 9v4" />
              <path d="M10.363 3.591 2.257 17.125a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0Z" />
              <path d="M12 16h.01" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Coba muat ulang halaman. Jika terus terjadi, teruskan detail di bawah ke tim
              teknis.
            </p>
          </div>
        </div>
        <pre className="text-muted-foreground max-h-72 overflow-auto px-5 py-4 font-mono text-xs break-all whitespace-pre-wrap">
          {source ? `[${source}]\n\n${message}` : message}
        </pre>
      </div>
    </PageShell>
  );
}

/* ── Metrik editorial ─────────────────────────────────────────────────────── */

/**
 * Paradigma penyajian data: `docs/blueprint/DATA_PRESENTATION.md`.
 *
 * Angka tidak pernah dibungkus kotak. Hierarki dibentuk oleh ukuran huruf,
 * bobot, warna, dan jarak — bukan oleh border/background. Pembanding (delta,
 * periode) selalu inline di bawah angka, bukan di kartu terpisah.
 */

const metricTone = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
  muted: "text-muted-foreground",
} as const;

const metricSize = {
  /** Satu angka utama yang jadi alasan halaman ini ada. */
  hero: "text-4xl sm:text-5xl font-semibold",
  /** Metrik baris ringkasan. */
  primary: "text-3xl font-semibold",
  /** Metrik pendukung (per cabang, per mata uang). */
  secondary: "text-2xl font-medium",
  /** Angka dalam tabel, kartu pendukung, list. */
  inline: "text-sm font-semibold",
} as const;

export type MetricTone = keyof typeof metricTone;
export type MetricSize = keyof typeof metricSize;

/** Label kecil di atas angka — satu-satunya bentuk label metrik yang dipakai. */
export function MetricLabel({
  children,
  icon,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground/80 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase select-none",
        className
      )}
    >
      {icon && <span className="text-muted-foreground/70 shrink-0">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

/** Angka besar tanpa wadah. Unit/simbol mata uang ikut mengecil & meredup. */
export function MetricValue({
  children,
  size = "primary",
  tone = "default",
  prefix,
  suffix,
  className,
}: {
  children: ReactNode;
  size?: MetricSize;
  tone?: MetricTone;
  /** Mis. `Rp` — dirender kecil & muted di depan angka. */
  prefix?: ReactNode;
  /** Mis. `USD`, `%`, `/40` — dirender kecil & muted di belakang angka. */
  suffix?: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "tabular leading-none tracking-tight inline-flex items-baseline",
        metricSize[size],
        metricTone[tone],
        className
      )}
    >
      {prefix && (
        <span className="text-muted-foreground/75 mr-1.5 text-[0.62em] font-normal tracking-normal select-none">
          {prefix}
        </span>
      )}
      <span className="tabular">{children}</span>
      {suffix && (
        <span className="text-muted-foreground/75 ml-1.5 text-[0.58em] font-normal tracking-normal select-none">
          {suffix}
        </span>
      )}
    </p>
  );
}

/**
 * Tampilan uang modern & bersih dengan pemisahan prefix mata uang,
 * penanganan nilai negatif, dan pemformatan ribuan terstandarisasi.
 */
export type MoneyAmount =
  | number
  | string
  | { toString(): string; toNumber?: () => number }
  | null
  | undefined;

export function MoneyDisplay({
  amount,
  currency = "IDR",
  size = "primary",
  tone = "default",
  showSign = false,
  className,
}: {
  amount: MoneyAmount;
  currency?: string;
  size?: MetricSize;
  tone?: MetricTone;
  showSign?: boolean;
  className?: string;
}) {
  if (amount == null) {
    return <span className={cn("text-muted-foreground tabular", className)}>—</span>;
  }

  let num: number;
  if (typeof amount === "number") {
    num = amount;
  } else if (typeof (amount as { toNumber?: unknown }).toNumber === "function") {
    num = (amount as { toNumber: () => number }).toNumber();
  } else {
    num = Number(String(amount).replace(/,/g, "."));
  }

  if (!Number.isFinite(num)) {
    return <span className={cn("text-muted-foreground tabular", className)}>—</span>;
  }

  const isNeg = num < 0;
  const absVal = Math.abs(num);
  const isIDR = currency === "IDR";
  const formatted = isIDR
    ? Math.round(absVal).toLocaleString("id-ID")
    : absVal.toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

  const resolvedTone =
    tone !== "default"
      ? metricTone[tone]
      : showSign && isNeg
        ? metricTone.destructive
        : showSign && num > 0
          ? metricTone.success
          : metricTone.default;

  return (
    <span
      className={cn(
        "tabular leading-none tracking-tight inline-flex items-baseline",
        metricSize[size],
        resolvedTone,
        className
      )}
    >
      {isNeg && <span className="mr-0.5 font-semibold text-destructive">-</span>}
      {!isNeg && showSign && num > 0 && (
        <span className="mr-0.5 font-semibold text-success">+</span>
      )}
      {isIDR && (
        <span className="text-muted-foreground/75 mr-1 text-[0.62em] font-normal tracking-normal select-none">
          Rp
        </span>
      )}
      <span className="tabular">{formatted}</span>
      {!isIDR && (
        <span className="text-muted-foreground/75 ml-1 text-[0.62em] font-normal tracking-normal select-none">
          {currency}
        </span>
      )}
    </span>
  );
}

/**
 * Pil persentase — permukaan berwarna modern & tactile di dalam blok metrik.
 *
 * `goodWhen` memisahkan *arah* dari *tanda*: untuk metrik terbalik (biaya,
 * selisih kas, keterlambatan) angka turun justru bagus, jadi harus hijau.
 * `null`/non-finite berarti belum ada pembanding → em dash, bukan `NaN%`.
 */
export function DeltaPill({
  value,
  goodWhen = "up",
  suffix = "%",
  className,
}: {
  value: number | null | undefined;
  goodWhen?: "up" | "down";
  suffix?: string;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-tight font-semibold tracking-tight tabular transition-colors select-none";

  if (value == null || !Number.isFinite(value)) {
    return (
      <span className={cn(base, "border-transparent bg-transparent text-muted-foreground px-0", className)}>—</span>
    );
  }

  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const good = goodWhen === "up" ? up : !up;

  const tone = flat
    ? "border-border/60 bg-muted text-muted-foreground font-medium"
    : good
      ? "border-success/20 bg-success-muted text-success dark:bg-success/15 dark:text-success"
      : "border-destructive/20 bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive";

  return (
    <span className={cn(base, tone, className)}>
      {!flat && up && (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-2.5 shrink-0"
          aria-hidden="true"
        >
          <path d="M4 12 12 4" />
          <path d="M6 4h6v6" />
        </svg>
      )}
      {!flat && !up && (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-2.5 shrink-0"
          aria-hidden="true"
        >
          <path d="M4 4 12 12" />
          <path d="M12 6v6H6" />
        </svg>
      )}
      {flat && (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="size-2.5 shrink-0"
          aria-hidden="true"
        >
          <path d="M4 8h8" />
        </svg>
      )}
      {Math.abs(value).toFixed(1).replace(".", ",")}
      {suffix}
    </span>
  );
}

export interface MetricBlockProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  /** Simbol mata uang, dirender kecil & muted di depan angka. */
  prefix?: ReactNode;
  /** Unit/pembagi, mis. `USD` atau `/40`. */
  suffix?: ReactNode;
  /** Persentase perubahan. Dirender inline sebagai pil. */
  delta?: number | null;
  /** Arah yang dianggap membaik untuk metrik ini. */
  deltaGoodWhen?: "up" | "down";
  /** Periode pembanding, mis. "vs bulan lalu" — inline di samping pil. */
  period?: ReactNode;
  /** Baris keterangan tambahan di bawah (sumber, timestamp, rincian). */
  meta?: ReactNode;
  /** Tautan/tombol kecil di bawah blok — dipakai saat metrik butuh aksi. */
  action?: ReactNode;
  size?: MetricSize;
  tone?: MetricTone;
  className?: string;
}

/**
 * Blok data tanpa wadah. Urutan tetap: label → angka → delta inline → meta.
 * Tidak punya padding sendiri; jarak dimiliki oleh `MetricRow`.
 */
export function MetricBlock({
  label,
  value,
  icon,
  badge,
  prefix,
  suffix,
  delta,
  deltaGoodWhen = "up",
  period,
  meta,
  action,
  size = "primary",
  tone = "default",
  className,
}: MetricBlockProps) {
  const showDelta = delta !== undefined || Boolean(period);

  return (
    <div className={cn("min-w-0 flex flex-col justify-between", className)}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <MetricLabel icon={icon}>{label}</MetricLabel>
          {badge}
        </div>
        <MetricValue size={size} tone={tone} prefix={prefix} suffix={suffix} className="mt-2.5">
          {value}
        </MetricValue>
        {showDelta && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {delta !== undefined && <DeltaPill value={delta} goodWhen={deltaGoodWhen} />}
            {period && (
              <span className="text-muted-foreground text-xs leading-none font-medium">
                {period}
              </span>
            )}
          </div>
        )}
      </div>
      {(meta || action) && (
        <div className="mt-2.5 space-y-2">
          {meta && (
            <div className="text-muted-foreground text-xs leading-relaxed font-normal">
              {meta}
            </div>
          )}
          {action && <div className="pt-0.5">{action}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Baris sorotan editorial: beberapa `MetricBlock` dalam satu ruang, dipisah
 * garis rambut di layar lebar dan hanya oleh jarak di layar sempit.
 */
export function MetricRow({
  children,
  title,
  action,
  columns = 4,
  divided = true,
  /** Matikan garis atas/bawah saat baris sudah berada di dalam section lain. */
  bordered = true,
  className,
}: {
  children: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  columns?: 2 | 3 | 4;
  divided?: boolean;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <section className={cn(bordered && "border-border/80 border-y py-7", className)}>
      {(title || action) && (
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="text-muted-foreground/80 text-xs font-semibold tracking-wider uppercase">
              {title}
            </h2>
          )}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div
        className={cn(
          "grid grid-cols-1 gap-7 sm:grid-cols-2",
          columns === 3 && "lg:grid-cols-3",
          columns === 4 && "lg:grid-cols-4",
          divided &&
            "lg:gap-0 lg:[&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:border-border/70 lg:[&>*:not(:first-child)]:pl-7 lg:[&>*:not(:last-child)]:pr-7"
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Metrik ringkas satu baris (label kiri, angka kanan) — untuk panel sempit,
 * sheet, dan daftar rincian di mana blok besar terlalu berat.
 */
export function MetricInline({
  label,
  value,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: MetricTone;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn("tabular text-sm font-medium", metricTone[tone])}>{value}</span>
    </div>
  );
}

/*
 * `StatCard` dan `StatGrid` sudah dihapus. Kartu statistik berkotak melanggar
 * paradigma penyajian data (docs/blueprint/DATA_PRESENTATION.md) — pakai
 * `MetricBlock` di dalam `MetricRow`.
 */
