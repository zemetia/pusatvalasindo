"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconEdit, IconFileCheck, IconLock } from "@tabler/icons-react";
import type { EmploymentStatus } from "@src/generated/prisma/client";

import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUS_HINTS,
  EMPLOYMENT_STATUS_LABELS,
  daysUntil,
  isUnderContract,
  needsContractDates,
} from "@/lib/employment";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Status ikatan kerja satu karyawan: tampilan ringkas + form pengubahnya.
 *
 * Yang ditonjolkan bukan nama statusnya, melainkan akibatnya — berhak bonus
 * atau tidak. Itulah satu-satunya hal yang dipakai mesin payroll (kolom
 * `berkontrak` di hv_employees), dan itu pula yang dicari HR ketika membuka
 * halaman ini setelah melihat slip bertuliskan "belum berkontrak".
 *
 * Penyajiannya mengikuti docs/blueprint/DATA_PRESENTATION.md: tanpa kartu per
 * nilai, hirarki lewat tipografi dan jarak, satu garis rambut sebagai pemisah.
 */

const DATE_FULL = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Ambang "kontrak segera berakhir" — cukup lama untuk sempat diperpanjang. */
const EXPIRY_WARNING_DAYS = 45;

function formatDate(key: string | null): string {
  return key ? DATE_FULL.format(new Date(`${key}T00:00:00.000Z`)) : "—";
}

export type EmploymentStatusPanelProps = {
  userId: string;
  employeeName: string;
  status: EmploymentStatus;
  /** Kunci `YYYY-MM-DD`, sudah dinormalkan di server. */
  contractStartDate: string | null;
  contractEndDate: string | null;
  /** Hari ini menurut WIB, bukan jam browser — sumbernya sama dengan halaman. */
  today: string;
  /** Tanpa ini panel tetap tampil, hanya tidak bisa diubah. */
  canEdit: boolean;
};

export function EmploymentStatusPanel({
  userId,
  employeeName,
  status,
  contractStartDate,
  contractEndDate,
  today,
  canEdit,
}: EmploymentStatusPanelProps) {
  const [open, setOpen] = useState(false);

  const underContract = isUnderContract(status, contractEndDate, today);
  const remaining = daysUntil(contractEndDate, today);
  const expiringSoon = underContract && remaining !== null && remaining <= EXPIRY_WARNING_DAYS;
  // Kontrak yang tanggalnya sudah lewat: statusnya masih PKWT, tapi haknya atas
  // bonus sudah hilang. Keadaan ini paling mudah luput, jadi dinyatakan tegas.
  const expired = status === "PKWT" && !underContract && contractEndDate !== null;

  return (
    <section className="border-b pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Status Ikatan Kerja
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span className="text-2xl font-semibold tracking-tight">
              {EMPLOYMENT_STATUS_LABELS[status]}
            </span>
            <Badge variant={underContract ? "success" : "warning"}>
              {underContract ? (
                <IconFileCheck className="size-3.5" />
              ) : (
                <IconLock className="size-3.5" />
              )}
              {underContract ? "Berhak bonus KPI" : "Bonus KPI terkunci"}
            </Badge>
          </div>

          <p className="text-muted-foreground mt-2 text-sm">
            {needsContractDates(status) ? (
              <>
                Berlaku {formatDate(contractStartDate)} —{" "}
                {contractEndDate ? formatDate(contractEndDate) : "tanpa batas waktu"}
                {expired && (
                  <span className="text-destructive font-medium">
                    {" "}
                    · sudah berakhir {Math.abs(remaining ?? 0)} hari lalu
                  </span>
                )}
                {expiringSoon && (
                  <span className="text-warning font-medium">
                    {" "}
                    · berakhir dalam {remaining} hari
                  </span>
                )}
              </>
            ) : (
              "Bonus KPI tidak dibayarkan sampai karyawan diikat kontrak PKWT atau PKWTT. Potongan & denda tetap berlaku."
            )}
          </p>
        </div>

        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <IconEdit className="size-4" />
            Ubah Status
          </Button>
        )}
      </div>

      {canEdit && (
        <EmploymentStatusDialog
          open={open}
          onOpenChange={setOpen}
          userId={userId}
          employeeName={employeeName}
          status={status}
          contractStartDate={contractStartDate}
          contractEndDate={contractEndDate}
        />
      )}
    </section>
  );
}

