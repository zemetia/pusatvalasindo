# Backend Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full layered backend architecture (errors, helpers, middleware, repositories, services, controllers) for the Pusat Kirim Duit system with a working `users` module as the reference implementation.

**Architecture:** Layer-based organization inside `/backend` (repositories, services, middleware, errors, helpers). Thin controllers in `app/api/`. Native `middleware.ts` at root for global auth guard. Composable wrappers for per-route concerns.

**Tech Stack:** Next.js 16 App Router, Better Auth, Prisma 7, PostgreSQL, Zod, TypeScript, Vitest

---

## File Map

| File | Action |
|------|--------|
| `vitest.config.ts` | Create |
| `backend/errors/app-error.ts` | Create |
| `backend/helpers/api-response.ts` | Create |
| `backend/middleware/with-auth.ts` | Create |
| `backend/middleware/with-role.ts` | Create |
| `backend/middleware/with-validation.ts` | Create |
| `middleware.ts` | Create |
| `backend/repositories/user.repository.ts` | Create |
| `backend/services/user.service.ts` | Create |
| `app/api/users/route.ts` | Create |
| `app/api/users/[id]/route.ts` | Create |
| `app/api/route.ts` | Modify |

---

## Task 1: Setup Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add test script)

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

Expected output: vitest added to devDependencies.

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts` at project root:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@src": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add inside `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

```bash
npm test
```

Expected: `No test files found, exiting with code 0` or similar — no errors.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---

## Task 2: Error Classes

**Files:**
- Create: `backend/errors/app-error.ts`
- Create: `backend/errors/app-error.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/errors/app-error.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "./app-error";

describe("AppError", () => {
  it("sets message and statusCode", () => {
    const err = new AppError("something broke", 400);
    expect(err.message).toBe("something broke");
    expect(err.statusCode).toBe(400);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("NotFoundError", () => {
  it("defaults to 404 with default message", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Not found");
  });
  it("accepts custom message", () => {
    const err = new NotFoundError("User not found");
    expect(err.message).toBe("User not found");
  });
});

describe("UnauthorizedError", () => {
  it("defaults to 401", () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });
});

describe("ForbiddenError", () => {
  it("defaults to 403", () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });
});

describe("ValidationError", () => {
  it("defaults to 422", () => {
    expect(new ValidationError().statusCode).toBe(422);
  });
});

describe("ConflictError", () => {
  it("defaults to 409", () => {
    expect(new ConflictError().statusCode).toBe(409);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test backend/errors/app-error.test.ts
```

Expected: FAIL — `Cannot find module './app-error'`

- [ ] **Step 3: Implement error classes**

Create `backend/errors/app-error.ts`:

```ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(msg = "Not found") {
    super(msg, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "Unauthorized") {
    super(msg, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = "Forbidden") {
    super(msg, 403);
  }
}

export class ValidationError extends AppError {
  constructor(msg = "Validation failed") {
    super(msg, 422);
  }
}

export class ConflictError extends AppError {
  constructor(msg = "Conflict") {
    super(msg, 409);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test backend/errors/app-error.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/errors/app-error.ts backend/errors/app-error.test.ts
git commit -m "feat: add typed AppError classes"
```

---

## Task 3: API Response Helper

**Files:**
- Create: `backend/helpers/api-response.ts`
- Create: `backend/helpers/api-response.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/helpers/api-response.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ok, fail } from "./api-response";

describe("ok()", () => {
  it("returns success shape with data", () => {
    const result = ok({ id: "1", name: "John" });
    expect(result).toEqual({
      success: true,
      data: { id: "1", name: "John" },
      message: null,
    });
  });

  it("includes optional message", () => {
    const result = ok("created", "User created successfully");
    expect(result.message).toBe("User created successfully");
    expect(result.success).toBe(true);
  });
});

describe("fail()", () => {
  it("returns failure shape", () => {
    const result = fail("Not found", "User does not exist");
    expect(result).toEqual({
      success: false,
      data: null,
      error: "Not found",
      message: "User does not exist",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test backend/helpers/api-response.test.ts
```

Expected: FAIL — `Cannot find module './api-response'`

- [ ] **Step 3: Implement api-response helpers**

Create `backend/helpers/api-response.ts`:

