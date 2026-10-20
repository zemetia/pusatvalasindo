"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  IconArchive,
  IconArrowLeft,
  IconDeviceFloppy,
  IconExternalLink,
  IconLoader2,
  IconSend,
} from "@tabler/icons-react";

import { MarkdownEditor } from "./markdown-editor";
import { MetricInline, PageHeader, PageShell, SectionCard } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/routing";
import { countWords, readingMinutes } from "@/lib/blog/content";
import { formatDateLong, formatInt, fromWibInputValue, toWibInputValue } from "@/lib/blog/format";
import { slugify } from "@/lib/blog/slug";
import type { BlogDisplayStatus } from "@/lib/blog/status";

import { blogApi, type BlogCategoryDTO } from "./api";
import { BlogStatusBadge } from "./blog-status-badge";

export type BlogEditorPostDTO = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  categoryId: string | null;
  status: BlogDisplayStatus;
  publishedAt: string | null;
  viewCount: number;
};

export type BlogEditorStatsDTO = {
  days: number;
  views: number;
  visitors: number;
  viewsDelta: number | null;
  allTimeViews: number;
  referrers: { source: string | null; views: number }[];
};

type Form = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  coverImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  categoryId: string;
  /** Nilai <input type="datetime-local"> dalam WIB; "" = belum diatur. */
  publishAt: string;
};

const EMPTY: Form = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  coverImageAlt: "",
  metaTitle: "",
  metaDescription: "",
  categoryId: "",
  publishAt: "",
};

function formFromPost(p: BlogEditorPostDTO): Form {
  return {
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    content: p.content,
    coverImageUrl: p.coverImageUrl ?? "",
    coverImageAlt: p.coverImageAlt ?? "",
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
    categoryId: p.categoryId ?? "",
    publishAt: toWibInputValue(p.publishedAt),
  };
}

type Action = "save" | "publish" | "draft" | "archive";

/** Penghitung karakter yang berubah amber saat melewati batas ideal SERP dan merah saat melewati batas keras. */
function Counter({ value, ideal, max }: { value: number; ideal?: number; max: number }) {
  const tone = value > max ? "text-destructive" : ideal && value > ideal ? "text-warning" : "text-muted-foreground";
  return (
    <span className={`tabular text-xs ${tone}`}>
      {value}/{max}
    </span>
  );
}

const FIELD_CLS = "mt-1.5";

