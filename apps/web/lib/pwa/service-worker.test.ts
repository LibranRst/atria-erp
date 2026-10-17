import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * `public/notification-sw.js` adalah berkas biasa yang dikirim apa adanya, jadi
 * tidak ada pemeriksa tipe atau lint yang bisa menahan perubahan berbahaya di
 * dalamnya. Ini aplikasi keuangan: satu cabang cache-first pada navigasi sudah
 * cukup untuk menyajikan saldo lama seolah-olah saldo terkini. Karena itu
 * berkasnya dijalankan sungguhan di sini — di lingkup service worker tiruan —
 * dan yang diperiksa adalah event mana yang memanggil `respondWith`, bukan teks
 * sumbernya.
 */

const SW_PATH = path.join(import.meta.dir, "..", "..", "public", "notification-sw.js");
const ORIGIN = "https://atria.example";
const NOTIFICATION_ID = "11111111-1111-4111-8111-111111111111";

type NotificationCall = { readonly title: string; readonly options: Record<string, unknown> };

type Scope = {
  readonly respondWith: readonly string[];
  readonly responses: readonly Response[];
  readonly notifications: readonly NotificationCall[];
  readonly opened: readonly string[];
  readonly deletedCaches: readonly string[];
  readonly precached: readonly string[];
  readonly precacheCredentials: readonly RequestCredentials[];
};

/**
 * Lingkup service worker tidak bisa dibangun di runtime biasa, jadi berkasnya
 * dievaluasi dengan global tiruan. Ini satu-satunya batas tak bertipe pada
 * berkas ini, dan sengaja dibiarkan sempit: yang disuntikkan hanya API yang
 * benar-benar dipakai worker.
 */
function createScope(
  fetchImpl: (request: Request) => Promise<Response>,
  windows: readonly { url: string; focus: () => Promise<void> }[] = [],
): {
  dispatch: (type: string, event: Record<string, unknown>) => Promise<Scope>;
} {
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const precached = new Map<string, string>();
  const calls = {
    respondWith: [] as string[],
    /**
     * `respondWith` menerima respons maupun promise-nya, jadi array ini harus
     * menampung keduanya sebelum ditunggu di `dispatch`.
     */
    responses: [] as (Response | Promise<Response>)[],
    notifications: [] as NotificationCall[],
    opened: [] as string[],
    deletedCaches: [] as string[],
    precacheCredentials: [] as RequestCredentials[],
  };

  const cache = {
    async add(request: Request): Promise<void> {
      calls.precacheCredentials.push(request.credentials);
      precached.set(new URL(request.url).pathname, "halaman-offline");
    },
    async match(key: string): Promise<Response | undefined> {
      const hit = precached.get(key);
      return hit === undefined ? undefined : new Response(hit, { status: 200 });
    },
  };

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: (event: Record<string, unknown>) => void) => {
      handlers.set(type, handler);
    },
    skipWaiting: async (): Promise<void> => undefined,
    clients: {
      claim: async (): Promise<void> => undefined,
      matchAll: async (): Promise<readonly { url: string; focus: () => Promise<void> }[]> =>
        windows,
      openWindow: (url: string): Promise<null> => {
        calls.opened.push(url);
        return Promise.resolve(null);
      },
    },
    registration: {
      showNotification: (title: string, options: Record<string, unknown>): Promise<void> => {
        calls.notifications.push({ title, options });
        return Promise.resolve();
      },
    },
  };

  const cachesImpl = {
    open: async (): Promise<typeof cache> => cache,
    keys: async (): Promise<string[]> => [
      "atria-shell-v0",
      "atria-shell-v1",
      "atria-shell-v2",
      "other-cache",
    ],
    delete: async (key: string): Promise<boolean> => {
      calls.deletedCaches.push(key);
      return true;
    },
  };

  /** Service worker asli me-resolve URL relatif terhadap scope-nya. */
  class ScopedRequest extends Request {
    constructor(input: string | Request, init?: RequestInit) {
      super(typeof input === "string" ? new URL(input, ORIGIN).href : input, init);
      // Bun's server Request always reports "include"; the worker runs in a browser.
      // Preserve the actual constructor option at this test-only Web API boundary.
      Object.defineProperty(this, "credentials", { value: init?.credentials ?? "same-origin" });
    }
  }

  const evaluate = new Function(
    "self",
    "caches",
    "fetch",
    "Request",
    "Response",
    "URL",
    readFileSync(SW_PATH, "utf8"),
  );
  evaluate(self, cachesImpl, fetchImpl, ScopedRequest, Response, URL);

  async function dispatch(type: string, event: Record<string, unknown>): Promise<Scope> {
    const handler = handlers.get(type);
    if (!handler) throw new Error(`handler ${type} tidak terdaftar`);
    const request = event.request instanceof Request ? event.request.url : null;
    const waits: unknown[] = [];
    handler({
      ...event,
      waitUntil: (promise: unknown) => waits.push(promise),
      respondWith: (value: Response | Promise<Response>) => {
        if (request) calls.respondWith.push(request);
        calls.responses.push(value);
      },
    });
    await Promise.all(waits);
    /*
     * `respondWith` menerima respons maupun promise-nya; keduanya ditunggu di
     * sini supaya pemeriksaan membaca respons sungguhan, bukan promise.
     */
    const settled = await Promise.all(calls.responses.map((value) => Promise.resolve(value)));
    return {
      respondWith: [...calls.respondWith],
      responses: settled,
      notifications: [...calls.notifications],
      opened: [...calls.opened],
      deletedCaches: [...calls.deletedCaches],
      precached: [...precached.keys()],
      precacheCredentials: [...calls.precacheCredentials],
    };
  }

  return { dispatch };
}

