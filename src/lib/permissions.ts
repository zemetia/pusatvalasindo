// ─── Permission constants ────────────────────────────────────────────────────

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  ATTENDANCE_VIEW_OWN: "attendance.view_own",
  ATTENDANCE_VIEW_ALL: "attendance.view_all",
  ATTENDANCE_MANAGE: "attendance.manage",

  KPI_FILL_OWN: "kpi.fill_own",
  KPI_VIEW_OWN: "kpi.view_own",
  KPI_VIEW_ALL: "kpi.view_all",
  KPI_MANAGE: "kpi.manage",

  PAYROLL_VIEW_OWN: "payroll.view_own",
  PAYROLL_VIEW_ALL: "payroll.view_all",
  PAYROLL_MANAGE: "payroll.manage",

  STOCK_VIEW: "stock.view",
  STOCK_MANAGE: "stock.manage",

  BANK_VIEW: "bank.view",
  BANK_MANAGE: "bank.manage",

  CURRENCY_VIEW: "currency.view",
  CURRENCY_MANAGE: "currency.manage",

  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",

  BRANCHES_VIEW: "branches.view",
  BRANCHES_MANAGE: "branches.manage",

  ROLES_VIEW: "roles.view",
  ROLES_MANAGE: "roles.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── Role → permission mapping ───────────────────────────────────────────────
// Keys must match the `name` field stored in `custom_role` (case-sensitive).
// Add a normalized uppercase alias for SUPER_ADMIN / OWNER system roles.

const ALL = Object.values(PERMISSIONS) as Permission[];

const ADMIN_PERMISSIONS: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW_OWN,
  PERMISSIONS.ATTENDANCE_VIEW_ALL,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.KPI_FILL_OWN,
  PERMISSIONS.KPI_VIEW_OWN,
  PERMISSIONS.KPI_VIEW_ALL,
  PERMISSIONS.KPI_MANAGE,
  PERMISSIONS.PAYROLL_VIEW_OWN,
  PERMISSIONS.PAYROLL_VIEW_ALL,
  PERMISSIONS.PAYROLL_MANAGE,
  PERMISSIONS.STOCK_VIEW,
  PERMISSIONS.STOCK_MANAGE,
  PERMISSIONS.BANK_VIEW,
  PERMISSIONS.BANK_MANAGE,
  PERMISSIONS.CURRENCY_VIEW,
  PERMISSIONS.CURRENCY_MANAGE,
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.BRANCHES_VIEW,
  PERMISSIONS.BRANCHES_MANAGE,
  PERMISSIONS.ROLES_VIEW,
  PERMISSIONS.ROLES_MANAGE,
];

const KEPALA_CABANG_PERMISSIONS: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW_OWN,
  PERMISSIONS.ATTENDANCE_VIEW_ALL,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.KPI_FILL_OWN,
  PERMISSIONS.KPI_VIEW_OWN,
  PERMISSIONS.KPI_VIEW_ALL,
  PERMISSIONS.KPI_MANAGE,
  PERMISSIONS.PAYROLL_VIEW_OWN,
  PERMISSIONS.PAYROLL_VIEW_ALL,
  PERMISSIONS.PAYROLL_MANAGE,
  PERMISSIONS.STOCK_VIEW,
  PERMISSIONS.STOCK_MANAGE,
  PERMISSIONS.BANK_VIEW,
  PERMISSIONS.CURRENCY_VIEW,
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.BRANCHES_VIEW,
  PERMISSIONS.ROLES_VIEW,
];

const HR_PERMISSIONS: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW_OWN,
  PERMISSIONS.ATTENDANCE_VIEW_ALL,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.KPI_FILL_OWN,
  PERMISSIONS.KPI_VIEW_OWN,
  PERMISSIONS.KPI_VIEW_ALL,
  PERMISSIONS.KPI_MANAGE,
  PERMISSIONS.PAYROLL_VIEW_OWN,
  PERMISSIONS.PAYROLL_VIEW_ALL,
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.BRANCHES_VIEW,
];

const AKUNTAN_PERMISSIONS: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW_OWN,
  PERMISSIONS.KPI_FILL_OWN,
  PERMISSIONS.KPI_VIEW_OWN,
  PERMISSIONS.PAYROLL_VIEW_OWN,
  PERMISSIONS.STOCK_VIEW,
  PERMISSIONS.BANK_VIEW,
  PERMISSIONS.BANK_MANAGE,
  PERMISSIONS.CURRENCY_VIEW,
  PERMISSIONS.CURRENCY_MANAGE,
];

const KASIR_PERMISSIONS: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW_OWN,
  PERMISSIONS.KPI_FILL_OWN,
  PERMISSIONS.KPI_VIEW_OWN,
  PERMISSIONS.STOCK_VIEW,
  PERMISSIONS.STOCK_MANAGE,
  PERMISSIONS.CURRENCY_VIEW,
  PERMISSIONS.BANK_VIEW,
];

const KURIR_PERMISSIONS: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW_OWN,
  PERMISSIONS.KPI_FILL_OWN,
  PERMISSIONS.KPI_VIEW_OWN,
];

const DEFAULT_PERMISSIONS: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW_OWN,
  PERMISSIONS.KPI_FILL_OWN,
  PERMISSIONS.KPI_VIEW_OWN,
];

// Lookup table: normalized role name → permissions
// Covers both system roles (SUPER_ADMIN, OWNER) and per-company roles from Excel.
// Multiple spellings are mapped to the same set for robustness.
const ROLE_PERMISSION_MAP: Record<string, Permission[]> = {
  SUPER_ADMIN: ALL,
  OWNER: ALL,
  Admin: ADMIN_PERMISSIONS,
  "Kepala Cabang": KEPALA_CABANG_PERMISSIONS,
  "Kepala & Kasir": KEPALA_CABANG_PERMISSIONS,
  "Kepala Marketing": KEPALA_CABANG_PERMISSIONS,
  HR: HR_PERMISSIONS,
  Akuntan: AKUNTAN_PERMISSIONS,
  Kasir: KASIR_PERMISSIONS,
  // Teller (dalam/luar) setara Kasir — akses transaksi & stock, self-fill KPI
  "Teller Dalam": KASIR_PERMISSIONS,
  "Teller Luar": KASIR_PERMISSIONS,
  "Sales & Compliance": KASIR_PERMISSIONS,
  Kurir: KURIR_PERMISSIONS,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the permission list for a given role name.
 * Tries exact match first, then case-insensitive fallback.
 */
export function getPermissionsForRole(roleName: string): Permission[] {
  if (roleName in ROLE_PERMISSION_MAP) return ROLE_PERMISSION_MAP[roleName];

  const upper = roleName.toUpperCase();
  for (const [key, perms] of Object.entries(ROLE_PERMISSION_MAP)) {
    if (key.toUpperCase() === upper) return perms;
  }
  return DEFAULT_PERMISSIONS;
}

/** Returns true when the given permission array includes the target permission. */
export function can(permissions: string[], permission: Permission): boolean {
  return permissions.includes(permission);
}

/** Returns true when the user has ANY of the given permissions. */
export function canAny(permissions: string[], required: Permission[]): boolean {
  return required.some((p) => permissions.includes(p));
}
