"use client";

import { IconLock, IconPencil, IconScale } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionCard } from "@/components/admin/page-shell";
import { PayrollRuleSheet } from "./payroll-rule-sheet";
import type { RuleSetView, RuleView } from "@/backend/services/payroll-rule.service";

const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function money(n: number) {
  return `${n < 0 ? "−" : ""}Rp ${rupiah.format(Math.abs(n))}`;
}

/**
 * Rule tidak punya tipe lagi — arahnya milik tiap tier. Badge karena itu
 * meringkas SISI MANA SAJA yang dipunyai rule, dan sebuah rule yang memberi
 * bonus sekaligus memotong memang menampilkan keduanya.
 */
function arahRule(tiers: RuleView["tiers"]): ("Reward" | "Denda")[] {
  const nilai = (t: RuleView["tiers"][number]) => t.nominal ?? t.perUnit ?? 0;
  const out: ("Reward" | "Denda")[] = [];
  if (tiers.some((t) => nilai(t) > 0 || (t.formula !== null && t.nominal === null))) {
    out.push("Reward");
  }
  if (tiers.some((t) => nilai(t) < 0)) out.push("Denda");
  return out.length ? out : ["Reward"];
}

/**
 * Apa yang dilakukan sebuah kondisi kalau terpenuhi.
 *
 * Sebelumnya baris ini selalu tertulis "dilewati" karena `skip` memang satu-
 * satunya aksi. Sejak `terapkan` ada, kalimat itu menjadi keliru untuk kondisi
 * yang justru MEMBAYAR — dan halaman ini yang dipakai HR memeriksa rule sebelum
 * payroll dijalankan.
 */
function aksiGuard(g: RuleView["guards"][number]): string {
  if (g.aksi !== "terapkan") return "rule dilewati";
  if (g.formula !== undefined) return `dihitung dari ${g.formula}`;
  const n = g.nominal ?? 0;
  if (n === 0) return "tanpa nominal";
  return `${n > 0 ? "+" : "−"}Rp ${new Intl.NumberFormat("id-ID").format(Math.abs(n))}`;
}

/** Nominal tier dalam satu frasa — angka dan cara menghitungnya tidak dipisah. */
function tierAmount(t: RuleView["tiers"][number]) {
  if (t.kind === "per_unit") return `${money(t.perUnit ?? 0)} × ${t.unitField}`;
  if (t.kind === "formula") return t.formula ?? "—";
  return money(t.nominal ?? 0);
}

