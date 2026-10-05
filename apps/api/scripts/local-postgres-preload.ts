/**
 * Transport TCP khusus pengujian PostgreSQL lokal. Tidak dipakai aplikasi.
 * Connection pool dan transaksi tetap nyata; hanya transport WebSocket Neon
 * diganti pg agar suite yang sama dapat berjalan pada container disposable.
 */
import { mock } from "bun:test";
import { Pool, Client, types } from "pg";
import { neonConfig } from "@neondatabase/serverless";

const configured = process.env.ATRIA_LOCAL_TEST_DATABASE_URL;
if (!configured) throw new Error("ATRIA_LOCAL_TEST_DATABASE_URL wajib eksplisit.");
const target = new URL(configured);
if (
  target.protocol !== "postgresql:" ||
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  !/^\/atria_audit_[a-z0-9_]+$/.test(target.pathname) ||
  process.env.NODE_ENV === "production"
) {
  throw new Error("Preload hanya menerima database atria_audit_* pada loopback non-production.");
}

process.env.DATABASE_URL = configured;
if (process.env.ATRIA_LOCAL_TEST_MODE === "empty") {
  delete process.env.ATRIA_TEST_DATABASE_URL;
  process.env.ATRIA_TEST_EMPTY_DATABASE_URL = configured;
} else {
  process.env.ATRIA_TEST_DATABASE_URL = configured;
  delete process.env.ATRIA_TEST_EMPTY_DATABASE_URL;
}

const localTransport = { Pool, Client, types, neonConfig };
mock.module("@neondatabase/serverless", () => localTransport);
