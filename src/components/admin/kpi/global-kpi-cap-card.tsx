"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/admin/page-shell";

interface Props {
  /** Rasio (1.2 = 120%) dalam bentuk string, atau null bila belum ada plafon. */
  currentDefaultMaxTotalScore: string | null;
}

export function GlobalKpiCapCard({ currentDefaultMaxTotalScore }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(
    currentDefaultMaxTotalScore ? String(Math.round(Number(currentDefaultMaxTotalScore) * 100)) : ""
  );

  const mutation = useMutation({
    mutationFn: async (defaultMaxTotalScore: number | null) => {
      const res = await fetch("/api/kpi-global-setting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultMaxTotalScore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan");
      return data.data;
    },
    onSuccess: (_data, defaultMaxTotalScore) => {
      toast.success(
        defaultMaxTotalScore === null ? "Plafon skor total default dihapus" : "Plafon skor total default disimpan"
      );
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed === "") {
      mutation.mutate(null);
      return;
    }
    const pct = parseFloat(trimmed);
    if (isNaN(pct) || pct <= 0) {
      toast.error("Plafon harus lebih dari 0%");
      return;
    }
    mutation.mutate(pct / 100);
  };

  return (
    <SectionCard
      title="Plafon Skor Total Default"
      description="Batas atas skor KPI bulanan yang berlaku untuk semua jabatan yang belum punya plafon sendiri (diatur lewat 'Plafon Skor Total Jabatan' di halaman detail jabatan). Kosongkan untuk menghapus plafon default — skor kembali bebas tanpa batas."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Batas Atas Skor Total (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Kosongkan = tanpa plafon"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-48"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </SectionCard>
  );
}