export function PayrollRulesPageClient({
  set,
  canWrite,
  canEditSql,
}: {
  set: RuleSetView;
  canWrite: boolean;
  canEditSql: boolean;
}) {
  const addButton = canWrite ? (
    <PayrollRuleSheet canEditSql={canEditSql} trigger={<Button size="sm">+ Rule Baru</Button>} />
  ) : null;

  return (
    <>
      {/* Peringatan setup ditampilkan di halaman, bukan disembunyikan di log:
          tanpa dua env ini rule TIDAK jalan, dan gejalanya di slip gaji hanya
          berupa reward/denda yang hilang tanpa penjelasan. */}
      {!set.setup.signingKey && (
        <SetupWarning
          title="PAYROLL_RULE_SIGNING_KEY belum diset"
          body="Rule tidak bisa ditandatangani maupun diverifikasi, jadi seluruhnya ditolak engine dan tidak bisa disimpan. Isi env ini lalu simpan ulang tiap rule."
        />
      )}
      {!set.setup.viewOnlyConnection && (
        <SetupWarning
          title="DATABASE_VIEW_ONLY_URL belum diset"
          body="Query rule hanya boleh berjalan lewat koneksi read-only ke view hv_*. Selama env ini kosong, setiap rule gagal dengan status ERROR — engine sengaja tidak jatuh balik ke koneksi aplikasi."
        />
      )}

      {set.broken.length > 0 && (
        <SectionCard title="Rule tidak bisa dibaca" description="Baris di bawah dilewati seluruhnya.">
          <ul className="space-y-3">
            {set.broken.map((b) => (
              <li key={b.file}>
                <p className="font-mono text-xs font-medium">{b.file}</p>
                <ul className="text-destructive mt-1 space-y-0.5 text-xs">
                  {b.errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {set.rules.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={<IconScale className="size-5" />}
            title="Belum ada rule"
            description="Tambahkan rule reward atau denda pertama. Contoh siap pakai tersedia di config/payroll-rules/contoh/, lengkap dengan catatan apa yang harus diputuskan sebelum diaktifkan."
            action={addButton}
          />
        </SectionCard>
      ) : (
        <>
          {addButton && <div className="flex justify-end">{addButton}</div>}
          {set.rules.map((r) => (
            <RuleCard
              key={r.rowId}
              rule={r}
              canWrite={canWrite}
              canEditSql={canEditSql}
            />
          ))}
        </>
      )}
    </>
  );
}

function SetupWarning({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-destructive/30 bg-destructive/5 rounded-xl border px-5 py-4">
      <p className="text-destructive text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm text-pretty">{body}</p>
    </div>
  );
}

function RuleCard({
  rule: r,
  canWrite,
  canEditSql,
}: {
  rule: RuleView;
  canWrite: boolean;
  canEditSql: boolean;
}) {
  const invalid = r.errors.length > 0;

  return (
    <SectionCard
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{r.id}</span>
          <span className="text-muted-foreground font-normal">v{r.versi}</span>
        </span>
      }
      description={
        <>
          {r.mode === "agregat"
            ? "Dinilai sekali dari total sebulan"
            : "Dinilai per kejadian, lalu dijumlahkan"}{" "}
          · berlaku {r.berlakuDari} s/d {r.berlakuSampai ?? "seterusnya"}
        </>
      }
      action={
        <>
          {arahRule(r.tiers).map((a) => (
            <Badge key={a} variant={a === "Reward" ? "success" : "warning"}>
              {a}
            </Badge>
          ))}
          {invalid ? (
            <Badge variant="danger">Tidak dihitung</Badge>
          ) : r.aktif ? (
            <Badge variant="info">Berlaku</Badge>
          ) : (
            <Badge variant="soft">Di luar masa berlaku</Badge>
          )}
          {!r.isLatest && <Badge variant="soft">Versi lama</Badge>}
          {canWrite && r.isLatest && (
            <PayrollRuleSheet
              rule={r}
              canEditSql={canEditSql}
              trigger={
                <Button size="sm" variant="outline">
                  <IconPencil className="size-4" /> Ubah
                </Button>
              }
            />
          )}
        </>
      }
    >
      <div className="space-y-5">
        {invalid && (
          <div className="border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-3">
            <p className="text-destructive text-xs font-semibold">
              Rule ini dilewati engine sampai errornya diperbaiki
            </p>
            <ul className="text-destructive mt-1.5 space-y-0.5 text-xs">
              {r.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          </div>
        )}

        {r.warnings.length > 0 && (
          <div className="border-warning/30 bg-warning-muted/40 rounded-lg border px-4 py-3">
            <p className="text-warning-foreground text-xs font-semibold">
              Perlu diperiksa — rule tetap dihitung
            </p>
            <ul className="text-muted-foreground mt-1.5 space-y-0.5 text-xs">
              {r.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </div>
        )}

        {r.catatan && (
          <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed text-pretty">
            {r.catatan}
          </p>
        )}

        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Tabel Nilai — dicocokkan pada <span className="font-mono">{r.tierField}</span>
          </p>
          <ul className="mt-3 divide-y">
            {r.tiers.map((t, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5"
              >
                <span className="min-w-0">
                  <span className="tabular text-sm font-medium">{t.rangeLabel}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{t.label}</span>
                  {/* Sanksi non-uang adalah konsekuensi nyata bagi karyawan —
                      kalau tidak tampil di sini, satu-satunya jejaknya cuma
                      teks di dalam label, yang bisa hilang saat label disunting. */}
                  {t.mandatorySaturday && (
                    <Badge variant="warning" className="ml-2 text-[11px]">
                      Wajib Sabtu
                    </Badge>
                  )}
                  {t.warningLetter && (
                    <Badge variant="danger" className="ml-2 text-[11px]">
                      SP
                    </Badge>
                  )}
                </span>
                <span
                  className={`tabular text-sm font-medium ${
                    t.kind === "formula" ? "text-muted-foreground font-mono text-xs" : ""
                  }`}
                >
                  {tierAmount(t)}
                </span>
              </li>
            ))}
            <li className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5">
              <span>
                <span className="text-muted-foreground text-sm">Tidak cocok baris mana pun</span>
                <span className="text-muted-foreground ml-2 text-xs">{r.defaultLabel}</span>
              </span>
              {r.defaultFlag && (
                <Badge variant="soft" className="font-mono text-[11px]">
                  {r.defaultFlag}
                </Badge>
              )}
            </li>
          </ul>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Sasaran
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {r.sasaran.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
              {r.kecuali.map((s, i) => (
                <li key={`x${i}`} className="text-destructive">
                  kecuali — {s}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Kondisi
            </p>
            {r.guards.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Tidak ada — Tabel Nilai selalu dinilai.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs">
                {r.guards.map((g, i) => (
                  <li key={i}>
                    <span className="font-mono">{g.if}</span>
                    <span className="text-muted-foreground"> → {aksiGuard(g)}, flag </span>
                    <span className="font-mono">{g.flag}</span>
                  </li>
                ))}
              </ul>
            )}

            {r.konstanta.length > 0 && (
              <>
                <p className="text-muted-foreground mt-4 text-xs font-medium tracking-wide uppercase">
                  Konstanta
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {r.konstanta.map((k) => (
                    <li key={k.nama}>
                      <span className="font-mono">{k.nama}</span>
                      <span className="text-muted-foreground"> = </span>
                      <span className="tabular">{rupiah.format(k.nilai)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <details className="group">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-xs font-medium tracking-wide uppercase">
            Query sumber data
            {!canEditSql && (
              <IconLock className="ml-1 inline size-3 align-[-1px]" aria-label="terkunci" />
            )}
            <span className="ml-1 font-normal normal-case group-open:hidden">— tampilkan</span>
            <span className="ml-1 hidden font-normal normal-case group-open:inline">
              — sembunyikan
            </span>
          </summary>
          <pre className="bg-muted/40 text-muted-foreground mt-2 overflow-x-auto rounded-lg px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {r.sql}
          </pre>
        </details>
      </div>
    </SectionCard>
  );
}
