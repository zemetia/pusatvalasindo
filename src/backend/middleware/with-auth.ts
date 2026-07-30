import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/backend/errors/app-error";

type SessionUser = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>["user"];

export type AuthContext = {
  user: SessionUser;
};

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

export function withAuth<C extends object>(
  handler: Handler<C & AuthContext>
): Handler<C> {
  return async (req: NextRequest, ctx: C) => {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) throw new UnauthorizedError();
    return handler(req, { ...ctx, user: session.user });
  };
}
