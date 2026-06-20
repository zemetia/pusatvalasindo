import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { withValidation } from "@/backend/middleware/with-validation";
import { getAdminCaller } from "@/backend/helpers/get-admin-caller";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getAdminCaller();
    if (caller instanceof NextResponse) return caller;

    const { id } = await params;

    const existingRole = await prisma.custom_role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Peran tidak ditemukan" }, { status: 404 });
    }

    if (existingRole._count.users > 0) {
      return NextResponse.json(
        { error: "Tidak dapat menghapus peran yang masih digunakan oleh pengguna" },
        { status: 400 }
      );
    }

    await prisma.custom_role.delete({ where: { id } });

    return NextResponse.json(ok(null, "Peran berhasil dihapus"));
  } catch (e: unknown) {
    return handleError(e);
  }
}

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

type UpdateBody = z.infer<typeof updateRoleSchema>;

export const PUT = withValidation(updateRoleSchema)(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }>; body: UpdateBody }) => {
    try {
      const caller = await getAdminCaller();
      if (caller instanceof NextResponse) return caller;

      const { id } = await ctx.params;
      const { name, description, permissions } = ctx.body;

      const existingRole = await prisma.custom_role.findUnique({ where: { id } });
      if (!existingRole) {
        return NextResponse.json({ error: "Peran tidak ditemukan" }, { status: 404 });
      }

      const updated = await prisma.custom_role.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(permissions && { permissions }),
        },
      });

      return NextResponse.json(ok(updated, "Peran berhasil diperbarui"));
    } catch (e: unknown) {
      if (e instanceof Error && e.message.toLowerCase().includes("unique constraint")) {
        return NextResponse.json({ error: "Nama peran sudah ada" }, { status: 409 });
      }
      return handleError(e);
    }
  }
);
