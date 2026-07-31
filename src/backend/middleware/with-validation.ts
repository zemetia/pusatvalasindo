import type { NextRequest } from "next/server";
import type { ZodSchema } from "zod";
import { ValidationError } from "@/backend/errors/app-error";
import { handleError } from "@/backend/helpers/handle-error";

type HandlerWithBody<C, T> = (
  req: NextRequest,
  ctx: C & { body: T }
) => Promise<Response>;

export function withValidation<T>(schema: ZodSchema<T>) {
  return function <C extends object>(
    handler: HandlerWithBody<C, T>
  ): any { // Use any to bypass Next.js internal route type checking
    return async (req: NextRequest, ctx: C) => {
      // Validasi body dijalankan SEBELUM masuk try/catch handler route (yang
      // menangkap error lewat `handleError` di dalam badan async-nya sendiri) —
      // jadi throw di sini harus ditangkap DI SINI juga, bukan dibiarkan lolos
      // sampai ke Next.js sebagai 500 kosong tanpa pesan.
      try {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          throw new ValidationError("Request body must be valid JSON");
        }
        const result = schema.safeParse(raw);
        if (!result.success) {
          const issue = result.error.errors[0];
          const message = issue
            ? `${issue.path.join(".") || "body"}: ${issue.message}`
            : "Validation failed";
          throw new ValidationError(message);
        }
        return await handler(req, { ...ctx, body: result.data });
      } catch (e) {
        return handleError(e);
      }
    };
  };
}
