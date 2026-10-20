import { describe, expect, it } from "vitest";
import { blogPostingSchema, serializeSchema } from "./structured-data";

describe("serializeSchema", () => {
  const evil = {
    "@context": "https://schema.org" as const,
    "@type": "BlogPosting",
    headline: "</script><script>alert(1)</script>",
  };

  it("tidak pernah memuat '<' mentah, sehingga tidak bisa menutup tag <script>", () => {
    const out = serializeSchema(evil);
    expect(out).not.toContain("<");
    expect(out.toLowerCase()).not.toContain("</script");
  });

  it("tetap JSON valid dan nilainya kembali utuh setelah di-parse", () => {
    const parsed = JSON.parse(serializeSchema(evil)) as { headline: string };
    expect(parsed.headline).toBe("</script><script>alert(1)</script>");
  });

  it("meng-escape pemisah baris U+2028/U+2029", () => {
    const sep = String.fromCharCode(0x2028) + String.fromCharCode(0x2029);
    const out = serializeSchema({ ...evil, headline: `a${sep}b` });
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect((JSON.parse(out) as { headline: string }).headline).toBe(`a${sep}b`);
  });

  it("mendukung array schema", () => {
    const out = serializeSchema([evil, evil]);
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toHaveLength(2);
  });
});

describe("blogPostingSchema", () => {
  it("memakai @id organisasi sebagai penulis & penerbit, tanpa nama staf", () => {
    const s = blogPostingSchema({
      headline: "Judul",
      description: "Deskripsi",
      url: "https://pusatvalasindo.com/blog/judul",
      datePublished: "2026-10-20T00:00:00.000Z",
      dateModified: "2026-10-21T00:00:00.000Z",
    }) as Record<string, unknown>;
    expect(s["@type"]).toBe("BlogPosting");
    expect(s.author).toEqual({ "@id": expect.stringContaining("#organization") });
    expect(s.publisher).toEqual(s.author);
    expect(s.mainEntityOfPage).toEqual({ "@type": "WebPage", "@id": "https://pusatvalasindo.com/blog/judul" });
  });
});
