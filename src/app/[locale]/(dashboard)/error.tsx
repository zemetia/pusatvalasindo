'use client'

import { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { IconAlertTriangle, IconHome, IconRefresh } from "@tabler/icons-react"
import { PageShell } from "@/components/admin/page-shell"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard Error:', error)
  }, [error])

  return (
    <PageShell width="narrow">
      <div className="bg-card flex flex-col items-center gap-4 rounded-xl border px-6 py-14 text-center shadow-sm">
        <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
          <IconAlertTriangle className="size-6" />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Terjadi kesalahan</h2>
          <p className="text-muted-foreground mx-auto max-w-md text-sm text-pretty">
            {error.message || "Halaman gagal dimuat. Coba lagi, atau kembali ke dashboard."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => reset()}>
            <IconRefresh className="size-4" />
            Coba lagi
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            <IconHome className="size-4" />
            Ke Beranda
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
