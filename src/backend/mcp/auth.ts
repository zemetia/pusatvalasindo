import { timingSafeEqual } from "crypto";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { AdminCaller } from "@/backend/helpers/get-admin-caller";
import { getPermissionsForRole } from "@/lib/permissions";

/**
 * A caller resolved from an MCP key. Structurally an AdminCaller (so it plugs
 * straight into the existing services + permission helpers), plus a label for
 * traceability.
 *
 * For now there is exactly one key — the owner key (env `MCP_OWNER_KEY`) — which
 * acts as Super Admin / Owner: `companyId = null` (unscoped, every PT) and the
 * full permission set. When kepala-cabang keys are added later, this is where a
 * per-Role-PT lookup (e.g. an `mcpKeyHash` column on `custom_role`) would slot in.
 */
export type McpCaller = AdminCaller & {
  companyCode: string | null;
  label: string;
};

/** The single owner/super-admin caller (global scope, all permissions). */
function ownerCaller(): McpCaller {
  return {
    id: "mcp:owner",
    companyId: null,
    branchId: null,
    roleName: "OWNER",
    permissions: getPermissionsForRole("OWNER"),
    payrollCompanyIds: [],
    companyCode: null,
    label: "owner",
  };
}

/** Constant-time string comparison (avoids leaking the key via timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * `verifyToken` bridge for mcp-handler's `withMcpAuth`. Accepts the request only
 * when the bearer token matches `MCP_OWNER_KEY`, resolving to the owner caller
 * (carried in `authInfo.extra.caller` for the tool handlers). Returns undefined
 * — which makes withMcpAuth respond 401 — when unset or mismatched.
 */
export async function verifyMcpToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  const expected = process.env.MCP_OWNER_KEY;
  if (!expected || !bearerToken) return undefined;
  if (!safeEqual(bearerToken, expected)) return undefined;

  const caller = ownerCaller();
  return {
    token: bearerToken,
    clientId: caller.label,
    scopes: caller.permissions,
    extra: { caller },
  };
}
