-- Plafon pencapaian per KPI: default 120% untuk baris baru, dan semua baris
-- yang sekarang belum punya plafon dibackfill ke 120%. Null tetap sah untuk
-- "tanpa plafon" bila admin sengaja mengosongkannya setelah ini.
ALTER TABLE "RoleKpi" ALTER COLUMN "maxAchievement" SET DEFAULT 1.2;
UPDATE "RoleKpi" SET "maxAchievement" = 1.2 WHERE "maxAchievement" IS NULL;

-- Plafon skor total default sistem: pastikan barisnya ada (120%) supaya
-- jabatan tanpa RoleKpiCap ikut terplafon di server.
INSERT INTO "KpiGlobalSetting" ("id", "defaultMaxTotalScore", "updatedAt")
VALUES ('default', 1.2, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
