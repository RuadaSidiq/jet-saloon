import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

export default async function setup() {
  const name = process.env.JS_TEST_DB!;
  const url = process.env.JS_TEST_URL!;
  if (!/^jetsaloon_test_\d+$/.test(name)) throw new Error("Refusing to use a non-test database name");
  const admin = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_ADMIN_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres" });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  await admin.$disconnect();
  const env = { ...process.env, DATABASE_URL: url, SEED_DEMO: "false", SEED_ADMIN_EMAIL: "", NODE_ENV: "test" as const };
  execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
}
