"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconCheck, IconLoader2, IconPencil, IconPlus, IconTag, IconTrash, IconX } from "@tabler/icons-react";

import { EmptyState, SectionCard } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter } from "@/i18n/routing";
import { formatInt } from "@/lib/blog/format";

import { blogApi, type BlogCategoryDTO } from "./api";

export function BlogCategoriesClient({ categories, canWrite }: { categories: BlogCategoryDTO[]; canWrite: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      await blogApi("/api/blog/categories", {
        method: "POST",
        body: JSON.stringify({ name, description: description || null }),
      });
      toast.success("Kategori dibuat");
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat kategori");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(c: BlogCategoryDTO) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDescription(c.description ?? "");
  }

  async function saveEdit(c: BlogCategoryDTO) {
    setBusyId(c.id);
    try {
      await blogApi(`/api/blog/categories/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, description: editDescription || null }),
      });
      toast.success("Kategori disimpan");
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan kategori");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: BlogCategoryDTO) {
    setBusyId(c.id);
    try {
      await blogApi(`/api/blog/categories/${c.id}`, { method: "DELETE" });
      toast.success("Kategori dihapus");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus kategori");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {canWrite && (
        <SectionCard title="Kategori baru" description="Slug dibuat otomatis dari nama.">
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
            <div>
              <Label htmlFor="cat-name">Nama</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mis. Tips Valas"
                maxLength={60}
                required
                minLength={2}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">Deskripsi (opsional)</Label>
              <Input
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Satu kalimat tentang isi kategori ini"
                maxLength={200}
                className="mt-1.5"
              />
            </div>
            <Button type="submit" disabled={creating || name.trim().length < 2}>
              {creating ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlus className="size-4" />} Tambah
            </Button>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Semua kategori" padded={false}>
        {categories.length === 0 ? (
          <EmptyState
            icon={<IconTag className="size-5" />}
            title="Belum ada kategori"
            description="Kategori mengelompokkan artikel dan tampil sebagai label di kartu artikel."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground pl-5 text-xs font-medium tracking-wide uppercase">Nama</TableHead>
                <TableHead className="text-muted-foreground hidden text-xs font-medium tracking-wide uppercase md:table-cell">Slug</TableHead>
                <TableHead className="text-muted-foreground text-right text-xs font-medium tracking-wide uppercase">Artikel</TableHead>
                {canWrite && <TableHead className="w-28 pr-5" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => {
                const editing = editingId === c.id;
                const busy = busyId === c.id;
                return (
                  <TableRow key={c.id} className={busy ? "opacity-60" : undefined}>
                    <TableCell className="pl-5">
                      {editing ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            aria-label="Nama kategori"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={60}
                            className="h-8 sm:max-w-48"
                          />
                          <Input
                            aria-label="Deskripsi kategori"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            maxLength={200}
                            placeholder="Deskripsi"
                            className="h-8"
                          />
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium">{c.name}</p>
                          {c.description && <p className="text-muted-foreground mt-0.5 text-xs">{c.description}</p>}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden font-mono text-xs md:table-cell">{c.slug}</TableCell>
                    <TableCell className="tabular text-right text-sm">{formatInt(c.postCount)}</TableCell>
                    {canWrite && (
                      <TableCell className="pr-5">
                        <div className="flex justify-end gap-1">
                          {editing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label="Simpan"
                                disabled={busy || editName.trim().length < 2}
                                onClick={() => void saveEdit(c)}
                              >
                                <IconCheck className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8" aria-label="Batal" onClick={() => setEditingId(null)}>
                                <IconX className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${c.name}`} onClick={() => startEdit(c)}>
                                <IconPencil className="size-4" />
                              </Button>
                              <DeleteConfirmDialog
                                title={`Hapus kategori “${c.name}”?`}
                                description={
                                  c.postCount > 0
                                    ? `${formatInt(c.postCount)} artikel di kategori ini tidak ikut terhapus — hanya menjadi tanpa kategori.`
                                    : "Kategori ini belum dipakai artikel mana pun."
                                }
                                loading={busy}
                                onConfirm={() => void remove(c)}
                                trigger={
                                  <Button variant="ghost" size="icon" className="text-destructive size-8" aria-label={`Hapus ${c.name}`}>
                                    <IconTrash className="size-4" />
                                  </Button>
                                }
                              />
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
