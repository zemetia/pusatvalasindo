"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconArrowsMaximize, IconArrowsMinimize } from "@tabler/icons-react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useTheme } from "next-themes";
import "@blocknote/mantine/style.css";

import { countWords, readingMinutes } from "@/lib/blog/content";
import { cn } from "@/lib/utils";

/**
 * Editor visual (BlockNote): penulis melihat hasil akhir langsung, tanpa sintaks Markdown.
 * Ketik "/" untuk menyisipkan judul, daftar, tabel, kode, atau gambar.
 *
 * Penyimpanan tetap Markdown murni: nilai dikonversi ke Markdown setiap perubahan,
 * jadi halaman publik, MCP, dan diff tidak berubah. `value` hanya dibaca sekali saat
 * dimuat; setelah itu editor menjadi sumber kebenaran (komponen dimuat ulang lewat `key`
 * bila artikelnya berganti).
 */
export function RichEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const editor = useCreateBlockNote({ domAttributes: { editor: { "aria-label": "Isi artikel" } } });
  const [ready, setReady] = useState(false);
  const [full, setFull] = useState(false);
  const [stats, setStats] = useState(value);

  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  // Muat Markdown awal ke dalam editor sekali saja.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (value.trim()) {
        const blocks = await editor.tryParseMarkdownToBlocks(value);
        if (cancelled) return;
        editor.replaceBlocks(editor.document, blocks);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya nilai awal
  }, [editor]);

  // Mode layar penuh: kunci scroll halaman & keluar dengan Esc.
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const words = countWords(stats);

  return (
    <div className={cn("flex flex-col bg-card", full && "bg-background fixed inset-0 z-50")}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-1.5">
        <span className="text-muted-foreground text-xs">
          Ketik <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.7rem]">/</kbd> untuk menyisipkan judul, daftar, tabel, kode, atau gambar
        </span>
        <button
          type="button"
          onClick={() => setFull((f) => !f)}
          title={full ? "Keluar layar penuh (Esc)" : "Layar penuh"}
          aria-label={full ? "Keluar layar penuh" : "Layar penuh"}
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors"
        >
          {full ? <IconArrowsMinimize className="size-4" /> : <IconArrowsMaximize className="size-4" />}
        </button>
      </div>

      <div
        className={cn(
          "blog-rich-editor min-h-0 flex-1 overflow-y-auto py-4",
          full ? "" : "h-[clamp(30rem,72vh,48rem)]",
          !ready && "pointer-events-none opacity-60"
        )}
      >
        <BlockNoteView
          editor={editor}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          editable={!disabled && ready}
          onChange={async () => {
            const md = await editor.blocksToMarkdownLossy(editor.document);
            setStats(md);
            onChangeRef.current(md);
          }}
        />
      </div>

      <div className="text-muted-foreground bg-muted/30 tabular flex items-center justify-between gap-4 border-t px-4 py-1.5 text-xs">
        <span>
          {words.toLocaleString("id-ID")} kata · ±{readingMinutes(stats)} menit baca
        </span>
        <span className="hidden sm:inline">Tersimpan sebagai Markdown</span>
      </div>
    </div>
  );
}
