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

  it("sets message to null when omitted", () => {
    const result = ok({ id: "1" });
    expect(result.message).toBeNull();
    expect(Object.keys(result)).toContain("message");
  });
});

describe("fail()", () => {
  it("returns failure shape", () => {
    const result = fail("Not found", "User does not exist");
    // data is always null on failure — never carry partial results in an error response
    expect(result).toEqual({
      success: false,
      data: null,
      error: "Not found",
      message: "User does not exist",
    });
  });
});
