import type { KpiInputSource } from "@src/generated/prisma/client";

/**
 * Kebijakan pengisian sebuah KPI untuk satu jabatan.
 *
 * Berada di lib (bukan di service) karena dipakai service KPI maupun service
 * kolektor; menaruhnya di salah satu service membuat keduanya saling impor.
 */

type PolicySource = {
  inputSource: KpiInputSource | null;
  requiresApproval: boolean | null;
  requiresEvidence: boolean | null;
  definition: {
    defaultInputSource: KpiInputSource;
    defaultRequiresApproval: boolean;
    defaultRequiresEvidence: boolean;
  };
};

export type InputPolicy = {
  inputSource: KpiInputSource;
  requiresApproval: boolean;
  requiresEvidence: boolean;
};

/**
 * Nilai di RoleKpi menimpa default definisinya, sehingga KPI yang sama bisa
 * boleh diisi sendiri di satu jabatan tapi tidak di jabatan lain.
 */
export function resolveInputPolicy(roleKpi: PolicySource): InputPolicy {
  return {
    inputSource: roleKpi.inputSource ?? roleKpi.definition.defaultInputSource,
    requiresApproval: roleKpi.requiresApproval ?? roleKpi.definition.defaultRequiresApproval,
    requiresEvidence: roleKpi.requiresEvidence ?? roleKpi.definition.defaultRequiresEvidence,
  };
}
