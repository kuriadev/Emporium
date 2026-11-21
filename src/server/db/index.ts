import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "./schema";
import { seedDatabase } from "./seed";

export type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __emporiumDb?: DB };

function createDb(): DB {
  const file = process.env.DATABASE_PATH ?? join(process.cwd(), "data", "emporium.db");
  mkdirSync(dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  seedDatabase(db);
  return db;
}

export function getDb(): DB {
  globalForDb.__emporiumDb ??= createDb();
  return globalForDb.__emporiumDb;
}

export { schema };
