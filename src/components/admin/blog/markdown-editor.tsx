"use client";

import { useRef, useState } from "react";
import {
  IconBold,
  IconCode,
  IconEye,
  IconH2,
  IconH3,
  IconItalic,
  IconLink,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconPencil,
  IconPhoto,
  IconQuote,
  type Icon,
} from "@tabler/icons-react";

import { Markdown } from "@/components/blog/markdown";
import { cn } from "@/lib/utils";

/**
 * Editor Markdown: textarea + toolbar snippet + toggle Tulis/Pratinjau. Isinya
 * disimpan sebagai Markdown murni (bukan JSON block), sama seperti MarkdownEditor
 * di Zemetia Studio — jadi artikel bisa dibaca, di-diff, dan diedit lewat MCP
 * tanpa konversi.
 */

type Mode = "write" | "preview";

interface Snippet {
  icon: Icon;
  title: string;
  /** Membungkus pilihan: [sebelum, sesudah]. */
  wrap?: [string, string];
  /** Alih-alih membungkus, awali setiap baris terpilih (daftar, judul, kutipan). */
  linePrefix?: (index: number) => string;
  placeholder?: string;
}

const SNIPPETS: Snippet[] = [
  { icon: IconH2, title: "Judul bagian (H2)", linePrefix: () => "## ", placeholder: "Judul bagian" },
  { icon: IconH3, title: "Sub-judul (H3)", linePrefix: () => "### ", placeholder: "Sub-judul" },
  { icon: IconBold, title: "Tebal (Ctrl+B)", wrap: ["**", "**"], placeholder: "teks tebal" },
  { icon: IconItalic, title: "Miring (Ctrl+I)", wrap: ["_", "_"], placeholder: "teks miring" },
  { icon: IconCode, title: "Kode", wrap: ["`", "`"], placeholder: "kode" },
  { icon: IconLink, title: "Tautan (Ctrl+K)", wrap: ["[", "](https://)"], placeholder: "teks tautan" },
  { icon: IconPhoto, title: "Gambar", wrap: ["![", "](https://)"], placeholder: "deskripsi gambar" },
  { icon: IconList, title: "Daftar poin", linePrefix: () => "- ", placeholder: "item" },
  { icon: IconListNumbers, title: "Daftar bernomor", linePrefix: (i) => `${i + 1}. `, placeholder: "item" },
  { icon: IconListCheck, title: "Daftar centang", linePrefix: () => "- [ ] ", placeholder: "item" },
  { icon: IconQuote, title: "Kutipan", linePrefix: () => "> ", placeholder: "kutipan" },
];

const TAB = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors";

export function MarkdownEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
  minHeightClass = "min-h-[28rem]",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeightClass?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<Mode>("write");

  function apply(snippet: Snippet) {
    const el = ref.current;
    if (!el || disabled) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const fallback = snippet.placeholder ?? "";

    let next: string;
    let selStart: number;
    let selEnd: number;

    if (snippet.linePrefix) {
      // Perluas pilihan ke batas baris penuh agar awalan selalu menempel di awal baris.
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const nl = value.indexOf("\n", end);
      const lineEnd = nl === -1 ? value.length : nl;
      const block = value.slice(lineStart, lineEnd) || fallback;
      const prefixed = block
        .split("\n")
        .map((line, i) => `${snippet.linePrefix?.(i) ?? ""}${line}`)
        .join("\n");
      next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
      selStart = lineStart;
      selEnd = lineStart + prefixed.length;
    } else {
      const [before, after] = snippet.wrap ?? ["", ""];
      const selected = value.slice(start, end) || fallback;
      next = value.slice(0, start) + before + selected + after + value.slice(end);
      // Pilihan tetap menandai teksnya, jadi bisa langsung diketik ulang.
      selStart = start + before.length;
      selEnd = selStart + selected.length;
    }

    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    const key = e.key.toLowerCase();
    const shortcut = key === "b" ? "Tebal" : key === "i" ? "Miring" : key === "k" ? "Tautan" : null;
    if (!shortcut) return;
    const snippet = SNIPPETS.find((s) => s.title.startsWith(shortcut));
    if (!snippet) return;
    e.preventDefault();
    apply(snippet);
  }

  return (
    <div className="overflow-hidden">
      <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Format Markdown">
          {SNIPPETS.map((snippet) => (
            <button
              key={snippet.title}
              type="button"
              title={snippet.title}
              aria-label={snippet.title}
              onClick={() => apply(snippet)}
              disabled={disabled || mode === "preview"}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5 transition-colors disabled:opacity-30"
            >
              <snippet.icon className="size-4" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5" role="tablist" aria-label="Mode editor">
          {(
            [
              ["write", "Tulis", IconPencil],
              ["preview", "Pratinjau", IconEye],
            ] as const
          ).map(([m, label, Ico]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(TAB, mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <Ico className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          spellCheck
          placeholder={placeholder ?? "Markdown didukung — ## judul, **tebal**, `kode`, - daftar, [tautan](url)"}
          className={cn(
            "placeholder:text-muted-foreground/60 w-full resize-y bg-transparent px-5 py-4 font-mono text-sm leading-7 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
            minHeightClass
          )}
        />
      ) : (
        <div className={cn("bg-white px-6 py-6", minHeightClass)}>
          {value.trim() ? (
            <Markdown content={value} />
          ) : (
            <p className="text-muted-foreground text-sm italic">Belum ada isi untuk dipratinjau.</p>
          )}
        </div>
      )}
    </div>
  );
}
