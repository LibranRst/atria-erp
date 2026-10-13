import { describe, expect, test } from "bun:test";
import superjson from "superjson";

import type { BackendConnection } from "./config";
import {
  backendRequestHeaders,
  backendResponseHeaders,
  BackendTransportError,
  forwardBackendRequest,
  requestBackendOperation,
} from "./http";

const connection: BackendConnection = {
  origin: "http://localhost:3001",
  bridgeSecret: "private-test-bridge-secret",
  timeoutMs: 1000,
};

describe("shared API HTTP boundary", () => {
  test("keeps auth/origin/Expo headers and strips hop headers and untrusted bridge secrets", () => {
    const headers = backendRequestHeaders(
      new Headers({
        cookie: "better-auth.session_token=web-token",
        authorization: "Bearer native-token",
        origin: "http://localhost:3000",
        "expo-origin": "atria://",
        connection: "keep-alive, x-hop",
        "x-hop": "discard",
        host: "localhost:3000",
        "x-atria-bridge-secret": "user-supplied-secret",
      }),
      "http://localhost:3000/api/auth/sign-in/email",
    );
    expect(headers.get("cookie")).toBe("better-auth.session_token=web-token");
    expect(headers.get("authorization")).toBe("Bearer native-token");
    expect(headers.get("origin")).toBe("http://localhost:3000");
    expect(headers.get("expo-origin")).toBe("atria://");
    expect(headers.get("x-forwarded-host")).toBe("localhost:3000");
    for (const name of ["connection", "x-hop", "host", "x-atria-bridge-secret"]) {
      expect(headers.has(name)).toBe(false);
    }
  });

  test("keeps every Set-Cookie and the native set-auth-token header", () => {
    const headers = new Headers({ "set-auth-token": "native-token", "content-encoding": "gzip" });
    headers.append("set-cookie", "session=one; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly");
    headers.append("set-cookie", "session_data=two; Path=/; Secure");
    const forwarded = backendResponseHeaders(headers);
    expect(forwarded.getSetCookie()).toEqual(headers.getSetCookie());
    expect(forwarded.get("set-auth-token")).toBe("native-token");
    expect(forwarded.get("cache-control")).toBe("no-store");
    expect(forwarded.has("content-encoding")).toBe(false);
  });

  test("serializes typed RPC arguments and data without retrying or caching", async () => {
    const date = new Date("2026-10-01T10:00:00.000Z");
    let requests = 0;
    const response = await requestBackendOperation({
      connection,
      operation: "getProject",
      args: ["project-id", date],
      headers: new Headers({ cookie: "session=token", authorization: "Bearer token" }),
      fetcher: async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        requests += 1;
        expect(String(url)).toBe("http://localhost:3001/api/internal/web-rpc");
        const headers = new Headers(init?.headers);
        expect(headers.get("x-atria-bridge-secret")).toBe(connection.bridgeSecret);
        expect(headers.get("authorization")).toBe("Bearer token");
        expect(init?.cache).toBe("no-store");
        expect(init?.redirect).toBe("manual");
        expect(superjson.parse<unknown>(String(init?.body))).toEqual({
          operation: "getProject",
          args: ["project-id", date],
        });
        return new Response(
          superjson.stringify({ ok: true, data: { date, amount: 100n }, revalidatePaths: [] }),
        );
      },
    });
    expect(response.envelope).toEqual({
      ok: true,
      data: { date, amount: 100n },
      revalidatePaths: [],
    });
    expect(requests).toBe(1);
  });

  test("rejects broken envelopes and preserves explicit backend errors", async () => {
    const input = { connection, operation: "read", args: [], headers: new Headers() };
    await expect(
      requestBackendOperation({
        ...input,
        fetcher: async (): Promise<Response> => new Response("not JSON", { status: 502 }),
      }),
    ).rejects.toMatchObject({ code: "BAD_RESPONSE" });
    const result = await requestBackendOperation({
      ...input,
      fetcher: async (): Promise<Response> =>
        new Response(
          superjson.stringify({
            ok: false,
            error: { code: "FORBIDDEN", message: "Akses ditolak." },
          }),
          { status: 403 },
        ),
    });
    expect(result.envelope).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "Akses ditolak." },
    });
  });

  test("RPC caller abort reaches the fetch and never retries a mutation", async () => {
    const controller = new AbortController();
    let requests = 0;
    const pending = requestBackendOperation({
      connection,
      operation: "recordPayment",
      args: [],
      headers: new Headers(),
      signal: controller.signal,
      fetcher: (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        requests += 1;
        return new Promise(
          (_resolve: (response: Response) => void, reject: (reason: unknown) => void): void => {
            init?.signal?.addEventListener(
              "abort",
              (): void => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          },
        );
      },
    });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(BackendTransportError);
    await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
    expect(requests).toBe(1);
  });

  test("forwards exact request bodies, query strings, credentials and streaming responses", async () => {
    const request = new Request("http://localhost:3000/api/ai/chat?mode=stream", {
      method: "POST",
      body: '{"message":"halo"}',
      headers: { "content-type": "application/json", cookie: "session=token" },
    });
    const stream = new ReadableStream<Uint8Array>({
      start(controller: ReadableStreamDefaultController<Uint8Array>): void {
        controller.enqueue(new TextEncoder().encode("data: ready\n\n"));
        controller.close();
      },
    });
    const result = await forwardBackendRequest({
      request,
      connection,
      fetcher: async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        expect(String(url)).toBe("http://localhost:3001/api/ai/chat?mode=stream");
        expect(new Headers(init?.headers).get("cookie")).toBe("session=token");
        expect(init?.signal?.aborted).toBe(false);
        expect(await new Response(init?.body).text()).toBe('{"message":"halo"}');
        return new Response(stream, {
          headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
        });
      },
    });
    expect(result.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    expect(await result.text()).toBe("data: ready\n\n");
  });

  test("downstream stream cancellation propagates to the upstream stream", async () => {
    let cancelled = false;
    const result = await forwardBackendRequest({
      request: new Request("http://localhost:3000/api/notifications/stream"),
      connection,
      fetcher: async (): Promise<Response> =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel(): void {
              cancelled = true;
            },
          }),
        ),
    });
    await result.body?.cancel();
    expect(cancelled).toBe(true);
  });

  test("forwarding cancels connection acquisition when the downstream request aborts", async () => {
    const controller = new AbortController();
    const result = forwardBackendRequest({
      request: new Request("http://localhost:3000/api/notifications/stream", {
        signal: controller.signal,
      }),
      connection,
      fetcher: (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise(
          (_resolve: (response: Response) => void, reject: (reason: unknown) => void): void => {
            init?.signal?.addEventListener("abort", (): void => reject(init.signal?.reason), {
              once: true,
            });
          },
        ),
    });
    controller.abort();
    expect((await result).status).toBe(499);
  });

  test("a connection deadline does not expire a healthy long-lived SSE stream", async () => {
    let upstreamSignal: AbortSignal | null | undefined;
    const result = await forwardBackendRequest({
      request: new Request("http://localhost:3000/api/notifications/stream"),
      connection: { ...connection, timeoutMs: 5 },
      fetcher: async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        upstreamSignal = init?.signal;
        return new Response(new ReadableStream<Uint8Array>());
      },
    });
    await Bun.sleep(15);
    expect(upstreamSignal?.aborted).toBe(false);
    await result.body?.cancel();
  });

  test("unavailable API returns a bounded gateway error instead of a local DB fallback", async () => {
    let requests = 0;
    const result = await forwardBackendRequest({
      request: new Request("http://localhost:3000/api/trpc/project.list"),
      connection,
      fetcher: async (): Promise<Response> => {
        requests += 1;
        throw new Error("private infrastructure detail");
      },
    });
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({
      error: {
        code: "API_UNAVAILABLE",
        message: "API belum dapat dihubungi. Periksa status data sebelum mengulangi tindakan.",
      },
    });
    expect(requests).toBe(1);
  });
});
