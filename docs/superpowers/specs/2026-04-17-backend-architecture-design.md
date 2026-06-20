# Backend Architecture Design — Pusat Kirim Duit
**Date:** 2026-04-17
**Project:** Pusat Kirim Duit (Money Changer Management System)
**Stack:** Next.js 16 App Router + Better Auth + Prisma 7 + PostgreSQL

---

## Overview

This document specifies the clean backend architecture for the Pusat Kirim Duit system. The architecture follows a layered approach organized by layer type inside a `/backend` folder, with thin controllers in `app/api/`.

---

## 1. Folder Structure

```
backend/
  repositories/
    user.repository.ts
    attendance.repository.ts
    payroll.repository.ts
    kpi.repository.ts
    currency.repository.ts
    finance.repository.ts
  services/
    user.service.ts
    attendance.service.ts
    payroll.service.ts
    kpi.service.ts
    currency.service.ts
    finance.service.ts
  middleware/
    with-auth.ts          ← checks session, attaches user to handler context
    with-role.ts          ← role-based access guard (RBAC)
    with-validation.ts    ← Zod schema validation wrapper
  errors/
    app-error.ts          ← base AppError class + all typed HTTP error subclasses
  helpers/
    api-response.ts       ← ok() and fail() response shape helpers

middleware.ts             ← Next.js native: global session guard on /api/* (root level)

app/api/
  auth/[...all]/route.ts  ← Better Auth catch-all (unchanged)
  users/
    route.ts              ← GET /api/users, POST /api/users
    [id]/route.ts         ← GET, PUT, DELETE /api/users/:id
  attendance/
    route.ts
    [id]/route.ts
  payroll/
    route.ts
    [id]/route.ts
  kpi/
    route.ts
    [id]/route.ts
  currency/
    route.ts
    [id]/route.ts
  finance/
    route.ts
    [id]/route.ts
```

New modules get one repository file, one service file, and one `app/api/[module]/` folder. No new top-level folders needed.

---

## 2. Layer Responsibilities

### Native Middleware (`middleware.ts` — root level)
- Intercepts all requests to `/api/*` before they reach route handlers
- Verifies Better Auth session token
- Blocks unauthenticated requests (returns 401) — except `/api/auth/*`
- Does NOT attach user to request (Next.js middleware runs on Edge; session user is fetched per-route via composable wrapper)

### Controller (`app/api/[module]/route.ts`)
- Thin pass-through only — no business logic
- Wraps handler with composable middleware (`withAuth`, `withRole`, `withValidation`)
- Calls one service method per handler
- Catches `AppError` and maps to `ApiResponse` with correct HTTP status
- Catches unknown errors and returns 500

### Service (`backend/services/[module].service.ts`)
- Holds all business logic for the module
- Orchestrates calls to one or more repositories
- Throws typed `AppError` subclasses on failure (never raw errors)
- Does not know about HTTP — returns plain data or throws

### Repository (`backend/repositories/[module].repository.ts`)
- Pure Prisma calls only — no business logic, no error throwing
- One exported method per DB operation: `findAll`, `findById`, `create`, `update`, `delete`
- Receives plain data arguments, returns plain Prisma objects

---

## 3. Data Flow

```
Incoming Request
  ↓
middleware.ts (Next.js native — Edge)
  — session check via Better Auth
  — 401 if no valid session (except /api/auth/*)
  ↓
app/api/[module]/route.ts (Controller)
  — withAuth()       → attaches session user to context
  — withRole(roles)  → checks user.role against allowed roles
  — withValidation(schema) → validates request body via Zod
  — calls service method
  — returns NextResponse.json(ok(data)) or catches and returns fail(...)
  ↓
backend/services/[module].service.ts (Service)
  — business logic
  — calls repository methods
  — throws typed AppError on failure
  ↓
backend/repositories/[module].repository.ts (Repository)
  — Prisma query
  — returns raw data
  ↓
Prisma → PostgreSQL
```

---

## 4. Error Handling

### Error Classes (`backend/errors/app-error.ts`)

