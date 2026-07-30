"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconShieldLock,
  IconSearch,
  IconX,
  IconChevronRight,
  IconCheck,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RESOURCES, type ResourceDef } from "@/lib/authz/resources";
import type { ResourceGrant } from "@/lib/authz/resolve";

type CompanyOption = { id: string; name: string; code: string };

interface Props {
  roleId: string;
  roleName: string;
  /** PT pemilik jabatan — dipakai membaca kembali baris lama bermode OWN. */
  roleCompanyId?: string | null;
  companies: CompanyOption[];
  /** True kalau pemakai boleh memberi akses seluruh PT / global (Super Admin & Owner). */
  canGrantAll?: boolean;
  trigger?: React.ReactNode;
}

/** State panel: resource key → grant. Resource tanpa entri berarti NONE/NONE. */
type MatrixState = Record<string, ResourceGrant>;

/**
 * Satu baris izin yang bisa dicari. Sengaja dipecah per AKSI, bukan per resource:
 * yang dicari admin adalah "boleh lihat rekening bank", bukan "resource rekening
 * bank lalu sumbu mana". Nama barisnya mengikuti format
 * `[Section]: [Aksi] [Halaman]` — section = grup sidebar dari registry resource.
 */
type Entry = {
  id: string;
  def: ResourceDef;
  /** `both` = satu sumbu saja (kemampuan / data milik sendiri). */
  axis: "view" | "write" | "both";
  section: string;
  name: string;
  /** Punya dimensi PT? Kalau tidak, barisnya cuma sakelar hidup/mati. */
  perCompany: boolean;
  /** Hanya Super Admin/Owner yang boleh mendelegasikan resource global. */
  globalOnly: boolean;
};

function buildEntries(): Entry[] {
  const entries: Entry[] = [];

  for (const def of RESOURCES) {
    const scoping = def.scoping ?? "company";
    const perCompany = scoping === "company";
    const globalOnly = scoping === "global";

    // Kemampuan tambahan dan data milik sendiri tidak punya sumbu baca/tulis —
    // satu baris "Akses" saja.
    if (def.capability || scoping === "self") {
      entries.push({
        id: `${def.key}:both`,
        def,
        axis: "both",
        section: def.group,
        name: `${def.group}: Akses ${def.label}`,
        perCompany,
        globalOnly,
      });
      continue;
    }

    entries.push({
      id: `${def.key}:view`,
      def,
      axis: "view",
      section: def.group,
      name: `${def.group}: Lihat ${def.label}`,
      perCompany,
      globalOnly,
    });

    // Halaman baca saja tidak punya sumbu tulis: menampilkan sakelar "Ubah"
    // yang tidak berpengaruh lebih buruk daripada tidak ada sakelar sama sekali.
    if (def.readOnly) continue;

    entries.push({
      id: `${def.key}:write`,
      def,
      axis: "write",
      section: def.group,
      name: `${def.group}: Ubah ${def.label}`,
      perCompany,
      globalOnly,
    });
  }

  return entries;
}

/** Daftar baris izin bersifat statis — registry resource tidak berubah saat runtime. */
const ENTRIES = buildEntries();

function emptyGrant(resource: string): ResourceGrant {
  return {
    resource,
    viewScope: "NONE",
    viewCompanyIds: [],
    writeScope: "NONE",
    writeCompanyIds: [],
  };
}

/** PT terpilih untuk satu sumbu. Mode lama OWN dibaca sebagai "PT jabatan ini". */
function selectionOf(
  grant: ResourceGrant,
  axis: Entry["axis"],
  allIds: string[],
  roleCompanyId?: string | null
): string[] {
  const scope = axis === "view" ? grant.viewScope : grant.writeScope;
  const ids = axis === "view" ? grant.viewCompanyIds : grant.writeCompanyIds;

  switch (scope) {
    case "ALL":
      return [...allIds];
    case "SELECTED":
      return ids.filter((id) => allIds.includes(id));
    case "OWN":
      return roleCompanyId ? [roleCompanyId] : [];
    default:
      return [];
  }
}

