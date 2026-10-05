import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default("0.0.0.0"),
  API_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  API_BRIDGE_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const DEVELOPMENT_BRIDGE_SECRET = "local-development-only-api-bridge-secret";
export type ApiConfig = z.infer<typeof configSchema>;

export function readApiConfig(
  environment: Readonly<Record<string, string | undefined>>,
): ApiConfig {
  const production = environment.NODE_ENV === "production";
  const value = configSchema.parse({
    ...environment,
    API_BRIDGE_SECRET:
      environment.API_BRIDGE_SECRET ?? (production ? undefined : DEVELOPMENT_BRIDGE_SECRET),
  });
  if (production && value.API_BRIDGE_SECRET === DEVELOPMENT_BRIDGE_SECRET) {
    throw new Error("API_BRIDGE_SECRET production harus memakai secret instance tersendiri.");
  }
  if (production && !environment.DATABASE_URL) throw new Error("DATABASE_URL wajib di production.");
  if (production && !environment.BETTER_AUTH_SECRET)
    throw new Error("BETTER_AUTH_SECRET wajib di production.");
  if (
    production &&
    (!environment.API_PUBLIC_URL ||
      !environment.WEB_ORIGIN ||
      new URL(value.API_PUBLIC_URL).protocol !== "https:" ||
      new URL(value.WEB_ORIGIN).protocol !== "https:")
  ) {
    throw new Error("API_PUBLIC_URL dan WEB_ORIGIN HTTPS wajib eksplisit di production.");
  }
  return value;
}