```ts
export function ok<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    message: message ?? null,
  };
}

export function fail(error: string, message: string) {
  return {
    success: false as const,
    data: null,
    error,
    message,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test backend/helpers/api-response.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/helpers/api-response.ts backend/helpers/api-response.test.ts
git commit -m "feat: add ok() and fail() API response helpers"
```

---

## Task 4: Composable Middleware

**Files:**
- Create: `backend/middleware/with-auth.ts`
- Create: `backend/middleware/with-role.ts`
- Create: `backend/middleware/with-validation.ts`

No unit tests for these — they wrap Next.js `NextRequest` which requires integration context. They will be verified when the controller routes are tested manually.

- [ ] **Step 1: Create `withAuth`**

Create `backend/middleware/with-auth.ts`:

```ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/backend/errors/app-error";

export type AuthContext = {
  user: {
    id: string;
    name: string;
    email: string;
  };
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
```

- [ ] **Step 2: Create `withRole`**

Create `backend/middleware/with-role.ts`:

```ts
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/backend/errors/app-error";
import { AuthContext } from "./with-auth";

type UserWithRole = AuthContext["user"] & { role?: string };
type HandlerWithRole<C> = (
  req: NextRequest,
  ctx: C & { user: UserWithRole }
) => Promise<Response>;

export function withRole(roles: string[]) {
  return function <C extends { user: UserWithRole }>(
    handler: HandlerWithRole<C>
  ): HandlerWithRole<C> {
    return async (req: NextRequest, ctx: C & { user: UserWithRole }) => {
      if (!ctx.user.role || !roles.includes(ctx.user.role)) {
        throw new ForbiddenError();
      }
      return handler(req, ctx);
    };
  };
}
```

- [ ] **Step 3: Create `withValidation`**

Create `backend/middleware/with-validation.ts`:

```ts
import { NextRequest } from "next/server";
import { ZodSchema } from "zod";
import { ValidationError } from "@/backend/errors/app-error";

type HandlerWithBody<C, T> = (
  req: NextRequest,
  ctx: C & { body: T }
) => Promise<Response>;

export function withValidation<T>(schema: ZodSchema<T>) {
  return function <C extends object>(
    handler: HandlerWithBody<C, T>
  ): (req: NextRequest, ctx: C) => Promise<Response> {
    return async (req: NextRequest, ctx: C) => {
      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        throw new ValidationError("Request body must be valid JSON");
      }
      const result = schema.safeParse(raw);
      if (!result.success) {
        throw new ValidationError(result.error.errors[0]?.message ?? "Validation failed");
      }
      return handler(req, { ...ctx, body: result.data });
    };
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/middleware/with-auth.ts backend/middleware/with-role.ts backend/middleware/with-validation.ts
git commit -m "feat: add composable middleware (withAuth, withRole, withValidation)"
```

---

## Task 5: Native Next.js Middleware

**Files:**
- Create: `middleware.ts` (project root)

- [ ] **Step 1: Create root middleware.ts**