/**
 * Daftar PT → (scope, ids). Kosong = tidak ada akses; seluruh PT = ALL, sehingga
 * PT yang dibuat kemudian ikut tercakup (hanya boleh diberikan oleh role global).
 */
function encode(
  ids: string[],
  allIds: string[],
  canGrantAll: boolean
): { scope: ResourceGrant["viewScope"]; ids: string[] } {
  if (ids.length === 0) return { scope: "NONE", ids: [] };
  if (canGrantAll && allIds.length > 0 && ids.length >= allIds.length) {
    return { scope: "ALL", ids: [] };
  }
  return { scope: "SELECTED", ids };
}

export function RolePermissionPicker({
  roleId,
  roleName,
  roleCompanyId,
  companies,
  canGrantAll = false,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState<MatrixState>({});
  const [grantable, setGrantable] = useState<CompanyOption[]>(companies);
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const allIds = useMemo(() => grantable.map((c) => c.id), [grantable]);

  // Dimuat saat panel dibuka, bukan lewat useEffect: ini respons terhadap sebuah
  // kejadian, bukan sinkronisasi ke sistem luar.
  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) return;

    setLoading(true);
    setMatrix({});
    setSearch("");
    setExpanded(null);
    try {
      // OPTIONS mengembalikan PT yang boleh DIBERIKAN oleh si pengatur — bukan
      // seluruh PT. Tanpa itu, "Pilih semua PT" bisa menyusun permintaan yang
      // pasti ditolak server bagi pengelola jabatan yang didelegasikan.
      const [permRes, companyRes] = await Promise.all([
        fetch(`/api/roles/${roleId}/permissions`),
        fetch(`/api/roles/${roleId}/permissions`, { method: "OPTIONS" }),
      ]);

      const permData = await permRes.json();
      if (!permRes.ok) {
        toast.error(permData.message || "Gagal memuat izin jabatan");
        return;
      }
      const loaded: MatrixState = {};
      for (const g of (permData.data ?? []) as ResourceGrant[]) loaded[g.resource] = g;
      setMatrix(loaded);

      if (companyRes.ok) {
        const companyData = await companyRes.json();
        if (Array.isArray(companyData.data)) setGrantable(companyData.data as CompanyOption[]);
      }
    } catch {
      toast.error("Gagal memuat izin jabatan");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Menulis daftar PT sebuah sumbu, sambil menjaga invarian "bisa ubah berarti
   * bisa lihat": hak tulis tanpa hak baca menghasilkan halaman tak terjangkau
   * yang API-nya tetap terbuka.
   */
  const setSelection = (entry: Entry, ids: string[]) => {
    setMatrix((m) => {
      const base = m[entry.def.key] ?? emptyGrant(entry.def.key);
      const next = { ...base };

      const write = () => selectionOf(next, "write", allIds, roleCompanyId);
      const view = () => selectionOf(next, "view", allIds, roleCompanyId);

      const put = (axis: "view" | "write", list: string[]) => {
        const { scope, ids: encoded } = encode(list, allIds, canGrantAll);
        if (axis === "view") {
          next.viewScope = scope;
          next.viewCompanyIds = encoded;
        } else {
          next.writeScope = scope;
          next.writeCompanyIds = encoded;
        }
      };

      if (entry.axis === "both") {
        put("view", ids);
        put("write", ids);
      } else if (entry.axis === "view") {
        put("view", ids);
        // Mencabut hak lihat sebuah PT ikut mencabut hak ubahnya.
        put(
          "write",
          write().filter((id) => ids.includes(id))
        );
      } else {
        put("write", ids);
        // Memberi hak ubah sebuah PT otomatis memberi hak lihatnya.
        put("view", Array.from(new Set([...view(), ...ids])));
      }

      return { ...m, [entry.def.key]: next };
    });
  };

  /** Sakelar untuk baris tanpa dimensi PT (resource global & data milik sendiri). */
  const setEnabled = (entry: Entry, on: boolean) => {
    setMatrix((m) => {
      const base = m[entry.def.key] ?? emptyGrant(entry.def.key);
      const next = { ...base };
      // Server menormalkan resource tanpa dimensi PT ke ALL/NONE tanpa daftar PT.
      const mode = on ? ("ALL" as const) : ("NONE" as const);

      if (entry.axis === "both") {
        next.viewScope = mode;
        next.writeScope = mode;
      } else if (entry.axis === "view") {
        next.viewScope = mode;
        if (!on) next.writeScope = "NONE";
      } else {
        next.writeScope = mode;
        if (on) next.viewScope = "ALL";
      }
      next.viewCompanyIds = [];
      next.writeCompanyIds = [];
      return { ...m, [entry.def.key]: next };
    });
  };

  const selectionFor = (entry: Entry) =>
    selectionOf(matrix[entry.def.key] ?? emptyGrant(entry.def.key), entry.axis, allIds, roleCompanyId);

  /** Baris yang sedang aktif, dihitung sekali per perubahan matriks. */
  const activeIds = useMemo(() => {
    const on = new Set<string>();
    for (const e of ENTRIES) {
      const g = matrix[e.def.key] ?? emptyGrant(e.def.key);
      const scope = e.axis === "write" ? g.writeScope : g.viewScope;
      const enabled = e.perCompany
        ? selectionOf(g, e.axis, allIds, roleCompanyId).length > 0
        : scope !== "NONE";
      if (enabled) on.add(e.id);
    }
    return on;
  }, [matrix, allIds, roleCompanyId]);

  const isEnabled = (entry: Entry) => activeIds.has(entry.id);
  const activeCount = activeIds.size;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ENTRIES.filter((e) => {
      if (onlyActive && !activeIds.has(e.id)) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.def.description.toLowerCase().includes(q) ||
        (e.def.page ?? "").toLowerCase().includes(q)
      );
    });
  }, [search, onlyActive, activeIds]);

  const sections = useMemo(() => {
    const out: { section: string; items: Entry[] }[] = [];
    for (const e of visible) {
      let s = out.find((x) => x.section === e.section);
      if (!s) {
        s = { section: e.section, items: [] };
        out.push(s);
      }
      s.items.push(e);
    }
    return out;
  }, [visible]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grants: Object.values(matrix) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan izin");
        return;
      }
      toast.success("Izin jabatan diperbarui");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Perizinan</Button>}
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="flex h-[85vh] max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-border border-b px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <IconShieldLock className="size-4" />
            Perizinan — {roleName}
          </DialogTitle>
          <DialogDescription>
            Cari izin lalu pilih PT mana yang berlaku. Tanpa PT terpilih, izinnya tidak
            aktif.
          </DialogDescription>
        </DialogHeader>

        <div className="border-border flex flex-col gap-2 border-b px-6 py-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              type="text"
              inputMode="search"
              placeholder='Cari izin, mis. "lihat rekening bank"'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pr-8 pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Bersihkan pencarian"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 transition-colors"
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOnlyActive((v) => !v)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors",
              onlyActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Hanya yang aktif
            <span className="tabular ml-1.5">{activeCount}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {loading ? (
            <p className="text-muted-foreground py-10 text-center text-sm">Memuat izin…</p>
          ) : sections.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {onlyActive && !search
                ? "Jabatan ini belum punya izin apa pun."
                : `Tidak ada izin yang cocok dengan "${search}".`}
            </p>
          ) : (
            <div className="flex flex-col gap-6 py-2">
              {sections.map((s) => (
                <div key={s.section} className="flex flex-col">
                  <p className="text-muted-foreground mb-1 text-[11px] font-bold tracking-widest uppercase">
                    {s.section}
                  </p>
                  <div className="divide-border divide-y">
                    {s.items.map((entry) => (
                      <PermissionRow
                        key={entry.id}
                        entry={entry}
                        companies={grantable}
                        selected={selectionFor(entry)}
                        enabled={isEnabled(entry)}
                        canGrantAll={canGrantAll}
                        expanded={expanded === entry.id}
                        onToggleExpand={() =>
                          setExpanded((cur) => (cur === entry.id ? null : entry.id))
                        }
                        onSelect={(ids) => setSelection(entry, ids)}
                        onEnabled={(on) => setEnabled(entry, on)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-border flex items-center justify-between gap-3 border-t px-6 py-3">
          <span className="text-muted-foreground text-xs">
            <span className="tabular text-foreground font-semibold">{activeCount}</span> izin
            aktif
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || loading}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PermissionRow({
  entry,
  companies,
  selected,
  enabled,
  canGrantAll,
  expanded,
  onToggleExpand,
  onSelect,
  onEnabled,
}: {
  entry: Entry;
  companies: CompanyOption[];
  selected: string[];
  enabled: boolean;
  canGrantAll: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelect: (ids: string[]) => void;
  onEnabled: (on: boolean) => void;
}) {
  const allSelected = companies.length > 0 && selected.length >= companies.length;
  const locked = entry.globalOnly && !canGrantAll;

  const summary = !entry.perCompany
    ? enabled
      ? "Aktif"
      : "Tidak aktif"
    : selected.length === 0
      ? "Tidak ada PT"
      : allSelected
        ? "Semua PT"
        : companies
            .filter((c) => selected.includes(c.id))
            .map((c) => c.code)
            .join(", ");

  return (
    <div className="py-2.5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={locked}
          onClick={entry.perCompany ? onToggleExpand : () => onEnabled(!enabled)}
          className={cn(
            "min-w-0 flex-1 text-left",
            locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          )}
        >
          <span className="flex items-center gap-1.5">
            {entry.perCompany && (
              <IconChevronRight
                className={cn(
                  "text-muted-foreground size-3.5 shrink-0 transition-transform",
                  expanded && "rotate-90"
                )}
              />
            )}
            <span className="text-[13px] font-semibold">{entry.name}</span>
          </span>
          <span className="text-muted-foreground mt-0.5 block pl-5 text-[11px] leading-relaxed">
            {entry.def.description}
          </span>
        </button>

        {entry.perCompany ? (
          <span
            className={cn(
              "shrink-0 pt-0.5 text-[11px] font-semibold",
              enabled ? "text-primary" : "text-muted-foreground"
            )}
          >
            {summary}
          </span>
        ) : (
          <Switch
            checked={enabled}
            disabled={locked}
            onCheckedChange={onEnabled}
            aria-label={entry.name}
          />
        )}
      </div>

      {locked && (
        <p className="text-muted-foreground mt-1 pl-5 text-[11px] italic">
          Hanya Super Admin / Owner yang dapat mendelegasikan izin lintas PT ini.
        </p>
      )}

      {entry.perCompany && expanded && (
        <div className="mt-2.5 pl-5">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(companies.map((c) => c.id))}
              className="border-border text-muted-foreground hover:bg-muted rounded-md border px-2 py-0.5 text-[11px] font-medium"
            >
              Pilih semua PT
            </button>
            <button
              type="button"
              onClick={() => onSelect([])}
              className="border-border text-muted-foreground hover:bg-muted rounded-md border px-2 py-0.5 text-[11px] font-medium"
            >
              Kosongkan
            </button>
            {allSelected && !canGrantAll && (
              <span className="text-muted-foreground text-[10px] italic">
                PT baru tidak otomatis tercakup
              </span>
            )}
          </div>

          {companies.length === 0 ? (
            <p className="text-muted-foreground text-[11px]">Belum ada PT terdaftar.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {companies.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      onSelect(
                        on ? selected.filter((id) => id !== c.id) : [...selected, c.id]
                      )
                    }
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      on
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      )}
                    >
                      {on && <IconCheck className="size-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold">{c.code}</span>
                      <span className="text-muted-foreground block truncate text-[10px]">
                        {c.name}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
