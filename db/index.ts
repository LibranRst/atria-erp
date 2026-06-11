import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Caching connection fetch untuk optimasi serverless cold starts
neonConfig.fetchConnectionCache = true;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment variables. Please check your .env file.");
}

const client = neon(connectionString);
export const db = drizzle({ client, schema });
