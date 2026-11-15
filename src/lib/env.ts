import { z } from "zod";

// Fail fast with a readable message instead of a cryptic runtime error deep inside a request.
// Checked once at server start (src/instrumentation.ts) — not at build time, so `next build`
// and `docker build` work without secrets.
const bool = z.enum(["true", "false"]).default("false");

const schema = z
  .object({
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),
    DB_SYNC: bool,
    DATABASE_SSL: bool,
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.string().url().optional(),
    // Comma-separated email addresses. Everyone not listed is a student (src/lib/roles.ts).
    EMERGENCY_TEAM_EMAILS: z.string().optional(),
    RESPONDER_EMAILS: z.string().optional(),
    CLASSROOM_DEVICE_KEY: z.string().min(24, "CLASSROOM_DEVICE_KEY must be at least 24 characters").optional(),
    NEXT_PUBLIC_CCTV_URL_TEMPLATE: z.string().includes("{venue}", "NEXT_PUBLIC_CCTV_URL_TEMPLATE must contain {venue}").optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  })
  .refine((env) => !(env.VERCEL_ENV === "production" && env.DB_SYNC === "true"), {
    message: "DB_SYNC must not be true in production — use migrations (npm run db:migrate)",
    path: ["DB_SYNC"],
  });

export type ServerEnv = z.infer<typeof schema>;

export function assertServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${problems}\n(see .env.example)`);
  }
  return result.data;
}
