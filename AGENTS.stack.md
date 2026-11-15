# Project stack rules (hackathon-stack)

Stack: Next.js 16 App Router + TypeScript · Tailwind + shadcn/ui · PostgreSQL + TypeORM · Better Auth ·
Vitest (unit + integration) · Playwright (E2E) · GitHub Actions CI/CD · Docker · Vercel (+ Supabase Postgres when deployed).
Don't introduce another ORM, auth library, CSS framework or test runner.

## Where code goes
- `src/app/**` — pages, layouts, `actions.ts` (server actions for UI mutations), `api/**/route.ts` (JSON API for external callers).
- `src/server/**` — services: the only code that calls `getDb()`/TypeORM. Starts with `import "server-only"`.
- `src/db/entities/*` — one entity per file, registered in `src/db/entities/index.ts`.
- `src/lib/validation/*` — zod schemas shared by forms and services.
- `src/components/ui` — shadcn components (`npx shadcn@latest add <name>`); app components in `src/components`.

## Architecture & clean code
- Dependencies point down: UI → actions/route handlers → `src/server` services → `src/db`. Components never import `getDb`.
- Entry points stay thin: parse input (zod) → `requireUser()` if needed → call one service → shape the response.
- Group code by feature (`server/teams.ts`), name things for what they do, return early, no `any`, no dead code,
  comments explain *why*. No extra layers (repositories, DI, base classes) until the same pain appears twice.

## Security (non-negotiable)
- Authorize in every action/handler with the session user, and scope queries by it (`{ id, ownerId: user.id }`).
  Never trust ids/roles from the client. `proxy.ts` is only a redirect, not a security check.
- Validate all external input with zod; parameterized queries only; never return tokens/auth rows.
- Secrets only in env (`.env` is git-ignored; never `NEXT_PUBLIC_` a secret). New env var → add to `.env.example` and `src/lib/env.ts`.
- Keep the security headers in `next.config.ts`, the non-root Dockerfile, and the CI `npm audit` gate.

## TypeORM rules (each one prevents a real failure)
- `@Entity("table_name")` and an explicit `type` on every `@Column` (tsx/esbuild doesn't emit decorator metadata).
- Relations: `@ManyToOne(() => Team, (t) => t.members) team!: Relation<Team>` — arrow target + `Relation<>`.
- Never create entities for Better Auth tables (`user`, `session`, `account`, `verification`); store `ownerId: text`.
- Schema changes: local dev uses `DB_SYNC=true`; before deploying run `npm run db:generate -- src/db/migrations/<Name>` and commit it.
- Keep `serverExternalPackages: ["typeorm","pg"]` and `experimental.serverMinification: false` in next.config.ts.

## Next.js 16 rules
- `cacheComponents` is on: DB/auth reads in server components go in an async child that calls `await connection()`
  (or reads `headers()`/`cookies()`), wrapped in `<Suspense>`. Don't add `export const runtime`/`dynamic` segment configs.
- `proxy.ts` (not middleware.ts) for optimistic auth redirects; real checks use `requireUser()` from `src/lib/session.ts`.
- Version-specific docs ship in `node_modules/next/dist/docs/` — check them before using an unfamiliar API.

## Tests
- Pure logic → co-located `*.test.ts` (`npm run test`). Services & route handlers → `tests/integration` against `app_test` (`npm run test:integration`).
- The demo flow → `e2e/*.spec.ts` (`npm run test:e2e`). Prefer `getByRole`/`getByLabel`; add `data-testid` only for lists.
- Every PR: `npm run lint && npm run typecheck && npm run test:all` must pass (CI enforces it).

## Git
- `main` is always deployable. Work on `feat/<short-name>` branches, open a PR, squash-merge after CI is green.
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`.