Create `middleware.ts` at the project root:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized", message: "You must be logged in" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
  // Better Auth's own routes must be excluded
  // Next.js will not run middleware for /api/auth/* because Better Auth
  // handles those routes before middleware can block them.
  // If you need to be explicit, add a negative lookahead in the matcher:
  // matcher: ["/api/((?!auth).*)"],
};
```

> **Note:** The matcher `/api/:path*` will match all `/api/*` routes. Better Auth's `/api/auth/*` routes are handled by Next.js before this middleware can interfere — but if you see auth routes being blocked, change the matcher to `"/api/((?!auth).*)"`.

- [ ] **Step 2: Start the dev server and verify**

```bash
npm run dev
```

Then in a browser or with curl, hit an unprotected route:

```bash
curl http://localhost:3000/api/users
```

Expected: `{ "success": false, "error": "Unauthorized", ... }` with status 401.

Then verify that login still works at `/login` — it should not be blocked by middleware.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Next.js native middleware for global API auth guard"
```

---

## Task 6: User Repository

**Files:**
- Create: `backend/repositories/user.repository.ts`

No unit tests — repository methods are thin Prisma wrappers. They are verified through the service tests in Task 7 (mocked) and through manual API testing in Task 9.

- [ ] **Step 1: Create user repository**

Create `backend/repositories/user.repository.ts`:

```ts
import prisma from "@/lib/prisma";

export type CreateUserInput = {
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateUserInput = Partial<{
  name: string;
  image: string;
}>;

export const userRepository = {
  findAll: () =>
    prisma.user.findMany({
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    }),

  findById: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    }),

  findByEmail: (email: string) =>
    prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    }),

  update: (id: string, data: UpdateUserInput) =>
    prisma.user.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    }),

  delete: (id: string) =>
    prisma.user.delete({ where: { id } }),
};
```

> **Note:** `create` is intentionally omitted — user creation is handled exclusively by Better Auth. Direct user creation bypasses password hashing.

- [ ] **Step 2: Commit**

```bash
git add backend/repositories/user.repository.ts
git commit -m "feat: add user repository with Prisma queries"
```

---

## Task 7: User Service

**Files:**
- Create: `backend/services/user.service.ts`
- Create: `backend/services/user.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/services/user.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError } from "../errors/app-error";

// Mock the repository before importing the service
vi.mock("../repositories/user.repository", () => ({
  userRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { userService } from "./user.service";
import { userRepository } from "../repositories/user.repository";

const mockUser = {
  id: "user-1",
  name: "John Doe",
  email: "john@example.com",
  image: null,
  createdAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("userService.getAll()", () => {
  it("returns all users from repository", async () => {
    vi.mocked(userRepository.findAll).mockResolvedValue([mockUser]);
    const result = await userService.getAll();
    expect(result).toEqual([mockUser]);
    expect(userRepository.findAll).toHaveBeenCalledOnce();
  });
});

describe("userService.getById()", () => {
  it("returns user when found", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    const result = await userService.getById("user-1");
    expect(result).toEqual(mockUser);
  });

  it("throws NotFoundError when user does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    await expect(userService.getById("missing")).rejects.toThrow(NotFoundError);
    await expect(userService.getById("missing")).rejects.toThrow("User not found");
  });
});

describe("userService.update()", () => {
  it("updates and returns user", async () => {
    const updated = { ...mockUser, name: "Jane Doe" };
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(userRepository.update).mockResolvedValue(updated);
    const result = await userService.update("user-1", { name: "Jane Doe" });
    expect(result.name).toBe("Jane Doe");
  });

  it("throws NotFoundError when user does not exist before update", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    await expect(
      userService.update("missing", { name: "Jane" })
    ).rejects.toThrow(NotFoundError);
  });
});

describe("userService.delete()", () => {
  it("deletes user when found", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(userRepository.delete).mockResolvedValue(mockUser as any);
    await expect(userService.delete("user-1")).resolves.toBeUndefined();
  });

  it("throws NotFoundError when user does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    await expect(userService.delete("missing")).rejects.toThrow(NotFoundError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test backend/services/user.service.test.ts
```

Expected: FAIL — `Cannot find module './user.service'`

- [ ] **Step 3: Implement user service**

Create `backend/services/user.service.ts`:

```ts
import { userRepository, UpdateUserInput } from "@/backend/repositories/user.repository";
import { NotFoundError } from "@/backend/errors/app-error";

export const userService = {
  getAll: () => userRepository.findAll(),

  getById: async (id: string) => {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  },

  update: async (id: string, data: UpdateUserInput) => {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return userRepository.update(id, data);
  },

  delete: async (id: string) => {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    await userRepository.delete(id);
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test backend/services/user.service.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/user.service.ts backend/services/user.service.test.ts
git commit -m "feat: add user service with business logic"
```

---

## Task 8: User Controllers (Collection Routes)

**Files:**
- Create: `app/api/users/route.ts`

- [ ] **Step 1: Create a shared controller error handler helper**

Create `backend/helpers/handle-error.ts`:

```ts
import { NextResponse } from "next/server";
import { AppError } from "@/backend/errors/app-error";
import { fail } from "./api-response";

export function handleError(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json(fail(e.message, e.message), { status: e.statusCode });
  }
  console.error("[Unhandled error]", e);
  return NextResponse.json(fail("Server error", "An unexpected error occurred"), { status: 500 });
}
```

- [ ] **Step 2: Create users collection route**

Create `app/api/users/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/backend/services/user.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";

export async function GET(_req: NextRequest) {
  try {
    const users = await userService.getAll();
    return NextResponse.json(ok(users));
  } catch (e) {
    return handleError(e);
  }
}
```

> **Note:** POST (user creation) is omitted — user registration is handled by Better Auth at `/api/auth/sign-up`.

- [ ] **Step 3: Verify manually**

Start the dev server (`npm run dev`), log in via the app UI to get a valid session cookie, then:

```bash
curl -H "Cookie: <your-session-cookie>" http://localhost:3000/api/users
```

Expected:
```json
{ "success": true, "data": [...], "message": null }
```

- [ ] **Step 4: Commit**

```bash
git add app/api/users/route.ts backend/helpers/handle-error.ts
git commit -m "feat: add GET /api/users controller"
```

---

## Task 9: User Controllers (Single Resource Routes)

**Files:**
- Create: `app/api/users/[id]/route.ts`

- [ ] **Step 1: Create Zod schema for user update**

At the top of `app/api/users/[id]/route.ts`, define the schema inline:

```ts
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
});
```

- [ ] **Step 2: Create the full single-resource route file**

Create `app/api/users/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userService } from "@/backend/services/user.service";
import { ok } from "@/backend/helpers/api-response";
import { handleError } from "@/backend/helpers/handle-error";
import { ValidationError } from "@/backend/errors/app-error";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await userService.getById(id);
    return NextResponse.json(ok(user));
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }
    const result = updateUserSchema.safeParse(body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message ?? "Validation failed");
    }
    const updated = await userService.update(id, result.data);
    return NextResponse.json(ok(updated, "User updated successfully"));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await userService.delete(id);
    return NextResponse.json(ok(null, "User deleted successfully"));
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 3: Verify GET /api/users/:id manually**

```bash
curl -H "Cookie: <session-cookie>" http://localhost:3000/api/users/<valid-user-id>
```

Expected:
```json
{ "success": true, "data": { "id": "...", "name": "...", "email": "..." }, "message": null }
```

- [ ] **Step 4: Verify 404 for missing user**

```bash
curl -H "Cookie: <session-cookie>" http://localhost:3000/api/users/nonexistent-id
```

Expected:
```json
{ "success": false, "data": null, "error": "User not found", "message": "User not found" }
```
Status: 404

- [ ] **Step 5: Verify PUT /api/users/:id**

```bash
curl -X PUT \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}' \
  http://localhost:3000/api/users/<valid-user-id>
```

Expected:
```json
{ "success": true, "data": { "id": "...", "name": "Updated Name", ... }, "message": "User updated successfully" }
```

- [ ] **Step 6: Commit**

```bash
git add app/api/users/[id]/route.ts
git commit -m "feat: add GET, PUT, DELETE /api/users/:id controllers"
```

---

## Task 10: Clean Up Existing Route and Run All Tests

**Files:**
- Modify: `app/api/route.ts`

- [ ] **Step 1: Replace the raw Prisma call in `app/api/route.ts`**

Open `app/api/route.ts` and replace its contents with a simple health check:

```ts
import { NextResponse } from "next/server";
import { ok } from "@/backend/helpers/api-response";

export async function GET() {
  return NextResponse.json(ok({ status: "ok" }, "API is running"));
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: All tests pass — `app-error.test.ts` (6 tests), `api-response.test.ts` (3 tests), `user.service.test.ts` (6 tests).

- [ ] **Step 3: Commit**

```bash
git add app/api/route.ts
git commit -m "refactor: clean up health check route, complete backend architecture scaffold"
```

---

## Conventions for Future Modules

When adding a new module (e.g., `attendance`):

1. Create `backend/repositories/attendance.repository.ts` — Prisma queries only
2. Create `backend/services/attendance.service.ts` — business logic, uses repository
3. Create `backend/services/attendance.service.test.ts` — unit tests with mocked repo
4. Create `app/api/attendance/route.ts` — collection endpoints (GET, POST)
5. Create `app/api/attendance/[id]/route.ts` — single resource endpoints (GET, PUT, DELETE)
6. Define Zod schemas inline in the route file; extract to `[module].schema.ts` only if reused across routes

No new top-level folders needed. All business logic stays in services. No Prisma calls outside of repositories.
