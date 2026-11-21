import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "../db";

export function listAddresses(userId: string) {
  return getDb()
    .select()
    .from(schema.addresses)
    .where(eq(schema.addresses.userId, userId))
    .orderBy(desc(schema.addresses.isDefault), desc(schema.addresses.createdAt))
    .all();
}

export type SavedAddress = ReturnType<typeof listAddresses>[number];

export function getUserProfile(userId: string) {
  return getDb()
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, phone: schema.users.phone, createdAt: schema.users.createdAt })
    .from(schema.users)
    .where(and(eq(schema.users.id, userId), eq(schema.users.role, "customer")))
    .get();
}
