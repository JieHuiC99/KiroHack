// Cross-platform "run a command with an env file":  node scripts/with-env.mjs .env.test <cmd...>
// Variables from the file win over .env, because tools like dotenv never override existing vars.
import { spawnSync } from "node:child_process";

const [file, ...cmd] = process.argv.slice(2);
if (!file || cmd.length === 0) {
  console.error("usage: node scripts/with-env.mjs <env-file> <command...>");
  process.exit(1);
}
process.loadEnvFile(file);
const result = spawnSync(cmd.join(" "), { stdio: "inherit", shell: true, env: process.env });
process.exit(result.status ?? 1);
