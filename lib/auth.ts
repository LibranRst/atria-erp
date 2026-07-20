import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);

function isPrivateNetworkHostname(hostname: string): boolean {
  if (localHostnames.has(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  const match = hostname.match(/^172\.(\d{1,2})\.\d{1,3}\.\d{1,3}$/);
  if (!match) return false;

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function getConfiguredOrigins(): string[] {
  return [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_AUTH_URL,
  ].flatMap((url) => {
    if (!url) return [];

    try {
      return [new URL(url).origin];
    } catch {
      return [];
    }
  });
}

function getTrustedOrigins(request?: Request): string[] {
  const origins = new Set(getConfiguredOrigins());
  const requestOrigin = request?.headers.get("origin");

  if (process.env.NODE_ENV === "development" && requestOrigin) {
    try {
      const originURL = new URL(requestOrigin);
      if (isPrivateNetworkHostname(originURL.hostname)) {
        origins.add(originURL.origin);
      }
    } catch {
      // Ignore malformed Origin headers; Better Auth will reject them.
    }
  }

  return [...origins];
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  trustedOrigins: getTrustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  session: {
    additionalFields: {
      developerActorUserId: {
        type: "string",
        required: false,
        input: false,
      },
    },
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
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
    },
  },
  // Ditambahkan secret kunci rahasia token, gunakan variabel env
  secret: (() => {
    const configuredSecret = process.env.BETTER_AUTH_SECRET;
    if (configuredSecret) return configuredSecret;
    if (process.env.NODE_ENV === "production") {
      throw new Error("BETTER_AUTH_SECRET wajib dikonfigurasi pada environment production.");
    }
    return "local-development-only-secret-replace-before-production";
  })(),
});
