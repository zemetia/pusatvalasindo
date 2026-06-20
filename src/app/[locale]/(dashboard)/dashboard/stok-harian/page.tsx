import prisma from "@/lib/prisma"
import { DailyStockForm } from "@/components/admin/daily-stock-form"

export default async function StokHarianPage() {
  const [companies, branches] = await Promise.all([
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