const networkUp = async (): Promise<Response> => new Response("dari-jaringan", { status: 200 });
const networkDown = async (): Promise<Response> => {
  throw new TypeError("Failed to fetch");
};

async function navigate(
  target: string,
  options: { mode?: RequestMode; fetchImpl?: () => Promise<Response> } = {},
): Promise<Scope> {
  const scope = createScope(options.fetchImpl ?? networkUp);
  return scope.dispatch("fetch", {
    request: new Request(target, { mode: options.mode ?? "navigate" }),
  });
}

describe("kebijakan fetch service worker", () => {
  test("offline fallback is installed without a session or authenticated layout", async () => {
    const scope = createScope(networkUp);
    const installed = await scope.dispatch("install", {});
    expect(installed.precached).toEqual(["/offline"]);
    expect(installed.precacheCredentials).toEqual(["omit"]);
  });

  test("POST navigation is never handled, cached or retried by the worker", async () => {
    let calls = 0;
    const scope = createScope(async (): Promise<Response> => {
      calls += 1;
      return new Response("unexpected");
    });
    const result = await scope.dispatch("fetch", {
      request: new Request(`${ORIGIN}/ledger`, { method: "POST", mode: "navigate" }),
    });
    expect(result.respondWith).toEqual([]);
    expect(calls).toBe(0);
  });
  test("navigasi dokumen biasa diteruskan ke jaringan, bukan dijawab dari cache", async () => {
    const scope = await navigate(`${ORIGIN}/ledger`);

    expect(scope.respondWith).toHaveLength(1);
    expect(await scope.responses[0].text()).toBe("dari-jaringan");
  });

  test("permintaan keuangan tidak pernah ditangani: /api/, RSC, lintas origin, non-navigasi", async () => {
    const cases = [
      `${ORIGIN}/api/internal/notifications?task=all`,
      `${ORIGIN}/ledger?_rsc=abc123`,
      "https://evil.example/ledger",
    ];

    for (const target of cases) {
      expect((await navigate(target)).respondWith).toEqual([]);
    }

    expect(
      (await navigate(`${ORIGIN}/_next/static/chunk.js`, { mode: "cors" })).respondWith,
    ).toEqual([]);
    expect((await navigate(`${ORIGIN}/api/notifications`, { mode: "cors" })).respondWith).toEqual(
      [],
    );
  });

  test("jaringan putus menyajikan halaman offline yang diprasimpan, bukan halaman lain", async () => {
    const scope = createScope(networkDown);
    await scope.dispatch("install", {});
    const afterFetch = await scope.dispatch("fetch", {
      request: new Request(`${ORIGIN}/projects`, { mode: "navigate" }),
    });

    expect(afterFetch.precached).toEqual(["/offline"]);
    expect(afterFetch.responses).toHaveLength(1);
    expect(await afterFetch.responses[0].text()).toBe("halaman-offline");
  });

  test("tanpa prasimpan, jawabannya 503 — tidak pernah index.html atau rute lain", async () => {
    const scope = await navigate(`${ORIGIN}/projects`, { fetchImpl: networkDown });

    expect(scope.responses).toHaveLength(1);
    expect(scope.responses[0].status).toBe(503);
  });

  test("activate hanya menghapus cache versi lama milik Atria", async () => {
    const scope = createScope(networkUp);
    const afterActivate = await scope.dispatch("activate", {});

    expect(afterActivate.deletedCaches).toEqual([
      "atria-shell-v0",
      "atria-shell-v1",
      "atria-shell-v2",
    ]);
  });
});

