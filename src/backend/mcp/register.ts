import { z, type ZodRawShape } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AppError } from "@/backend/errors/app-error";
import { canAny } from "@/lib/permissions";
import type { McpCaller } from "@/backend/mcp/auth";
import { READ_TOOLS, runReadTool, runReadQuery, type ReadTool } from "@/backend/mcp/read-tools";
import { OPERATE_TOOLS } from "@/backend/mcp/operate-tools";

const RUN_QUERY_TOOL = "run_read_query";

/** JSON.stringify that survives BigInt (int8 counts) from raw queries. */
function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

function textResult(data: unknown): CallToolResult {
  // safeStringify turns BigInt (int8 counts from the views) into strings; parsing
  // it back gives a BigInt-free value safe for `structuredContent`, which the SDK
  // JSON-serializes itself (outside our try/catch — a raw BigInt there would abort
  // the response stream).
  const json = safeStringify(data);
  return {
    content: [{ type: "text", text: json }],
    structuredContent: { data: JSON.parse(json) as unknown },
  };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Reads the McpCaller injected by withMcpAuth (via verifyMcpToken). */
function callerFrom(extra: { authInfo?: { extra?: Record<string, unknown> } }): McpCaller | null {
  const caller = extra.authInfo?.extra?.caller;
  return (caller as McpCaller) ?? null;
}

/** Wraps a tool body with caller resolution and error normalization. */
function guard(
  run: (args: Record<string, unknown>, caller: McpCaller) => Promise<unknown>
) {
  return async (
    args: Record<string, unknown>,
    extra: { authInfo?: { extra?: Record<string, unknown> } }
  ): Promise<CallToolResult> => {
    const caller = callerFrom(extra);
    if (!caller) return errorResult("Unauthorized");

    try {
      return textResult(await run(args, caller));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return errorResult(message);
    }
  };
}

/** Builds a Zod shape from a read tool's whitelisted filters (+ limit). */
function readToolShape(tool: ReadTool): ZodRawShape {
  const shape: ZodRawShape = {};
  for (const [arg, filter] of Object.entries(tool.filters)) {
    const base =
      filter.type === "int" ? z.number().int() : filter.type === "bool" ? z.boolean() : z.string();
    shape[arg] = base.optional();
  }
  shape.limit = z
    .number()
    .int()
    .positive()
    .optional()
    .describe(`Max rows (default ${tool.defaultLimit}, max ${tool.maxLimit}).`);
  return shape;
}

/**
 * Registers every MCP tool on the server. Registration is static; per-request
 * authorization (permission + PT scope) is enforced inside each handler using
 * the caller from `withMcpAuth`. Tools the key lacks permission for return a
 * clear "forbidden" error rather than being hidden.
 */
export function registerAllTools(server: McpServer): void {
  // Read tools (over hv_* views).
  for (const tool of READ_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: readToolShape(tool) },
      guard(async (args, caller) => {
        if (tool.permission && !canAny(caller.permissions, tool.permission)) {
          throw new AppError(`Tidak punya izin untuk tool "${tool.name}"`, 403, "FORBIDDEN");
        }
        return runReadTool(tool, args, caller);
      })
    );
  }

  // Raw read escape hatch — global keys only.
  server.registerTool(
    RUN_QUERY_TOOL,
    {
      description:
        "Run an ad-hoc read-only SELECT restricted to hv_* views. Global keys (Super Admin/Owner) only. Single statement, no writes.",
      inputSchema: { sql: z.string().describe("A single SELECT over hv_* views.") },
    },
    guard(async (args, caller) => {
      if (caller.companyId !== null) {
        throw new AppError("run_read_query hanya untuk key global (Super Admin/Owner)", 403, "FORBIDDEN");
      }
      return runReadQuery(String(args.sql ?? ""));
    })
  );

  // Operate tools (through the service layer).
  for (const tool of OPERATE_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      guard(async (args, caller) => {
        if (!canAny(caller.permissions, tool.permission)) {
          throw new AppError(`Tidak punya izin untuk tool "${tool.name}"`, 403, "FORBIDDEN");
        }
        return tool.handler(args, caller);
      })
    );
  }
}
