import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getAdminCaller } from "@/backend/helpers/get-admin-caller";

// GET: Fetch all custom roles
export async function GET(req: NextRequest) {
  try {
    const caller = await getAdminCaller();
    if (caller instanceof NextResponse) return caller;

    // Kepala Cabang only sees roles for their own company
    const companyFilter =
      caller.roleName === "KEPALA_CABANG" && caller.companyId
        ? { companyId: caller.companyId }
        : {};

    const roles = await prisma.custom_role.findMany({
      where: companyFilter,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json(ok(roles));
  } catch (e: unknown) {
    return handleError(e);
  }
}

// POST: Create a new custom role
const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  companyId: z.string().optional(),
});

type CreateBody = z.infer<typeof createRoleSchema>;

export const POST = withValidation(createRoleSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await getAdminCaller();
      if (caller instanceof NextResponse) return caller;

      const { name, description, permissions, companyId } = ctx.body;

      const role = await prisma.custom_role.create({
        data: {
          name,
          description: description || null,
          permissions: permissions || [],
          companyId: companyId || null,
        },
      });

      return NextResponse.json(ok(role, "Peran berhasil dibuat"), { status: 201 });
    } catch (e: unknown) {
      if (e instanceof Error && e.message.toLowerCase().includes("unique constraint")) {
        return NextResponse.json({ error: "Nama peran sudah ada" }, { status: 409 });
      }
      return handleError(e);
    }
  }
);
