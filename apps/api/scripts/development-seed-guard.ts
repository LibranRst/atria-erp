export type DevelopmentSeedOptions = {
  readonly reset: boolean;
  readonly verifyOnly: boolean;
};

/** Validate flags before importing a database client or running the reset operator. */
export function developmentSeedOptions(args: readonly string[]): DevelopmentSeedOptions {
  const allowed = new Set(["--reset", "--confirm-reset", "--verify"]);
  for (const arg of args) {
    if (!allowed.has(arg)) throw new Error(`Opsi seed development tidak dikenal: ${arg}`);
  }
  const reset = args.includes("--reset");
  const verifyOnly = args.includes("--verify");
  if (reset && !args.includes("--confirm-reset")) {
    throw new Error("Reset development memerlukan --reset --confirm-reset.");
  }
  if (!reset && args.includes("--confirm-reset")) {
    throw new Error("--confirm-reset hanya berlaku bersama --reset.");
  }
  if (reset && verifyOnly) {
    throw new Error("--verify hanya membaca data dan tidak dapat digabungkan dengan --reset.");
  }
  return { reset, verifyOnly };
}

export function isLoopbackDevelopmentTarget(target: URL): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname.toLowerCase());
}

function isNeonDevelopmentTarget(target: URL): boolean {
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+neon\.tech$/i.test(target.hostname);
}

/** Keep the configured Neon target; reject URI parameters that can override it. */
export function developmentDatabaseTarget(
  databaseUrl: string | undefined,
  nodeEnvironment: string | undefined,
): URL {
  if (nodeEnvironment === "production") {
    throw new Error("Seed development ditolak ketika NODE_ENV=production.");
  }
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL wajib tersedia dari konfigurasi API; seed tidak memakai fallback.",
    );
  }
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL development tidak valid.");
  }
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    (!isLoopbackDevelopmentTarget(target) && !isNeonDevelopmentTarget(target)) ||
    !/^\/[a-zA-Z0-9_-]+$/.test(target.pathname) ||
    ["/postgres", "/template0", "/template1"].includes(target.pathname.toLowerCase()) ||
    target.hash !== ""
  ) {
    throw new Error(
      "Seed development hanya menerima database aplikasi Neon (*.neon.tech) atau PostgreSQL loopback.",
    );
  }
  const parameters = [...target.searchParams.entries()];
  const names = parameters.map(([name]): string => name);
  if (new Set(names).size !== names.length) {
    throw new Error("Parameter DATABASE_URL tidak boleh duplikat.");
  }
  if (isLoopbackDevelopmentTarget(target)) {
    if (parameters.some(([key, value]): boolean => key !== "sslmode" || value !== "disable")) {
      throw new Error("Parameter DATABASE_URL lokal hanya boleh berupa sslmode=disable.");
    }
  } else if (
    !target.username ||
    !target.password ||
    parameters.some(
      ([key, value]): boolean =>
        !(key === "sslmode" && ["require", "verify-full"].includes(value)) &&
        !(key === "channel_binding" && value === "require"),
    )
  ) {
    throw new Error(
      "DATABASE_URL Neon memerlukan credentials; parameter hanya sslmode=require/verify-full dan channel_binding=require.",
    );
  }
  return target;
}
