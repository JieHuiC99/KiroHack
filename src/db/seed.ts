// Resets the demo: wipes emergencies, help requests and check-ins so the next run starts clean.
// Run: npm run db:seed   (also creates the tables on a fresh local database)
import cli from "./cli-data-source";

async function main() {
  const db = await cli.initialize();
  try {
    // Local dev (DB_SYNC=true): make sure tables exist. Deployed DBs get tables from migrations.
    if (process.env.DB_SYNC === "true") await db.synchronize();
    // TRUNCATE every TypeORM table at once (CASCADE). Better Auth's tables are left alone.
    const tables = db.entityMetadatas.map((m) => `"${m.tableName}"`).join(", ");
    await db.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    console.log("Demo state reset: no active emergency");
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
