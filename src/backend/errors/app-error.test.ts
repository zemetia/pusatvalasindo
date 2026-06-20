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
