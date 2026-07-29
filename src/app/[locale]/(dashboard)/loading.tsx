import { PageShell } from "@/components/admin/page-shell";

/**
 * Skeleton yang meniru bentuk halaman admin (header + kartu tabel) supaya
 * transisi antar halaman tidak "berkedip" dari spinner ke layout penuh.
 */
export default function Loading() {
  return (
    <PageShell>
      <div className="flex items-center gap-3 border-b pb-5">
        <div className="bg-muted size-10 animate-pulse rounded-lg" />
        <div className="space-y-2">
          <div className="bg-muted h-5 w-48 animate-pulse rounded" />
          <div className="bg-muted h-3.5 w-72 animate-pulse rounded" />
        </div>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-muted/30 border-b px-5 py-3">
          <div className="bg-muted h-9 w-full max-w-xs animate-pulse rounded-md" />
        </div>
        <div className="divide-border divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="bg-muted h-4 w-1/4 animate-pulse rounded" />
              <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />
              <div className="bg-muted ml-auto h-4 w-20 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
