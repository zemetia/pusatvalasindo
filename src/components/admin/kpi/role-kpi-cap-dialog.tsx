"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  companyId: string;
  customRoleId: string;
  /** Rasio (1.2 = 120%) dalam bentuk string, atau null bila belum ada plafon. */
  currentMaxTotalScore: string | null;
  trigger: React.ReactNode;
}

export function RoleKpiCapDialog({
  companyId,
  customRoleId,
  currentMaxTotalScore,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) {
      setValue(currentMaxTotalScore ? String(Math.round(Number(currentMaxTotalScore) * 100)) : "");
    }
  }, [open, currentMaxTotalScore]);

  const mutation = useMutation({
    mutationFn: async (maxTotalScore: number | null) => {
      const res = await fetch("/api/role-kpi-caps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, customRoleId, maxTotalScore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan");
      return data.data;
    },
    onSuccess: (_data, maxTotalScore) => {
      toast.success(maxTotalScore === null ? "Plafon skor total dihapus" : "Plafon skor total disimpan");
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Plafon Skor Total Jabatan</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5 py-2">
          <Label>Batas Atas Skor Total (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Kosongkan = tanpa plafon"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-muted-foreground text-xs">
            Skor total gabungan seluruh KPI jabatan ini tidak akan dihitung melebihi angka ini,
            berapa pun pencapaian tiap KPI-nya. Kosongkan untuk menghapus plafon.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
