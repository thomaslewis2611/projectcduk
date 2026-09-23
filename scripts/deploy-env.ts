/**
 * Deploy helpers that read .env and refuse to continue on missing values.
 *
 *   tsx scripts/deploy-env.ts check     # before building: the VITE_* values are baked into the site
 *   tsx scripts/deploy-env.ts secrets   # copy server-side values into Cloudflare Worker secrets
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const WORKER_NAME = "projectcduk";
const BUILD_VARS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
const SECRET_VARS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"];

const mode = process.argv[2];
if (mode !== "check" && mode !== "secrets") {
  console.error("Usage: tsx scripts/deploy-env.ts check|secrets");
  process.exit(1);
}

if (!existsSync(".env")) {
  console.error(
    "No .env file in this folder. Create it from .env.example and fill in the values first.",
  );
  process.exit(1);
}
process.loadEnvFile(".env");

const needed = mode === "check" ? BUILD_VARS : SECRET_VARS;
const missing = needed.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Missing values in .env: ${missing.join(", ")}`);
  process.exit(1);
}

if (mode === "check") {
  console.log(`.env OK: ${BUILD_VARS.join(", ")} set.`);
  process.exit(0);
}

for (const name of SECRET_VARS) {
  const result = spawnSync("wrangler", ["secret", "put", name, "--name", WORKER_NAME], {
    input: process.env[name]!.trim(),
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.status !== 0) {
    console.error(`Failed to set secret ${name}.`);
    process.exit(1);
  }
}
console.log(`Secrets set on ${WORKER_NAME}: ${SECRET_VARS.join(", ")}.`);
