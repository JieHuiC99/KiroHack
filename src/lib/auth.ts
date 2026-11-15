// No `import "server-only"` here: the Better Auth CLI (npm run auth:migrate) must be able to load
// this file. It is still server-only in practice — client code imports ./auth-client instead.
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

/**
 * Better Auth owns its own tables (user, session, account, verification) in the SAME Postgres
 * database as the TypeORM tables. Create/update them with:  npm run auth:migrate
 * Never define TypeORM entities for those tables — reference users by `ownerId: string`.
 */
export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DB_POOL_MAX ?? 3),
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      // How the person evacuates: "other" (sees the screen, uses stairs), "blind" or "wheelchair".
      // Chosen by the person at sign-in. It grants nothing: roles come from src/lib/roles.ts, never from here.
      profile: { type: "string", required: false, defaultValue: "other", input: true },
    },
  },
  // Vercel preview URLs change per deployment; trust the current one explicitly.
  trustedOrigins: [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter(Boolean)
    .map((host) => `https://${host}`),
  // Built-in rate limiting is on in production by default; keep it on for auth endpoints.
  rateLimit: { enabled: process.env.NODE_ENV === "production" },
  socialProviders: process.env.GITHUB_CLIENT_ID
    ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET! } }
    : undefined,
  plugins: [nextCookies()], // must stay last: lets server actions set auth cookies
});

export type Session = typeof auth.$Infer.Session;
