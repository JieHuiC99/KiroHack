import { describe, expect, it } from "vitest";
import { assertServerEnv } from "./env";

const valid = { DATABASE_URL: "postgres://u:p@localhost:5432/app", BETTER_AUTH_SECRET: "x".repeat(32) };

describe("assertServerEnv", () => {
  it("accepts a minimal valid environment", () => {
    expect(assertServerEnv(valid).DB_SYNC).toBe("false");
  });

  it("rejects a short auth secret", () => {
    expect(() => assertServerEnv({ ...valid, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("forbids DB_SYNC in Vercel production", () => {
    expect(() => assertServerEnv({ ...valid, DB_SYNC: "true", VERCEL_ENV: "production" })).toThrow(/DB_SYNC/);
  });
});