export function BlogPostEditor({
  post,
  categories,
  stats,
  canWrite,
}: {
  post: BlogEditorPostDTO | null;
  categories: BlogCategoryDTO[];
  stats: BlogEditorStatsDTO | null;
  canWrite: boolean;
}) {
  const router = useRouter();

  const [postId, setPostId] = useState<string | null>(post?.id ?? null);
  const [status, setStatus] = useState<BlogDisplayStatus>(post?.status ?? "DRAFT");
  const [publishedAt, setPublishedAt] = useState<string | null>(post?.publishedAt ?? null);
  const [saved, setSaved] = useState<Form>(post ? formFromPost(post) : EMPTY);
  const [form, setForm] = useState<Form>(post ? formFromPost(post) : EMPTY);
  // Slug mengikuti judul sampai penulis mengeditnya sendiri. Artikel yang sudah ada
  // tidak pernah di-slug ulang otomatis — itu akan mengubah URL yang sudah terindeks.
  const [slugTouched, setSlugTouched] = useState<boolean>(!!post);
  const [busy, setBusy] = useState<Action | null>(null);
  // Penanda waktu untuk label tombol ("Jadwalkan" vs "Terbitkan"). Diambil sekali lewat initializer
  // malas — tanpa Date.now() di badan render atau setState di effect. Hanya memengaruhi LABEL; status
  // sebenarnya selalu diputuskan server saat menyimpan.
  const [now] = useState(() => Date.now());

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const live = status === "PUBLISHED" || status === "SCHEDULED";
  const readOnly = !canWrite;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  function onTitleChange(title: string) {
    setForm((f) => ({ ...f, title, ...(slugTouched ? {} : { slug: slugify(title) }) }));
  }

  // Peringatan sebelum meninggalkan halaman dengan perubahan yang belum disimpan.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const submit = useCallback(
    async (action: Action) => {
      if (readOnly || busy) return;

      const title = form.title.trim();
      if (title.length < 3) return void toast.error("Judul minimal 3 karakter");
      if (form.excerpt.trim().length < 10) return void toast.error("Ringkasan minimal 10 karakter");
      if (!form.content.trim()) return void toast.error("Isi artikel wajib diisi");

      const isNew = postId === null;
      const body: Record<string, unknown> = {
        title,
        excerpt: form.excerpt.trim(),
        content: form.content,
        coverImageUrl: form.coverImageUrl.trim() || null,
        coverImageAlt: form.coverImageAlt.trim() || null,
        metaTitle: form.metaTitle.trim() || null,
        metaDescription: form.metaDescription.trim() || null,
        categoryId: form.categoryId || null,
      };

      // Artikel baru dengan slug otomatis: biarkan server memilih (ia menangani bentrok dengan -2, -3).
      // Slug hanya dikirim bila penulis mengaturnya sendiri (baru) atau mengubahnya (sudah ada).
      const slugValue = slugify(form.slug);
      if (isNew) {
        if (slugTouched && slugValue) body.slug = slugValue;
      } else if (slugValue !== saved.slug) {
        if (!slugValue) return void toast.error("Slug tidak boleh kosong");
        body.slug = slugValue;
      }

      if (action === "publish") {
        body.status = "PUBLISHED";
        const iso = fromWibInputValue(form.publishAt);
        if (iso) body.publishedAt = iso;
      } else if (action === "draft") {
        body.status = "DRAFT";
      } else if (action === "archive") {
        body.status = "ARCHIVED";
      } else if (!isNew && live && form.publishAt !== saved.publishAt) {
        // Simpan biasa pada artikel yang sudah tayang: tanggal hanya dikirim bila diubah.
        const iso = fromWibInputValue(form.publishAt);
        if (iso) body.publishedAt = iso;
      }

      setBusy(action);
      try {
        const data = await blogApi<BlogEditorPostDTO & { displayStatus: BlogDisplayStatus }>(
          isNew ? "/api/blog/posts" : `/api/blog/posts/${postId}`,
          { method: isNew ? "POST" : "PATCH", body: JSON.stringify(body) }
        );
        const next = { ...data, status: data.displayStatus };
        const nextForm = formFromPost(next);
        setSaved(nextForm);
        setForm(nextForm);
        setStatus(next.status);
        setPublishedAt(next.publishedAt);
        setPostId(next.id);
        setSlugTouched(true);

        const messages: Record<Action, string> = {
          save: "Perubahan disimpan",
          publish: next.status === "SCHEDULED" ? "Artikel dijadwalkan" : "Artikel diterbitkan",
          draft: "Dikembalikan ke draft",
          archive: "Artikel diarsipkan",
        };
        toast.success(messages[action]);
        if (isNew) router.replace(`/dashboard/blog/${next.id}`);
        else router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan artikel");
      } finally {
        setBusy(null);
      }
    },
    [readOnly, busy, form, postId, slugTouched, saved, live, router]
  );

  // Ctrl/Cmd+S menyimpan tanpa mengubah status.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void submit("save");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  const words = countWords(form.content);
  const publishDateIso = fromWibInputValue(form.publishAt);
  const isFuture = publishDateIso ? new Date(publishDateIso).getTime() > now : false;
  const slugChangedOnLive = live && postId !== null && form.slug !== saved.slug;

  const serpTitle = (form.metaTitle.trim() || form.title.trim() || "Judul artikel").slice(0, 70);
  const serpDesc = (form.metaDescription.trim() || form.excerpt.trim() || "Deskripsi artikel akan tampil di sini.").slice(0, 170);

  const savingLabel = (a: Action, label: string, icon: React.ReactNode) =>
    busy === a ? (
      <>
        <IconLoader2 className="size-4 animate-spin" /> Menyimpan…
      </>
    ) : (
      <>
        {icon} {label}
      </>
    );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Blog"
        title={postId ? "Edit artikel" : "Artikel baru"}
        description={
          readOnly
            ? "Anda hanya punya akses lihat — perubahan tidak bisa disimpan."
            : "Tulis dalam Markdown. Ctrl+S menyimpan tanpa mengubah status."
        }
        action={
          <>
            <Link href="/dashboard/blog" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
              <IconArrowLeft className="size-4" /> Semua artikel
            </Link>
            {status === "PUBLISHED" && (
              <a
                href={`/blog/${saved.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                <IconExternalLink className="size-4" /> Lihat di situs
              </a>
            )}
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── Kolom utama ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <SectionCard>
            <div>
              <Label htmlFor="blog-title">Judul</Label>
              <Input
                id="blog-title"
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Mis. Cara Tukar Dolar Aman di Jakarta"
                maxLength={160}
                disabled={readOnly}
                className={`${FIELD_CLS} h-11 text-base font-semibold`}
              />
            </div>

            <div className="mt-4">
              <Label htmlFor="blog-slug">URL (slug)</Label>
              <div className={`${FIELD_CLS} flex items-center gap-0 rounded-md border`}>
                <span className="text-muted-foreground bg-muted/50 rounded-l-md border-r px-3 py-2 text-sm select-none">/blog/</span>
                <Input
                  id="blog-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value);
                  }}
                  onBlur={() => set("slug", slugify(form.slug))}
                  placeholder="dibuat-otomatis-dari-judul"
                  disabled={readOnly}
                  className="rounded-l-none border-0 font-mono text-sm shadow-none focus-visible:ring-0"
                />
              </div>
              {slugChangedOnLive && (
                <p className="text-warning-foreground bg-warning-muted mt-2 rounded-md px-3 py-2 text-xs">
                  Artikel ini sudah tayang. Mengubah slug aman — alamat lama otomatis dialihkan (301) ke yang baru — tetapi tautan
                  yang sudah tersebar sebaiknya tetap dipertahankan jika bisa.
                </p>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="blog-excerpt">Ringkasan</Label>
                <Counter value={form.excerpt.length} max={320} />
              </div>
              <Textarea
                id="blog-excerpt"
                value={form.excerpt}
                onChange={(e) => set("excerpt", e.target.value)}
                rows={3}
                maxLength={320}
                placeholder="1–2 kalimat yang menjawab inti artikel. Tampil di kartu daftar dan menjadi deskripsi cadangan di Google."
                disabled={readOnly}
                className={FIELD_CLS}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Isi artikel"
            description={`${formatInt(words)} kata · sekitar ${readingMinutes(form.content)} menit baca`}
            padded={false}
          >
            <MarkdownEditor value={form.content} onChange={(v) => set("content", v)} disabled={readOnly} />
          </SectionCard>
        </div>

        {/* ── Kolom samping ───────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5 lg:sticky lg:top-20">
          <SectionCard title="Penerbitan" action={<BlogStatusBadge status={status} />}>
            <div className="space-y-4">
              {publishedAt && live && (
                <p className="text-muted-foreground text-xs">
                  {status === "SCHEDULED" ? "Akan tayang" : "Tayang sejak"} {formatDateLong(publishedAt)}
                </p>
              )}
              <div>
                <Label htmlFor="blog-publish-at">Tanggal terbit (WIB)</Label>
                <Input
                  id="blog-publish-at"
                  type="datetime-local"
                  value={form.publishAt}
                  onChange={(e) => set("publishAt", e.target.value)}
                  disabled={readOnly}
                  className={FIELD_CLS}
                />
                <p className="text-muted-foreground mt-1.5 text-xs">
                  Kosongkan agar langsung tayang. Isi tanggal masa depan untuk menjadwalkan — artikel muncul sendiri saat waktunya
                  tiba.
                </p>
              </div>

              {!readOnly && (
                <div className="flex flex-col gap-2">
                  {live ? (
                    <>
                      <Button onClick={() => void submit("save")} disabled={busy !== null || !dirty}>
                        {savingLabel("save", "Simpan perubahan", <IconDeviceFloppy className="size-4" />)}
                      </Button>
                      <Button variant="outline" onClick={() => void submit("draft")} disabled={busy !== null}>
                        {savingLabel("draft", "Kembalikan ke draft", <IconDeviceFloppy className="size-4" />)}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => void submit("publish")} disabled={busy !== null}>
                        {savingLabel("publish", isFuture ? "Jadwalkan" : "Terbitkan", <IconSend className="size-4" />)}
                      </Button>
                      <Button variant="outline" onClick={() => void submit("save")} disabled={busy !== null || (!dirty && postId !== null)}>
                        {savingLabel("save", "Simpan draft", <IconDeviceFloppy className="size-4" />)}
                      </Button>
                    </>
                  )}
                  {postId && status !== "ARCHIVED" && (
                    <Button variant="ghost" size="sm" onClick={() => void submit("archive")} disabled={busy !== null}>
                      {savingLabel("archive", "Arsipkan", <IconArchive className="size-4" />)}
                    </Button>
                  )}
                  {dirty && <p className="text-warning text-xs">Ada perubahan yang belum disimpan.</p>}
                </div>
              )}
            </div>
          </SectionCard>

          {stats && (
            <SectionCard title="Performa" description={`${stats.days} hari terakhir`}>
              <div className="space-y-2.5">
                <MetricInline label="Tampilan" value={formatInt(stats.views)} />
                <MetricInline label="Pengunjung" value={formatInt(stats.visitors)} />
                <MetricInline label="Total sepanjang masa" value={formatInt(stats.allTimeViews)} />
                {stats.referrers.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Sumber teratas</p>
                    <div className="space-y-1.5">
                      {stats.referrers.slice(0, 4).map((r) => (
                        <MetricInline key={r.source ?? "direct"} label={r.source ?? "Langsung / tidak diketahui"} value={formatInt(r.views)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Kategori">
            <select
              aria-label="Kategori"
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              disabled={readOnly}
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            >
              <option value="">Tanpa kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Link href="/dashboard/blog/kategori" className="text-muted-foreground hover:text-foreground mt-2 inline-block text-xs underline-offset-4 hover:underline">
              Kelola kategori
            </Link>
          </SectionCard>

          <SectionCard title="Gambar sampul" description="Tampil di kartu, di atas artikel, dan saat tautan dibagikan.">
            <div className="space-y-3">
              <div>
                <Label htmlFor="blog-cover">URL gambar</Label>
                <Input
                  id="blog-cover"
                  value={form.coverImageUrl}
                  onChange={(e) => set("coverImageUrl", e.target.value)}
                  placeholder="https://… atau /images/blog/sampul.jpg"
                  disabled={readOnly}
                  className={FIELD_CLS}
                />
                <p className="text-muted-foreground mt-1 text-xs">Rasio 1200×630 px paling ideal. Hanya https:// atau path dari situs ini.</p>
              </div>
              <div>
                <Label htmlFor="blog-cover-alt">Teks alternatif</Label>
                <Input
                  id="blog-cover-alt"
                  value={form.coverImageAlt}
                  onChange={(e) => set("coverImageAlt", e.target.value)}
                  placeholder="Deskripsi singkat isi gambar"
                  maxLength={200}
                  disabled={readOnly}
                  className={FIELD_CLS}
                />
              </div>
              {form.coverImageUrl.trim() && /^(https:\/\/|\/(?!\/))/.test(form.coverImageUrl.trim()) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.coverImageUrl.trim()}
                  alt={form.coverImageAlt || "Pratinjau sampul"}
                  className="aspect-[1200/630] w-full rounded-md border object-cover"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard title="SEO" description="Kosongkan untuk memakai judul & ringkasan.">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="blog-meta-title">Judul SEO</Label>
                  <Counter value={form.metaTitle.length} ideal={60} max={70} />
                </div>
                <Input
                  id="blog-meta-title"
                  value={form.metaTitle}
                  onChange={(e) => set("metaTitle", e.target.value)}
                  placeholder={form.title || "Sama dengan judul artikel"}
                  maxLength={70}
                  disabled={readOnly}
                  className={FIELD_CLS}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="blog-meta-desc">Deskripsi SEO</Label>
                  <Counter value={form.metaDescription.length} ideal={160} max={170} />
                </div>
                <Textarea
                  id="blog-meta-desc"
                  value={form.metaDescription}
                  onChange={(e) => set("metaDescription", e.target.value)}
                  rows={3}
                  maxLength={170}
                  placeholder={form.excerpt || "Sama dengan ringkasan"}
                  disabled={readOnly}
                  className={FIELD_CLS}
                />
              </div>
              <div className="rounded-md border bg-white p-3 text-left">
                <p className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">Pratinjau Google</p>
                <p className="truncate text-xs text-[#4d5156]">pusatvalasindo.com › blog › {form.slug || "…"}</p>
                <p className="truncate text-base leading-snug text-[#1a0dab]">{serpTitle}</p>
                <p className="line-clamp-2 text-xs leading-relaxed text-[#4d5156]">{serpDesc}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}
