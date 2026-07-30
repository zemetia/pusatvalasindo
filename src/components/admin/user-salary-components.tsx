"use client";

import { useEffect, useState } from "react";
import { NumericFormat } from "react-number-format";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote } from "lucide-react";
import { PremiumField } from "./premium-field";
import type { SalaryComponentRow } from "./salary-component-sheet";

export type SalaryComponentItem = { componentId: string; amount: number };

type AssignedRow = {
  componentId: string;
  name: string;
  kind: "ALLOWANCE" | "DEDUCTION";
  amount: number;
  isActive: boolean;
};

/**
 * Editor komponen gaji tambahan milik satu karyawan.
 *
 * State-nya diangkat ke form induk (`value`/`onChange`) supaya tersimpan dalam
 * satu aksi "Simpan" bersama data karyawan lain — bukan tombol simpan terpisah.
 *
 * Komponen yang ditawarkan: milik PT karyawan + komponen global. PT-nya diambil
 * dari pilihan form, bukan dari data tersimpan, supaya daftar ikut berubah saat
 * karyawan dipindah PT sebelum disimpan.
 */
export function UserSalaryComponents({
  userId,
  companyId,
  value,
  onChange,
}: {
  userId: string;
  companyId: string;
  value: SalaryComponentItem[];
  onChange: (items: SalaryComponentItem[]) => void;
}) {
  const [catalog, setCatalog] = useState<SalaryComponentRow[] | null>(null);
  // Mulai true, bukan diset di dalam efek: komponen ini hanya dirender saat
  // sheet terbuka, jadi mount-nya sekali dan memuatnya memang selalu tertunda.
  const [loading, setLoading] = useState(true);
  /** Tidak punya izin payroll.components — bagian ini disembunyikan saja. */
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/salary-components"),
      fetch(`/api/users/${userId}/salary-components`),
    ])
      .then(async ([catalogRes, assignedRes]) => {
        if (cancelled) return;
        if (catalogRes.status === 403 || assignedRes.status === 403) {
          setForbidden(true);
          return;
        }
        if (!catalogRes.ok || !assignedRes.ok) return;

        const catalogJson = await catalogRes.json();
        const assignedJson = await assignedRes.json();
        if (cancelled) return;

        setCatalog(catalogJson.data as SalaryComponentRow[]);
        onChange(
          (assignedJson.data as AssignedRow[]).map((a) => ({
            componentId: a.componentId,
            amount: a.amount,
          }))
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Sengaja hanya bergantung pada userId: `onChange` di-recreate tiap render
    // form induk, dan memuat ulang di sini akan menimpa suntingan yang belum
    // disimpan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (forbidden) return null;

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const assignedIds = new Set(value.map((i) => i.componentId));
  // Komponen nonaktif hanya ditampilkan kalau karyawan ini masih memakainya —
  // supaya nilainya bisa dilepas, tapi tidak bisa dipasang baru.
  const available = (catalog ?? []).filter(
    (c) =>
      (c.companyId === null || c.companyId === companyId) &&
      (c.isActive || assignedIds.has(c.id))
  );

  if (available.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Belum ada komponen gaji tambahan untuk PT ini. Buat dulu di halaman{" "}
        <strong>Komponen Gaji</strong>.
      </p>
    );
  }

  const toggle = (c: SalaryComponentRow, checked: boolean) => {
    if (checked) {
      onChange([...value, { componentId: c.id, amount: c.defaultAmount ?? 0 }]);
    } else {
      onChange(value.filter((i) => i.componentId !== c.id));
    }
  };

  const setAmount = (componentId: string, amount: number) =>
    onChange(value.map((i) => (i.componentId === componentId ? { ...i, amount } : i)));

  return (
    <div className="space-y-3">
      {available.map((c) => {
        const item = value.find((i) => i.componentId === c.id);
        const checkboxId = `salary-component-${c.id}`;
        return (
          <div key={c.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={!!item}
                onCheckedChange={(v) => toggle(c, v === true)}
              />
              <Label htmlFor={checkboxId} className="text-xs font-normal">
                {c.name}{" "}
                <span className="text-muted-foreground">
                  · {c.kind === "ALLOWANCE" ? "tunjangan" : "potongan"}
                  {!c.isActive && " · nonaktif"}
                </span>
              </Label>
            </div>
            {item && (
              <NumericFormat
                customInput={PremiumField}
                label={`Nilai ${c.name} (IDR)`}
                thousandSeparator="."
                decimalSeparator=","
                allowNegative={false}
                placeholder="0"
                value={String(item.amount)}
                onValueChange={(v) => setAmount(c.id, v.value ? parseFloat(v.value) : 0)}
                icon={<Banknote className="w-4 h-4" />}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
