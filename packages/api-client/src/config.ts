export interface BackendConnection {
  readonly origin: string;
  readonly bridgeSecret: string;
  readonly timeoutMs: number;
}

const LOCAL_BRIDGE_SECRET = "local-development-only-api-bridge-secret";

/** Call only from a server adapter; this function never reads process.env itself. */
export function readBackendConnection(
  environment: Readonly<Record<string, string | undefined>>,
): BackendConnection {
  const origin = environment.API_ORIGIN?.trim();
  const secret = environment.API_BRIDGE_SECRET?.trim();
  if (environment.NODE_ENV === "production" && !origin)
    throw new Error("API_ORIGIN wajib diisi pada environment production.");
  if (environment.NODE_ENV === "production" && (!secret || secret === LOCAL_BRIDGE_SECRET))
    throw new Error("API_BRIDGE_SECRET wajib menggunakan rahasia production.");
  const url = new URL(origin || "http://localhost:3001");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("API_ORIGIN harus berupa origin HTTP atau HTTPS tanpa path.");
  const timeoutMs = Number(environment.API_CALL_TIMEOUT_MS ?? "60000");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647)
    throw new Error("API_CALL_TIMEOUT_MS harus berupa bilangan bulat positif yang valid.");
  return { origin: url.origin, bridgeSecret: secret || LOCAL_BRIDGE_SECRET, timeoutMs };
}
