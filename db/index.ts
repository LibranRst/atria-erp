import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/atria_erp_mock";

// Menggunakan connection pool untuk mendukung koneksi persisten, transaksi, dan pessimistic locking
export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });
