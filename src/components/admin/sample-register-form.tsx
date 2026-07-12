"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { IconFlask, IconArrowLeft } from "@tabler/icons-react"

export function SampleRegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    materialType: "",
    source: "",
    initialNotes: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.materialType.trim()) {
      toast.error("Material type is required")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialType: form.materialType,
          source: form.source || null,
          initialNotes: form.initialNotes || null,
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.message || "Failed to register sample")

      toast.success(`Sample ${data.data.sampleNumber} registered`)
      router.push(`/dashboard/samples/${data.data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <IconArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <IconFlask className="h-6 w-6 text-amber-500" />
          Register New Sample
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sample Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="materialType">Material Type *</Label>
              <Input
                id="materialType"
                placeholder="e.g. Dore bar, Scrap gold, Jewelry"
                value={form.materialType}
                onChange={(e) => setForm({ ...form, materialType: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source / Supplier</Label>
              <Input
                id="source"
                placeholder="Supplier name or reference"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialNotes">Initial Notes</Label>
              <Textarea
                id="initialNotes"
                placeholder="Any observations, packaging details, special instructions..."
                rows={3}
                value={form.initialNotes}
                onChange={(e) => setForm({ ...form, initialNotes: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Registering..." : "Register Sample"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
