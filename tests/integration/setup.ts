import { afterAll, beforeEach } from "vitest";
import { getDb } from "@/db/data-source";

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error(`Refusing to run integration tests against ${process.env.DATABASE_URL} (expected a *_test database)`);
}

// Fresh emergency tables for every test; unrelated database tables are left alone.
beforeEach(async () => {
  const db = await getDb();
  await db.synchronize();
  const tables = db.entityMetadatas.map((m) => `"${m.tableName}"`).join(", ");
  if (tables) await db.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  const db = await getDb();
  await db.destroy();
});
