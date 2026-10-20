const dateLong = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });
const dateShort = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });
const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

/** Zona waktu dikunci ke WIB supaya render server & klien identik (tanpa hydration mismatch). */
export const formatDateLong = (d: Date | string) => dateLong.format(new Date(d));
export const formatDateShort = (d: Date | string) => dateShort.format(new Date(d));
export const formatDateTime = (d: Date | string) => dateTime.format(new Date(d));

/** 1234567 → "1.234.567" (format id-ID, sesuai aturan penyajian angka proyek). */
export const formatInt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

/** Nilai `<input type="datetime-local">` (WIB, tanpa zona) dari instan UTC. */
export function toWibInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(new Date(d).getTime() + 7 * 3600_000).toISOString().slice(0, 16);
}

/** Kebalikannya: "2026-10-21T10:00" (dianggap WIB) → ISO UTC. null bila kosong/tidak valid. */
export function fromWibInputValue(value: string): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi) - 7 * 3600_000;
  return Number.isFinite(utc) ? new Date(utc).toISOString() : null;
}
