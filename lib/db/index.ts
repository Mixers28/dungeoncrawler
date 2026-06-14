import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = global as typeof globalThis & { db?: ReturnType<typeof drizzle> };

if (!globalForDb.db) {
  const client = postgres(process.env.DATABASE_URL!);
  globalForDb.db = drizzle(client, { schema });
}

export const db = globalForDb.db!;
