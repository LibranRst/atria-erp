import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Caching connection fetch untuk optimasi serverless cold starts
neonConfig.fetchConnectionCache = true;

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/atria_erp_mock";
const client = neon(connectionString);
export const db = drizzle({ client, schema });
