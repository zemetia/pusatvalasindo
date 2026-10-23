"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  IconArchive,
  IconArticle,
  IconDots,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconLock,
  IconX,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import { EmptyState, SectionCard, ToolbarSpacer } from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { SegmentedFilter } from "@/components/admin/segmented-filter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/routing";
import { formatDateShort, formatInt } from "@/lib/blog/format";
import { DISPLAY_STATUS_LABEL, DISPLAY_STATUSES, type BlogDisplayStatus } from "@/lib/blog/status";

import { blogApi, type BlogCategoryDTO, type BlogPostRowDTO } from "./api";
import { BlogStatusBadge } from "./blog-status-badge";

type StatusFilter = "ALL" | BlogDisplayStatus;

export function BlogPostsTable({
  posts,
  categories,
  counts,
  total,
  days,
  canWrite,
}: {
  posts: BlogPostRowDTO[];
  categories: BlogCategoryDTO[];
  counts: Record<BlogDisplayStatus, number>;
  /** Jumlah artikel di database (bisa lebih besar dari `posts` bila daftar dipotong). */
  total: number;
  days: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sort, setSort] = useState<"recent" | "views">("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Artikel yang akan dihapus (satu dari menu baris, atau banyak dari aksi massal).
  const [deleteTargets, setDeleteTargets] = useState<BlogPostRowDTO[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = posts.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false;
      if (categoryId === "none" && p.category) return false;
      if (categoryId !== "ALL" && categoryId !== "none" && p.category?.id !== categoryId) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });
    return sort === "views" ? [...rows].sort((a, b) => b.rangeViews - a.rangeViews) : rows;
  }, [posts, search, status, categoryId, sort]);

  const visibleIds = filtered.map((p) => p.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }

  async function bulkStatus(next: "DRAFT" | "PUBLISHED" | "ARCHIVED", okMessage: string) {
    const ids = selectedVisible;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) => blogApi(`/api/blog/posts/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) toast.error(`${failed} dari ${ids.length} artikel gagal diubah`);
    else toast.success(`${okMessage} (${ids.length})`);
    setSelected(new Set());
    setBulkBusy(false);
    router.refresh();
  }

  async function changeStatus(post: BlogPostRowDTO, next: "DRAFT" | "PUBLISHED" | "ARCHIVED", okMessage: string) {
    setBusyId(post.id);
    try {
      await blogApi(`/api/blog/posts/${post.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      toast.success(okMessage);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah status");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const targets = deleteTargets;
    if (targets.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(targets.map((t) => blogApi(`/api/blog/posts/${t.id}`, { method: "DELETE" })));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) toast.error(`${failed} dari ${targets.length} artikel gagal dihapus`);
    else toast.success(targets.length > 1 ? `${targets.length} artikel dihapus` : "Artikel dihapus");
    setSelected(new Set());
    setBulkBusy(false);
    setDeleteTargets([]);
    router.refresh();
  }

  const statusOptions = [
    { value: "ALL", label: `Semua ${formatInt(Object.values(counts).reduce((a, b) => a + b, 0))}` },
    ...DISPLAY_STATUSES.map((s) => ({ value: s, label: `${DISPLAY_STATUS_LABEL[s]} ${formatInt(counts[s])}` })),
  ];

  return (
    <>
      <SectionCard
        title="Semua artikel"
        description={`Tampilan & pengunjung dihitung untuk ${days} hari terakhir.`}
        padded={false}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Cari judul atau slug…" />
            <SegmentedFilter
              aria-label="Filter status"
              value={status}
              onChange={(v) => setStatus(v as StatusFilter)}
              options={statusOptions}
            />
            {categories.length > 0 && (
              <select
                aria-label="Filter kategori"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              >
                <option value="ALL">Semua kategori</option>
                <option value="none">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <ToolbarSpacer />
            <select
              aria-label="Urutkan"
              value={sort}
              onChange={(e) => setSort(e.target.value as "recent" | "views")}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              <option value="recent">Terbaru diperbarui</option>
              <option value="views">Paling banyak dibaca</option>
            </select>
          </>
        }
        footer={
          posts.length < total
            ? `Menampilkan ${formatInt(posts.length)} artikel terbaru dari ${formatInt(total)}. Gunakan pencarian di API/MCP untuk yang lebih lama.`
            : `${formatInt(filtered.length)} dari ${formatInt(total)} artikel`
        }
      >
        {posts.length === 0 ? (
          <EmptyState
            icon={<IconArticle className="size-5" />}
            title="Belum ada artikel"
            description="Tulis artikel pertama untuk mulai mengisi blog dan mendatangkan pengunjung dari pencarian."
            action={
              canWrite ? (
                <Link href="/dashboard/blog/baru" className={buttonVariants({ size: "sm" })}>
                  <IconPlus className="size-4" /> Artikel baru
                </Link>
              ) : undefined
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="Tidak ada artikel yang cocok" description="Ubah kata kunci atau filter di atas." />
        ) : (
          <>
          {canWrite && selectedVisible.length > 0 && (
            <div className="bg-primary/5 flex flex-wrap items-center gap-2 border-b px-5 py-2.5 text-sm">
              <span className="tabular mr-2 font-medium">{selectedVisible.length} dipilih</span>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("PUBLISHED", "Diterbitkan")}>
                <IconEye className="size-4" /> Terbitkan
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("DRAFT", "Dijadikan privat")}>
                <IconLock className="size-4" /> Jadikan privat
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkStatus("ARCHIVED", "Diarsipkan")}>
                <IconArchive className="size-4" /> Arsipkan
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={bulkBusy}
                onClick={() => setDeleteTargets(filtered.filter((p) => selected.has(p.id)))}
              >
                <IconTrash className="size-4" /> Hapus
              </Button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
                <IconX className="size-4" /> Batal
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canWrite && (
                  <TableHead className="w-10 pl-5">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Pilih semua artikel" />
                  </TableHead>
                )}
                <TableHead className={`text-muted-foreground text-xs font-medium tracking-wide uppercase ${canWrite ? "" : "pl-5"}`}>Artikel</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Status</TableHead>
                <TableHead className="text-muted-foreground text-right text-xs font-medium tracking-wide uppercase">
                  Tampilan
                </TableHead>
                <TableHead className="text-muted-foreground hidden text-right text-xs font-medium tracking-wide uppercase md:table-cell">
                  Pengunjung
                </TableHead>
                <TableHead className="text-muted-foreground hidden text-right text-xs font-medium tracking-wide uppercase lg:table-cell">
                  Total
                </TableHead>
                <TableHead className="text-muted-foreground hidden text-xs font-medium tracking-wide uppercase lg:table-cell">
                  Diperbarui
                </TableHead>
                <TableHead className="w-12 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const busy = busyId === p.id;
                return (
                  <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined} className={busy ? "opacity-60" : undefined}>
                    {canWrite && (
                      <TableCell className="w-10 pl-5">
                        <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={`Pilih ${p.title}`} />
                      </TableCell>
                    )}
                    <TableCell className={`max-w-[28rem] ${canWrite ? "" : "pl-5"}`}>
                      <Link
                        href={`/dashboard/blog/${p.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                        title={p.title}
                      >
                        {p.title}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        <span className="font-mono">/blog/{p.slug}</span>
                        {p.category && <> · {p.category.name}</>}
                      </p>
                    </TableCell>
                    <TableCell>
                      <BlogStatusBadge status={p.status} />
                      {p.publishedAt && (p.status === "PUBLISHED" || p.status === "SCHEDULED") && (
                        <p className="text-muted-foreground mt-1 text-xs">{formatDateShort(p.publishedAt)}</p>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right text-sm font-medium">
                      {p.rangeViews === 0 ? (
                        <span className="text-muted-foreground font-normal">0</span>
                      ) : (
                        formatInt(p.rangeViews)
                      )}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground hidden text-right text-sm md:table-cell">
                      {formatInt(p.rangeVisitors)}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground hidden text-right text-sm lg:table-cell">
                      {formatInt(p.viewCount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                      {formatDateShort(p.updatedAt)}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Aksi untuk ${p.title}`} disabled={busy}>
                            <IconDots className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/blog/${p.id}`}>
                              <IconPencil className="size-4" /> {canWrite ? "Edit" : "Lihat"}
                            </Link>
                          </DropdownMenuItem>
                          {p.status === "PUBLISHED" && (
                            <DropdownMenuItem asChild>
                              <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer">
                                <IconExternalLink className="size-4" /> Lihat di situs
                              </a>
                            </DropdownMenuItem>
                          )}
                          {canWrite && (
                            <>
                              <DropdownMenuSeparator />
                              {(p.status === "DRAFT" || p.status === "ARCHIVED") && (
                                <DropdownMenuItem onSelect={() => void changeStatus(p, "PUBLISHED", "Artikel diterbitkan")}>
                                  <IconEye className="size-4" /> Terbitkan
                                </DropdownMenuItem>
                              )}
                              {(p.status === "PUBLISHED" || p.status === "SCHEDULED") && (
                                <DropdownMenuItem onSelect={() => void changeStatus(p, "DRAFT", "Artikel dijadikan privat")}>
                                  <IconEyeOff className="size-4" /> Jadikan privat (draft)
                                </DropdownMenuItem>
                              )}
                              {p.status !== "ARCHIVED" && (
                                <DropdownMenuItem onSelect={() => void changeStatus(p, "ARCHIVED", "Artikel diarsipkan")}>
                                  <IconArchive className="size-4" /> Arsipkan
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTargets([p])}>
                                <IconTrash className="size-4" /> Hapus
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </>
        )}
      </SectionCard>

      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(open) => !open && !bulkBusy && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargets.length > 1 ? `Hapus ${deleteTargets.length} artikel permanen?` : "Hapus artikel ini permanen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargets.length > 1 ? `${deleteTargets.length} artikel terpilih` : `“${deleteTargets[0]?.title ?? ""}”`} beserta
              seluruh riwayat tampilannya akan dihapus dan tidak bisa dikembalikan. URL-nya akan menjadi 404. Untuk menyembunyikan tanpa kehilangan data, gunakan <strong>Arsipkan</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} disabled={bulkBusy} onClick={() => void confirmDelete()}>
              Hapus permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
