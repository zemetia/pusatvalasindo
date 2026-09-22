import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { fail } from "@/backend/helpers/api-response";
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { applyRateLimit } from './proxy/rate-limit';
import { applySecurityHeaders } from './proxy/security-headers';

const intlMiddleware = createMiddleware(routing);

function extractLocale(pathname: string): string {
  const match = pathname.match(/^\/(en|id)(\/|$)/);
  return match ? match[1] : routing.defaultLocale;
}

/** Area privat: jangan pernah masuk indeks (sabuk pengaman selain meta robots & robots.txt). */
const PRIVATE_PATH = /^(?:\/(?:en|id))?\/(?:dashboard|login|signup|logout|old|metrics-preview)(?:\/|$)/;

function noIndex(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

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

  // Cheap, optimistic gate: reject requests that carry no session cookie at all.
  //
  // This deliberately does NOT validate the cookie — `getSessionCookie` only parses it
  // and performs no signature verification. Real enforcement lives in the routes, which each
  // call `requirePermission`/`requireAuth` and hit the database through the
  // request-cached `getCallerRecord`. Doing it there instead of here is what lets this
  // file avoid importing `@/lib/auth` (and with it Prisma + the pg driver): the
  // middleware runs on EVERY request, so that import made every page navigation pay for
  // a heavyweight middleware bundle and a second session round trip on top of the one
  // the route was already doing.
  //
  // If you add a route, give it its own guard — this check will not protect it.
  //
  // /api/auth       — Better Auth's own endpoints
  // /api/mcp        — the MCP endpoint authenticates via Bearer key (withMcpAuth),
  //                   not a session cookie, so it must bypass the session gate here.
  // /api/scrape     — triggered by an external scheduler with no session cookie;
  //                   checks `Authorization: Bearer $CRON_SECRET` itself (see route.ts).
  if (
    isApi &&
    !targetPathname.startsWith("/api/auth") &&
    !targetPathname.startsWith("/api/mcp") &&
    !targetPathname.startsWith("/api/scrape")
  ) {
    if (!sessionCookie) {
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
    return noIndex(applySecurityHeaders(NextResponse.next()));
  }

  // 2. Handle Auth Redirects (locale-aware)
  const locale = extractLocale(pathname);

  const isDashboardPage =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/en/dashboard") ||
    pathname.startsWith("/id/dashboard");

  // Guard: redirect to login if no session cookie at all.
  // We do NOT redirect away from login/signup here — that check lives in the login
  // page itself using a real session validation, preventing stale-cookie redirect loops.
  if (isDashboardPage && !sessionCookie) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // 3. Handle i18n + security headers
  const response = applySecurityHeaders(intlMiddleware(request));
  return PRIVATE_PATH.test(pathname) ? noIndex(response) : response;
}

export const config = {
  runtime: "nodejs",
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|opengraph-image|robots\\.txt|sitemap\\.xml|llms\\.txt|llms-full\\.txt|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
    "/api/:path*",
    "/en/api/:path*",
    "/id/api/:path*",
  ],
};
