import { describe, expect, it } from "vitest";
import { assertServerEnv } from "./env";

const valid = { DATABASE_URL: "postgres://u:p@localhost:5432/app" };

describe("assertServerEnv", () => {
  it("accepts a minimal valid environment", () => {
    expect(assertServerEnv(valid).DB_SYNC).toBe("false");
  });

  it("rejects an invalid database URL", () => {
    expect(() => assertServerEnv({ DATABASE_URL: "invalid" })).toThrow(/DATABASE_URL/);
  });

  it("forbids DB_SYNC in Vercel production", () => {
    expect(() => assertServerEnv({ ...valid, DB_SYNC: "true", VERCEL_ENV: "production" })).toThrow(/DB_SYNC/);
  });
});
