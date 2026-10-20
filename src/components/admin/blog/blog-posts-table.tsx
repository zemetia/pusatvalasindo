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
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import { EmptyState, SectionCard, ToolbarSpacer } from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { SegmentedFilter } from "@/components/admin/segmented-filter";
import { Button } from "@/components/ui/button";
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
  const [deleteTarget, setDeleteTarget] = useState<BlogPostRowDTO | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false;
      if (categoryId === "none" && p.category) return false;
      if (categoryId !== "ALL" && categoryId !== "none" && p.category?.id !== categoryId) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });
  }, [posts, search, status, categoryId]);

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
    const target = deleteTarget;
    if (!target) return;
    setBusyId(target.id);
    try {
      await blogApi(`/api/blog/posts/${target.id}`, { method: "DELETE" });
      toast.success("Artikel dihapus");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus artikel");
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
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
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground pl-5 text-xs font-medium tracking-wide uppercase">Artikel</TableHead>
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
                  <TableRow key={p.id} className={busy ? "opacity-60" : undefined}>
                    <TableCell className="max-w-[28rem] pl-5">
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
                                <DropdownMenuItem onSelect={() => void changeStatus(p, "DRAFT", "Dikembalikan ke draft")}>
                                  <IconEyeOff className="size-4" /> Kembalikan ke draft
                                </DropdownMenuItem>
                              )}
                              {p.status !== "ARCHIVED" && (
                                <DropdownMenuItem onSelect={() => void changeStatus(p, "ARCHIVED", "Artikel diarsipkan")}>
                                  <IconArchive className="size-4" /> Arsipkan
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(p)}>
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
        )}
      </SectionCard>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus artikel ini permanen?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” beserta seluruh riwayat tampilannya akan dihapus dan tidak bisa dikembalikan. URL-nya
              akan menjadi 404. Untuk menyembunyikan tanpa kehilangan data, gunakan <strong>Arsipkan</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => void confirmDelete()}>
              Hapus permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
