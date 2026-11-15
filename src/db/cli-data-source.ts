// Used only by the TypeORM CLI and scripts (npm run db:generate / db:migrate / db:seed).
// The Next.js app imports ./data-source instead — migrations are never bundled into the app.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd()); // same .env loading rules as Next.js

import path from "node:path";
import { DataSource } from "typeorm";
import { dataSource } from "./data-source";

const cliDataSource = new DataSource({
  ...dataSource.options,
  url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  synchronize: false,
  migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
} as typeof dataSource.options);

export default cliDataSource;