/* ── Form ─────────────────────────────────────────────────────────────────── */

type DialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  employeeName: string;
  status: EmploymentStatus;
  contractStartDate: string | null;
  contractEndDate: string | null;
};

/**
 * Pembungkusnya sengaja hanya berisi Dialog. Isi formnya komponen terpisah yang
 * dirender di dalam DialogContent — dan Radix melepas DialogContent saat
 * tertutup, jadi form-nya terpasang ulang setiap dibuka. Itulah yang membuat
 * "batal lalu buka lagi" selalu memulai dari data tersimpan, tanpa perlu efek
 * yang menyalin prop ke state.
 */
function EmploymentStatusDialog({ open, onOpenChange, ...rest }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <EmploymentStatusForm {...rest} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function EmploymentStatusForm({
  onOpenChange,
  userId,
  employeeName,
  status,
  contractStartDate,
  contractEndDate,
}: Omit<DialogProps, "open">) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EmploymentStatus>(status);
  const [start, setStart] = useState(contractStartDate ?? "");
  const [end, setEnd] = useState(contractEndDate ?? "");

  const withDates = needsContractDates(draft);

  // Aturannya sama persis dengan yang ditegakkan API — di sini hanya supaya
  // kesalahannya terlihat sebelum tombol ditekan, bukan sebagai pengganti.
  const error = !withDates
    ? null
    : !start
      ? "Tanggal mulai kontrak wajib diisi."
      : draft === "PKWT" && !end
        ? "PKWT wajib punya tanggal berakhir — tanpa itu kontraknya terbaca tak berbatas waktu."
        : end && end < start
          ? "Tanggal berakhir tidak boleh mendahului tanggal mulai."
          : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employmentStatus: draft,
          contractStartDate: withDates ? start : null,
          contractEndDate: withDates && end ? end : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan status ikatan kerja");
        return;
      }
      toast.success(`Status ${employeeName} diperbarui`);
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Status Ikatan Kerja</DialogTitle>
        <DialogDescription>
          Menentukan apakah {employeeName} berhak atas bonus KPI. Potongan dan denda tetap berlaku
          pada status apa pun.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-5 space-y-4">
        <div role="radiogroup" aria-label="Status ikatan kerja" className="grid gap-2">
          {EMPLOYMENT_STATUSES.map((opt) => {
            const active = draft === opt;
            return (
              <button
                type="button"
                key={opt}
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setDraft(opt);
                  // PKWTT berarti tanpa batas waktu — tanggal berakhir yang
                  // tersisa dari pilihan sebelumnya akan ikut terkirim dan
                  // diam-diam mencabut bonus di kemudian hari.
                  if (opt === "PKWTT") setEnd("");
                }}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/30 hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    active ? "border-primary" : "border-muted-foreground/40",
                  )}
                >
                  {active && <span className="bg-primary size-2 rounded-full" />}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {EMPLOYMENT_STATUS_LABELS[opt]}
                    {needsContractDates(opt) ? (
                      <Badge variant="success">bonus aktif</Badge>
                    ) : (
                      <Badge variant="soft">tanpa bonus</Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                    {EMPLOYMENT_STATUS_HINTS[opt]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {withDates && (
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="contract-start"
                className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
              >
                Mulai Kontrak
              </Label>
              <Input
                id="contract-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="contract-end"
                className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
              >
                Berakhir {draft === "PKWTT" && "(opsional)"}
              </Label>
              <Input
                id="contract-end"
                type="date"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
                disabled={draft === "PKWTT"}
                placeholder="Tanpa batas"
              />
            </div>
          </div>
        )}

        {error && <p className="text-destructive text-xs font-medium">{error}</p>}
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" disabled={saving || Boolean(error)}>
          {saving ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
