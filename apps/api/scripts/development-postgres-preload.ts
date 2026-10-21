/**
 * TCP transport for explicitly selected local development and seed commands.
 * The application's default Neon transport remains unchanged. Mirrors the
 * existing disposable-test adapter and rejects production and remote targets.
 */
import { mock } from "bun:test";
import { Pool, Client, types } from "pg";
import { neonConfig } from "@neondatabase/serverless";
import { developmentDatabaseTarget, isLoopbackDevelopmentTarget } from "./development-seed-guard";

const target = developmentDatabaseTarget(process.env.DATABASE_URL, process.env.NODE_ENV);
if (!isLoopbackDevelopmentTarget(target)) {
  throw new Error("Preload PostgreSQL lokal hanya menerima database loopback.");
}
process.env.DATABASE_URL = target.href;

const localTransport = { Pool, Client, types, neonConfig };
mock.module("@neondatabase/serverless", (): typeof localTransport => localTransport);
