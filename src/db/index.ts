import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL n'est pas défini");
  const client = postgres(url, {
    // Pooler Supabase/Neon en mode transaction : pas de requêtes préparées.
    prepare: false,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
  });
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;

// Réutilise la connexion entre rechargements à chaud en développement.
const globalForDb = globalThis as unknown as { __db?: Db };

export const db: Db = globalForDb.__db ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Transaction;
