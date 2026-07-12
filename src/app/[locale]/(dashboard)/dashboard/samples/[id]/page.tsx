"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { IconArrowLeft, IconPrinter, IconQrcode } from "@tabler/icons-react"
import { format } from "date-fns"

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
}

type SampleDetail = {
  id: string
  sampleNumber: string
  materialType: string
  source: string | null
  dateReceived: string
  initialNotes: string | null
  status: string
  method: string | null
  assayResults: string | null
  completedAt: string | null
  technician: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [sample, setSample] = useState<SampleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/samples/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSample(d.data)
        else setError(d.message || "Sample not found")
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !sample) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold text-destructive">Sample Not Found</h2>
        <p className="text-muted-foreground mt-2">{error || "The requested sample could not be found."}</p>
        <Button className="mt-4" onClick={() => router.push("/dashboard/samples")}>
          Back to Samples
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <IconArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/samples/${id}/label`)}>
            <IconQrcode className="h-4 w-4 mr-1" />
            Print Label
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-mono text-xl">{sample.sampleNumber}</CardTitle>
          <Badge className={STATUS_COLORS[sample.status] || ""}>{sample.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Material Type</p>
              <p className="font-medium">{sample.materialType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Source / Supplier</p>
              <p className="font-medium">{sample.source || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date Received</p>
              <p className="font-medium">{format(new Date(sample.dateReceived), "dd MMM yyyy, HH:mm")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assay Method</p>
              <p className="font-medium">{sample.method || "Not assigned"}</p>
            </div>
            {sample.technician && (
              <div>
                <p className="text-sm text-muted-foreground">Technician</p>
                <p className="font-medium">{sample.technician.name}</p>
              </div>
            )}
            {sample.completedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Completed At</p>
                <p className="font-medium">{format(new Date(sample.completedAt), "dd MMM yyyy, HH:mm")}</p>
              </div>
            )}
          </div>

          {sample.initialNotes && (
            <div>
              <p className="text-sm text-muted-foreground">Initial Notes</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">{sample.initialNotes}</p>
            </div>
          )}

          {sample.assayResults && (
            <div>
              <p className="text-sm text-muted-foreground">Assay Results</p>
              <pre className="mt-1 text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                {sample.assayResults}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
