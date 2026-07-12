"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet"
import { IconLoader2, IconPlus, IconSettings } from "@tabler/icons-react"

type Pocket = { id: string; name: string; code: string | null; isActive: boolean }

interface Props {
  kind: "stockist" | "kas"
  companyId: string
  pockets: Pocket[]
  onChanged: () => void
}

export function StockistPocketSheet({ kind, companyId, pockets, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})

  const createUrl = kind === "stockist" ? "/api/stockist/pockets" : "/api/stockist/kas/pockets"
  const updateUrl = (id: string) =>
    kind === "stockist" ? `/api/stockist/pockets/${id}` : `/api/stockist/kas/pockets/${id}`

  const create = async () => {
    if (!name.trim()) {
      toast.error("Nama pocket wajib diisi")
      return
    }
    setCreating(true)
    try {
      const res = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, name: name.trim(), code: code.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal membuat pocket")
      toast.success("Pocket berhasil dibuat")
      setName("")
      setCode("")
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pocket")
    } finally {
      setCreating(false)
    }
  }

  const rename = async (id: string, currentName: string) => {
    const newName = renameDrafts[id]?.trim()
    if (!newName || newName === currentName) return
    setBusyId(id)
    try {
      const res = await fetch(updateUrl(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
      toast.success("Nama pocket diperbarui")
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    setBusyId(id)
    try {
      const res = await fetch(updateUrl(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
      toast.success(isActive ? "Pocket dinonaktifkan" : "Pocket diaktifkan")
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <IconSettings className="size-4" />
          Kelola Pocket
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Kelola Pocket {kind === "stockist" ? "Mata Uang" : "Kas"}</SheetTitle>
          <SheetDescription>
            Tambah pocket baru, ubah nama, atau nonaktifkan pocket yang sudah ada.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pocket baru
            </p>
            <Input
              placeholder="Nama pocket, mis. Kurir A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Kode (opsional)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button size="sm" onClick={create} disabled={creating}>
              {creating ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconPlus className="size-4" />
              )}
              Tambah Pocket
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pocket saat ini
            </p>
            {pockets.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada pocket.</p>
            )}
            {pockets.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border p-2">
                <Input
                  defaultValue={p.name}
                  onChange={(e) =>
                    setRenameDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  onBlur={() => rename(p.id, p.name)}
                  className="h-8 text-sm"
                  disabled={busyId === p.id}
                />
                {!p.isActive && (
                  <Badge variant="outline" className="shrink-0">
                    Nonaktif
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={busyId === p.id}
                  onClick={() => toggleActive(p.id, p.isActive)}
                >
                  {busyId === p.id ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : p.isActive ? (
                    "Nonaktifkan"
                  ) : (
                    "Aktifkan"
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Tutup
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
