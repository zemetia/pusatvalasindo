import prisma from "@/lib/prisma"
import { DailyStockForm } from "@/components/admin/daily-stock-form"

export default async function StokHarianPage() {
  let result
  try {
    result = await Promise.all([
      prisma.company.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, companyId: true },
      }),
    ])
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[stok-harian/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }
  const [companies, branches] = result

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Isi Stok Harian</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Input posisi stok penutupan dan saldo rekening per hari per cabang
        </p>
      </div>
      <DailyStockForm companies={companies} branches={branches} />
    </div>
  )
}