describe("notifikasi service worker", () => {
  test("push membawa identitas visual dan bahasa tanpa mengubah perilaku renotify", async () => {
    const scope = createScope(networkUp);
    const result = await scope.dispatch("push", {
      data: {
        json: () => ({
          title: "Approval baru",
          body: "Menunggu.",
          url: "/expenses/abc",
          notificationId: NOTIFICATION_ID,
        }),
      },
    });

    const [notification] = result.notifications;
    expect(notification.title).toBe("Approval baru");
    expect(notification.options).toMatchObject({
      body: "Menunggu.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      lang: "id",
      dir: "ltr",
      renotify: false,
      tag: `atria-${NOTIFICATION_ID}`,
    });
    expect(notification.options.data).toEqual({
      url: "/expenses/abc",
      notificationId: NOTIFICATION_ID,
    });
  });

  test("tujuan di luar allowlist dan skema berbahaya jatuh ke /notifications", async () => {
    for (const url of ["https://evil.example/x", "javascript:alert(1)", 42]) {
      const scope = createScope(networkUp);
      const result = await scope.dispatch("push", { data: { json: () => ({ url }) } });
      expect(result.notifications[0].options.data).toEqual({ url: "/notifications" });
    }
  });

  test("klik membuka tujuan tersanitasi dan membuang skema asing", async () => {
    const allowed = createScope(networkUp);
    const allowedResult = await allowed.dispatch("notificationclick", {
      notification: { close: () => undefined, data: { url: "/ledger?tab=bank#x" } },
    });
    expect(allowedResult.opened).toEqual(["/ledger?tab=bank#x"]);

    const rejected = createScope(networkUp);
    const rejectedResult = await rejected.dispatch("notificationclick", {
      notification: { close: () => undefined, data: { url: "javascript:alert(1)" } },
    });
    expect(rejectedResult.opened).toEqual(["/notifications"]);
  });

  test("tray click carries the exact notification ID while preserving query and hash", async () => {
    // A blocked network write must never delay opening the destination.
    const scope = createScope(() => new Promise<Response>(() => undefined));
    const result = await scope.dispatch("notificationclick", {
      notification: {
        close: () => undefined,
        data: { url: "/projects/abc?tab=overview#budget", notificationId: NOTIFICATION_ID },
      },
    });
    expect(result.opened).toEqual([
      `/projects/abc?tab=overview&notificationId=${NOTIFICATION_ID}#budget`,
    ]);
  });

  test("already displayed notifications recover their ID from a legacy tag", async () => {
    const result = await createScope(networkUp).dispatch("notificationclick", {
      notification: {
        close: () => undefined,
        tag: `atria-${NOTIFICATION_ID}`,
        data: { url: "/projects/abc" },
      },
    });
    expect(result.opened).toEqual([`/projects/abc?notificationId=${NOTIFICATION_ID}`]);
  });

  test("invalid IDs and destination-supplied read markers cannot acknowledge another item", async () => {
    const result = await createScope(networkUp).dispatch("notificationclick", {
      notification: {
        close: () => undefined,
        tag: "atria-invalid",
        data: {
          url: `/projects/abc?notificationId=${NOTIFICATION_ID}&tab=overview`,
          notificationId: "invalid",
        },
      },
    });
    expect(result.opened).toEqual(["/projects/abc?tab=overview"]);
  });

  test("an existing destination with the same intent is focused instead of opening another", async () => {
    let focused = false;
    const href = `/projects/abc?notificationId=${NOTIFICATION_ID}`;
    const scope = createScope(networkUp, [
      {
        url: `${ORIGIN}${href}`,
        focus: async (): Promise<void> => {
          focused = true;
        },
      },
    ]);
    const result = await scope.dispatch("notificationclick", {
      notification: {
        close: () => undefined,
        data: { url: "/projects/abc", notificationId: NOTIFICATION_ID },
      },
    });
    expect(focused).toBe(true);
    expect(result.opened).toEqual([]);
  });
});
