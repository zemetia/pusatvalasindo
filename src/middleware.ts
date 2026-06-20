import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { auth } from "@/lib/auth";
import { fail } from "@/backend/helpers/api-response";
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { applyRateLimit } from './proxy/rate-limit';
import { applySecurityHeaders } from './proxy/security-headers';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit — returns 429 early for /api/* if threshold exceeded
  const rateLimited = await applyRateLimit(request);
  if (rateLimited) return rateLimited;

  const sessionCookie = getSessionCookie(request);

  // 1. Handle API Protection
  let targetPathname = pathname;
  const localeMatch = pathname.match(/^\/(en|id)\/api\/(.*)/);
  if (localeMatch) {
    targetPathname = `/api/${localeMatch[2]}`;
  }

  const isApi = targetPathname.startsWith("/api/");

  if (isApi && !targetPathname.startsWith("/api/auth")) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return applySecurityHeaders(
        NextResponse.json(fail("Unauthorized", "You must be logged in"), { status: 401 })
      );
    }
  }

  // Rewrite localized API paths to canonical form
  if (isApi) {
    if (targetPathname !== pathname) {
      const url = request.nextUrl.clone();
      url.pathname = targetPathname;
      return applySecurityHeaders(NextResponse.rewrite(url));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // 2. Handle Auth Redirects (locale-aware)
  const isAuthPage = ["/login", "/signup"].some(p =>
    pathname === p || pathname.startsWith(`/en${p}`) || pathname.startsWith(`/id${p}`)
  );
  const isDashboardPage =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/en/dashboard") ||
    pathname.startsWith("/id/dashboard");

  if (isAuthPage && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isDashboardPage && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 3. Handle i18n + security headers
  return applySecurityHeaders(intlMiddleware(request));
}

export const config = {
  runtime: "nodejs",
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
    "/api/:path*",
    "/en/api/:path*",
    "/id/api/:path*",
  ],
};
