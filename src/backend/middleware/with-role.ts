import { NextRequest } from "next/server";
import { ForbiddenError } from "@/backend/errors/app-error";
import { AuthContext } from "./with-auth";

type UserWithRole = AuthContext["user"] & { role?: string };
type HandlerWithRole<C> = (
  req: NextRequest,
  ctx: C & { user: UserWithRole }
) => Promise<Response>;

// NOTE: Better Auth's base user schema does not include a `role` field.
// ctx.user.role will always be undefined until one of the following is done:
//   1. Add the Better Auth `admin` plugin to lib/auth.ts, or
//   2. Add a custom `additionalFields` session field for `role` in lib/auth.ts
// Do NOT use withRole in production routes until this is wired up.
export function withRole(roles: string[]) {
  return function <C extends { user: UserWithRole }>(
    handler: HandlerWithRole<C>
  ): HandlerWithRole<C> {
    return async (req: NextRequest, ctx: C) => {
      if (!ctx.user.role || !roles.includes(ctx.user.role)) {
        throw new ForbiddenError();
      }
      return handler(req, ctx);
    };
  };
}
