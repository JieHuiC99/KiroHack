import "reflect-metadata";
import { DataSource } from "typeorm";
import { entities } from "./entities";

/**
 * The one TypeORM DataSource the app uses. Import `getDb()` from server code only
 * (route handlers, server actions, src/server/*). Never from a "use client" file.
 */
export const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities,
  // gen_random_uuid() is built into Postgres 13+; avoids needing the uuid-ossp extension (Supabase keeps it in another schema).
  uuidExtension: "pgcrypto",
  // Local dev convenience: auto-create/alter tables from entities. Production uses migrations.
  synchronize: process.env.DB_SYNC === "true",
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  // Serverless (Vercel) opens many instances; keep each pool tiny.
  extra: { max: Number(process.env.DB_POOL_MAX ?? 3) },
  logging: process.env.DB_LOG === "true",
});

type Cache = { source: DataSource; ready: Promise<DataSource> };
const g = globalThis as unknown as { __db?: Cache };

/**
 * Lazily initialised, hot-reload-safe connection.
 * In `next dev`, editing an entity re-evaluates this module with fresh classes; a DataSource
 * cached from before would throw `No metadata for "X" was found`, so we swap it out.
 */
export async function getDb(): Promise<DataSource> {
  if (g.__db && g.__db.source !== dataSource) {
    const stale = g.__db;
    g.__db = undefined;
    stale.ready.then((ds) => ds.destroy()).catch(() => {});
  }
  if (!g.__db) g.__db = { source: dataSource, ready: dataSource.initialize() };
  return g.__db.ready;
}
