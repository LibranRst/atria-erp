import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      roleId: {
        type: "string",
        required: true,
        input: false, // Tidak bisa diset manual saat registrasi biasa
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  // Ditambahkan secret kunci rahasia token, gunakan variabel env
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-key-please-replace-in-env",
});