```ts
export class AppError extends Error {
  constructor(public message: string, public statusCode: number) {
    super(message);
  }
}
export class NotFoundError extends AppError {
  constructor(msg = "Not found") { super(msg, 404); }
}
export class UnauthorizedError extends AppError {
  constructor(msg = "Unauthorized") { super(msg, 401); }
}
export class ForbiddenError extends AppError {
  constructor(msg = "Forbidden") { super(msg, 403); }
}
export class ValidationError extends AppError {
  constructor(msg = "Validation failed") { super(msg, 422); }
}
export class ConflictError extends AppError {
  constructor(msg = "Conflict") { super(msg, 409); }
}
```

### Error Flow
1. Repository executes Prisma query — returns data or throws Prisma error
2. Service catches Prisma errors and re-throws as typed `AppError` (e.g., `P2025` → `NotFoundError`)
3. Controller catches `AppError` → maps to `fail()` response with `e.statusCode`
4. Controller catches unknown errors → returns 500

---

## 5. Response Shape

All API responses use a consistent shape via helpers in `backend/helpers/api-response.ts`.

```ts
// Success
{ success: true,  data: T,    message?: string }

// Failure
{ success: false, data: null, error: string, message: string }
```

```ts
export function ok<T>(data: T, message?: string) {
  return { success: true, data, message ?? null }
}
export function fail(error: string, message: string) {
  return { success: false, data: null, error, message }
}
```

---

## 6. Composable Middleware

### `withAuth` — attaches session user
```ts
// backend/middleware/with-auth.ts
export function withAuth(handler) {
  return async (req: NextRequest) => {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session) throw new UnauthorizedError()
    return handler(req, { user: session.user })
  }
}
```

### `withRole` — RBAC guard
```ts
// backend/middleware/with-role.ts
export function withRole(roles: string[]) {
  return (handler) => async (req, ctx) => {
    if (!roles.includes(ctx.user.role)) throw new ForbiddenError()
    return handler(req, ctx)
  }
}
```

### `withValidation` — Zod body validation
```ts
// backend/middleware/with-validation.ts
export function withValidation<T>(schema: ZodSchema<T>) {
  return (handler) => async (req, ctx) => {
    const body = await req.json()
    const result = schema.safeParse(body)
    if (!result.success) throw new ValidationError(result.error.message)
    return handler(req, { ...ctx, body: result.data })
  }
}
```

---

## 7. Concrete File Examples

### Repository
```ts
// backend/repositories/user.repository.ts
import prisma from "@/lib/prisma"

export const userRepository = {
  findAll: () => prisma.user.findMany(),
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),
  create: (data: Prisma.userCreateInput) => prisma.user.create({ data }),
  update: (id: string, data: Prisma.userUpdateInput) =>
    prisma.user.update({ where: { id }, data }),
  delete: (id: string) => prisma.user.delete({ where: { id } }),
}
```

### Service
```ts
// backend/services/user.service.ts
import { userRepository } from "@/backend/repositories/user.repository"
import { NotFoundError } from "@/backend/errors/app-error"

export const userService = {
  getAll: () => userRepository.findAll(),
  getById: async (id: string) => {
    const user = await userRepository.findById(id)
    if (!user) throw new NotFoundError("User not found")
    return user
  },
}
```

### Controller
```ts
// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server"
import { userService } from "@/backend/services/user.service"
import { AppError } from "@/backend/errors/app-error"
import { ok, fail } from "@/backend/helpers/api-response"

export async function GET(req: NextRequest) {
  try {
    const data = await userService.getAll()
    return NextResponse.json(ok(data))
  } catch (e) {
    if (e instanceof AppError)
      return NextResponse.json(fail(e.message, e.message), { status: e.statusCode })
    return NextResponse.json(fail("Server error", "Unexpected error"), { status: 500 })
  }
}
```

---

## 8. Conventions

- File naming: `[module].repository.ts`, `[module].service.ts` — always kebab-case
- Each module gets exactly: one repository file, one service file, one `app/api/[module]/` folder
- No business logic in controllers or repositories
- No Prisma calls in services — always go through the repository
- All API responses use `ok()` or `fail()` — never raw `{ data: ... }` shapes
- Zod schemas are defined inline in the route file or in a `[module].schema.ts` file if reused
