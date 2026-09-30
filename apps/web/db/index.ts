import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import { withCommitEffects } from "@/lib/db/commit-effects";

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/atria_erp_mock";

// Menggunakan connection pool untuk mendukung koneksi persisten, transaksi, dan pessimistic locking
export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });
const nativeTransaction = db.transaction.bind(db);
db.transaction = withCommitEffects(nativeTransaction, (error: unknown): void => {
  console.error("Notification after-commit scheduling failed", error);
});
