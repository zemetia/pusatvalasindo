-- AlterTable
ALTER TABLE "RoleKpi" ADD COLUMN     "maxAchievement" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "RoleKpiCap" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customRoleId" TEXT NOT NULL,
    "maxTotalScore" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleKpiCap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleKpiCap_companyId_customRoleId_key" ON "RoleKpiCap"("companyId", "customRoleId");

-- AddForeignKey
ALTER TABLE "RoleKpiCap" ADD CONSTRAINT "RoleKpiCap_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleKpiCap" ADD CONSTRAINT "RoleKpiCap_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "custom_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
