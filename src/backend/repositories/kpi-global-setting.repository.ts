import prisma from "@/lib/prisma";

const SETTING_ID = "default";

export const kpiGlobalSettingRepository = {
  get: () => prisma.kpiGlobalSetting.findUnique({ where: { id: SETTING_ID } }),

  /** Null menghapus plafon default (tidak ada baris berarti tanpa plafon). */
  upsert: (defaultMaxTotalScore: number | null) =>
    prisma.kpiGlobalSetting.upsert({
      where: { id: SETTING_ID },
      create: { id: SETTING_ID, defaultMaxTotalScore },
      update: { defaultMaxTotalScore },
    }),
};
