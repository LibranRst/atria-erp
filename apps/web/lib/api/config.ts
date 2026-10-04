import "server-only";

const LOCAL_BRIDGE_SECRET = "local-development-only-api-bridge-secret";

export interface BackendConnection {
  readonly origin: string;
  readonly bridgeSecret: string;
  readonly timeoutMs: number;
}

/** Secrets are read only on the server; browser clients use same-origin routes. */
export function getBackendConnection(): BackendConnection {
  const configuredOrigin = process.env.API_ORIGIN?.trim();
  const configuredSecret = process.env.API_BRIDGE_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !configuredOrigin) {
    throw new Error("API_ORIGIN wajib diisi pada environment production.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    (!configuredSecret || configuredSecret === LOCAL_BRIDGE_SECRET)
  ) {
    throw new Error("API_BRIDGE_SECRET wajib menggunakan rahasia production.");
  }
  const url = new URL(configuredOrigin || "http://localhost:3001");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("API_ORIGIN harus berupa origin HTTP atau HTTPS tanpa path.");
  }
  const configuredTimeout = Number(process.env.API_CALL_TIMEOUT_MS ?? "60000");
  if (
    !Number.isInteger(configuredTimeout) ||
    configuredTimeout < 1 ||
    configuredTimeout > 2_147_483_647
  ) {
    throw new Error("API_CALL_TIMEOUT_MS harus berupa bilangan bulat positif yang valid.");
  }
  return {
    origin: url.origin,
    bridgeSecret: configuredSecret || LOCAL_BRIDGE_SECRET,
    timeoutMs: configuredTimeout,
  };
}
