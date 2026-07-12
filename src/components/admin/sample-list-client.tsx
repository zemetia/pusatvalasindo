"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { IconFlask, IconPlus, IconSearch, IconQrcode } from "@tabler/icons-react"
import { format } from "date-fns"

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
}

type Sample = {
  id: string
  sampleNumber: string
  materialType: string
  source: string | null
  dateReceived: string
  status: string
  createdAt: string
}

export function SampleListClient() {
  const router = useRouter()
  const [samples, setSamples] = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/api/samples?limit=200")
      .then((r) => r.json())
      .then((d) => { if (d.success) setSamples(d.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return samples
    const q = search.toLowerCase()
    return samples.filter(
      (s) =>
        s.sampleNumber.toLowerCase().includes(q) ||
        s.materialType.toLowerCase().includes(q) ||
        (s.source?.toLowerCase() || "").includes(q)
    )
  }, [samples, search])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <IconFlask className="h-6 w-6 text-amber-500" />
          Samples
        </h1>
        <Button onClick={() => router.push("/dashboard/samples/register")}>
          <IconPlus className="h-4 w-4 mr-1" />
          Register Sample
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <IconSearch className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by sample number, material, or source..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading samples...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              {search ? "No samples match your search." : "No samples registered yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sample #</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/samples/${s.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{s.sampleNumber}</TableCell>
                    <TableCell>{s.materialType}</TableCell>
                    <TableCell className="text-muted-foreground">{s.source || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(s.dateReceived), "dd MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[s.status] || ""}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/samples/${s.id}/label`)
                        }}
                      >
                        <IconQrcode className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
