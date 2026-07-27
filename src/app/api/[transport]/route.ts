import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerAllTools } from "@/backend/mcp/register";
import { verifyMcpToken } from "@/backend/mcp/auth";

// Node runtime — the tools use Prisma + the pg adapter.
export const runtime = "nodejs";
export const maxDuration = 60;

// mcp-handler derives its endpoints from basePath. With this file at
// app/api/[transport]/route.ts and basePath "/api", the Streamable-HTTP
// endpoint is exactly `/api/mcp` (and legacy SSE at `/api/sse`).
const handler = createMcpHandler(
  registerAllTools,
  { serverInfo: { name: "pvi-mcp", version: "1.0.0" } },
  { basePath: "/api" }
);

// Every request must present a valid Role-PT key (Authorization: Bearer <key>).
// verifyMcpToken resolves it into the caller each tool handler authorizes against.
const authHandler = withMcpAuth(handler, verifyMcpToken, { required: true });

export { authHandler as GET, authHandler as POST };
