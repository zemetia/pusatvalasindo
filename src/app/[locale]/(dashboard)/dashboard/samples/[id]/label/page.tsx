"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react"
import { format } from "date-fns"

type LabelData = {
  sample: {
    id: string
    sampleNumber: string
    materialType: string
    source: string | null
    dateReceived: string
  }
  qrSvg: string
  sampleUrl: string
}

export default function SampleLabelPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<LabelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/samples/${id}/label`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data)
        else setError(d.message || "Failed to load label")
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-80" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-destructive">{error || "Label data not found"}</p>
        <Button className="mt-4" variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  const { sample } = data

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #sample-label, #sample-label * { visibility: visible; }
          #sample-label { 
            position: absolute; 
            left: 0; top: 0; 
            width: 100%; 
            padding: 20px;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-md mx-auto space-y-4 no-print">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <Button onClick={handlePrint}>
            <IconPrinter className="h-4 w-4 mr-1" />
            Print Label
          </Button>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Click Print to generate the physical QR label for this sample.
        </p>
      </div>

      {/* The label itself */}
      <div id="sample-label" className="max-w-sm mx-auto mt-4">
        <Card className="border-2 border-amber-500/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-sm font-bold text-amber-600 uppercase tracking-wider">
              Golden Alura — Sample Label
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR Code */}
            <div
              className="flex justify-center"
              dangerouslySetInnerHTML={{ __html: data.qrSvg }}
            />

            {/* Sample Info */}
            <div className="text-center space-y-1">
              <p className="text-lg font-mono font-bold">{sample.sampleNumber}</p>
              <p className="text-sm">{sample.materialType}</p>
              {sample.source && (
                <p className="text-xs text-muted-foreground">Source: {sample.source}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Received: {format(new Date(sample.dateReceived), "dd MMM yyyy HH:mm")}
              </p>
            </div>

            {/* Scan URL hint */}
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground break-all">{data.sampleUrl}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
