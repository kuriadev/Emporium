import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "../src/server/db/schema";
import { DEMO_ACCOUNTS, seedDatabase } from "../src/server/db/seed";

const file = process.env.DATABASE_PATH ?? join(process.cwd(), "data", "emporium.db");

if (process.argv.includes("--reset")) {
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(file + suffix)) rmSync(file + suffix);
  console.log("Removed existing database");
}

mkdirSync(dirname(file), { recursive: true });
const sqlite = new Database(file);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
seedDatabase(db);
sqlite.close();

console.log(`Database ready at ${file}`);
console.table(Object.entries(DEMO_ACCOUNTS).map(([role, a]) => ({ role, email: a.email, password: a.password })));
