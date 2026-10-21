import superjson from "superjson";
import { z } from "zod";

import type { BackendConnection } from "./config";

const RPC_PATH = "/api/internal/web-rpc";
const HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

const rpcEnvelopeSchema = z.union([
  z.object({
    ok: z.literal(true),
    data: z.unknown(),
    revalidatePaths: z.array(z.string()),
    invalidations: z
      .array(
        z.object({
          path: z.string(),
          type: z.enum(["page", "layout"]).optional(),
        }),
      )
      .optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({ message: z.string(), code: z.string().optional() }),
    control: z
      .union([
        z.object({
          type: z.literal("redirect"),
          location: z.string(),
          permanent: z.boolean().optional(),
        }),
        z.object({ type: z.literal("notFound") }),
      ])
      .optional(),
  }),
]);

export type RpcEnvelope = z.infer<typeof rpcEnvelopeSchema>;
export type BackendFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class BackendTransportError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 502,
  ) {
    super(message);
    this.name = "BackendTransportError";
  }
}

function withoutHopHeaders(source: Headers): Headers {
  const result = new Headers(source);
  for (const name of (source.get("connection") ?? "").split(",")) {
    if (name.trim()) result.delete(name.trim());
  }
  for (const name of HOP_HEADERS) result.delete(name);
  return result;
}

/** Keep the original credential and origin headers, never a client bridge credential. */
export function backendRequestHeaders(source: Headers, requestURL?: string): Headers {
  const result = withoutHopHeaders(source);
  result.delete("host");
  result.delete("content-length");
  result.delete("accept-encoding");
  result.delete("x-atria-bridge-secret");
  if (requestURL) {
    const url = new URL(requestURL);
    result.set("x-forwarded-host", url.host);
    result.set("x-forwarded-proto", url.protocol.slice(0, -1));
  }
  return result;
}

/** Set-Cookie is an independent header for every cookie, including Expires commas. */
export function backendResponseHeaders(source: Headers): Headers {
  const result = withoutHopHeaders(source);
  result.delete("set-cookie");
  // Fetch decodes compressed bodies; retaining these headers corrupts the proxy response.
  result.delete("content-encoding");
  result.delete("content-length");
  for (const cookie of source.getSetCookie()) result.append("set-cookie", cookie);
  result.set("cache-control", "no-store");
  return result;
}

function transportFailure(error: unknown, signal?: AbortSignal): BackendTransportError {
  if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
    return new BackendTransportError("Permintaan dibatalkan.", "ABORTED", 499);
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return new BackendTransportError(
      "API belum merespons. Periksa status data sebelum mengulangi tindakan.",
      "TIMEOUT",
      504,
    );
  }
  return new BackendTransportError(
    "API belum dapat dihubungi. Periksa status data sebelum mengulangi tindakan.",
    "API_UNAVAILABLE",
  );
}

export async function requestBackendOperation(input: {
  readonly connection: BackendConnection;
  readonly operation: string;
  readonly args: readonly unknown[];
  readonly headers: Headers;
  readonly signal?: AbortSignal;
  readonly fetcher?: BackendFetch;
}): Promise<{ readonly envelope: RpcEnvelope; readonly headers: Headers }> {
  const requestHeaders = backendRequestHeaders(input.headers);
  requestHeaders.set("content-type", "application/json");
  requestHeaders.set("x-atria-bridge-secret", input.connection.bridgeSecret);
  const timeout = AbortSignal.timeout(input.connection.timeoutMs);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
  let response: Response;
  let body: string;
  try {
    response = await (input.fetcher ?? fetch)(new URL(RPC_PATH, input.connection.origin), {
      method: "POST",
      headers: requestHeaders,
      body: superjson.stringify({ operation: input.operation, args: input.args }),
      cache: "no-store",
      redirect: "manual",
      signal,
    });
    body = await response.text();
  } catch (error) {
    throw transportFailure(error, input.signal);
  }
  let decoded: unknown;
  try {
    decoded = superjson.parse<unknown>(body);
  } catch {
    throw new BackendTransportError("Respons API tidak valid.", "BAD_RESPONSE", response.status);
  }
  const parsed = rpcEnvelopeSchema.safeParse(decoded);
  if (!parsed.success || (!response.ok && parsed.data.ok)) {
    throw new BackendTransportError("Respons API tidak valid.", "BAD_RESPONSE", response.status);
  }
  return { envelope: parsed.data, headers: response.headers };
}

/** Forward only a route selected by the web handler; there is no public bridge catch-all. */
export async function forwardBackendRequest(input: {
  readonly request: Request;
  readonly connection: BackendConnection;
  readonly fetcher?: BackendFetch;
}): Promise<Response> {
  const originalURL = new URL(input.request.url);
  const url = new URL(`${originalURL.pathname}${originalURL.search}`, input.connection.origin);
  const headers = backendRequestHeaders(input.request.headers, input.request.url);
  // Bound connection/header acquisition without imposing a lifetime on AI/SSE streams.
  const connectionAbort = new AbortController();
  const connectionTimer = setTimeout((): void => {
    connectionAbort.abort(new DOMException("API connection timed out", "TimeoutError"));
  }, input.connection.timeoutMs);
  const init: RequestInit & { duplex: "half" } = {
    method: input.request.method,
    headers,
    body: ["GET", "HEAD"].includes(input.request.method) ? undefined : input.request.body,
    duplex: "half",
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.any([input.request.signal, connectionAbort.signal]),
  };
  try {
    const response = await (input.fetcher ?? fetch)(url, init);
    clearTimeout(connectionTimer);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: backendResponseHeaders(response.headers),
    });
  } catch (error) {
    const failure = transportFailure(error, input.request.signal);
    return Response.json(
      { error: { code: failure.code, message: failure.message } },
      { status: failure.status, headers: { "cache-control": "no-store" } },
    );
  } finally {
    clearTimeout(connectionTimer);
  }
}
