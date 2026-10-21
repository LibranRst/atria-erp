import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

import type { ActionResponse } from "@atria/core/types/action-response";
import {
  startPushNotificationRead,
  type PushNotificationReadOptions,
  type PushNotificationReadRuntime,
} from "./hooks/push-notification-read";

const FIRST_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const ACCEPTED: ActionResponse<{ success: boolean }> = { success: true, data: { success: true } };
const REJECTED: ActionResponse<{ success: boolean }> = {
  success: false,
  error: { code: "INTERNAL_SERVER_ERROR", message: "Belum tersimpan." },
};
type ReadResponse = ActionResponse<{ success: boolean }>;
type DeviceState = {
  url: URL;
  stored: string | null;
  online: boolean;
  storageDenied: boolean;
  historyDenied: boolean;
  marks: string[];
  refreshes: number;
};
type Device = {
  readonly state: DeviceState;
  readonly runtime: PushNotificationReadRuntime;
  readonly emit: () => void;
  readonly options: (
    userId: string | null,
    response?: () => Promise<ReadResponse>,
  ) => PushNotificationReadOptions;
};

function device(): Device {
  const state: DeviceState = {
    url: new URL(
      `https://atria.example/projects/test?tab=overview&notificationId=${FIRST_ID}#detail`,
    ),
    stored: null,
    online: true,
    storageDenied: false,
    historyDenied: false,
    marks: [],
    refreshes: 0,
  };
  const listeners = new Set<() => void>();
  return {
    state,
    runtime: {
      marker: (): string | null => state.url.searchParams.get("notificationId"),
      clearMarker: (id: string): void => {
        if (state.historyDenied) throw new Error("History unavailable");
        if (state.url.searchParams.get("notificationId") === id)
          state.url.searchParams.delete("notificationId");
      },
      readPending: (): string | null => {
        if (state.storageDenied) throw new Error("Storage unavailable");
        return state.stored;
      },
      writePending: (value: string): void => {
        if (state.storageDenied) throw new Error("Storage unavailable");
        state.stored = value;
      },
      removePending: (): void => {
        if (state.storageDenied) throw new Error("Storage unavailable");
        state.stored = null;
      },
      available: (): boolean => state.online,
      subscribe: (resume: () => void): (() => void) => {
        listeners.add(resume);
        return (): void => {
          listeners.delete(resume);
        };
      },
    },
    emit: (): void => listeners.forEach((listener) => listener()),
    options: (
      userId: string | null,
      response: () => Promise<ReadResponse> = async (): Promise<ReadResponse> => ACCEPTED,
    ): PushNotificationReadOptions => ({
      userId,
      markRead: async ({ id }: { readonly id: string }): Promise<ReadResponse> => {
        state.marks.push(id);
        return response();
      },
      onRead: async (): Promise<void> => {
        state.refreshes += 1;
      },
    }),
  };
}

async function settled(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function deferredResponse(): {
  readonly promise: Promise<ReadResponse>;
  readonly resolve: (value: ReadResponse) => void;
} {
  let complete: ((value: ReadResponse) => void) | undefined;
  const promise = new Promise<ReadResponse>((resolve) => {
    complete = resolve;
  });
  return {
    promise,
    resolve: (value: ReadResponse): void => {
      if (!complete) throw new Error("Deferred response unavailable");
      complete(value);
    },
  };
}

async function withBrowser(url: string, work: (frame: Window) => Promise<void>): Promise<void> {
  const frame = new Window({ url });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const globals: Readonly<Record<string, unknown>> = {
    window: frame,
    document: frame.document,
    navigator: frame.navigator,
  };
  for (const [name, value] of Object.entries(globals)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  try {
    await work(frame);
    await settled();
  } finally {
    frame.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

describe("notification tray read acknowledgment", () => {
  test("acknowledges one exact ID and retains the other navigation state", async () => {
    const d = device();
    const stop = startPushNotificationRead(d.options("owner"), d.runtime);
    expect(d.state.stored).toBe(JSON.stringify({ id: FIRST_ID, userId: "owner" }));
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID]);
    expect(d.state.stored).toBeNull();
    expect(d.state.url.pathname + d.state.url.search + d.state.url.hash).toBe(
      "/projects/test?tab=overview#detail",
    );
    expect(d.state.refreshes).toBe(1);
    d.emit();
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID]);
    stop();
  });

  test("failed ActionResponse retains the intent until a resume event succeeds", async () => {
    const d = device();
    let response: ReadResponse = REJECTED;
    const stop = startPushNotificationRead(
      d.options("owner", async (): Promise<ReadResponse> => response),
      d.runtime,
    );
    await settled();
    expect(d.state.refreshes).toBe(0);
    expect(d.state.url.searchParams.get("notificationId")).toBe(FIRST_ID);
    expect(d.state.stored).not.toBeNull();
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID]);
    response = ACCEPTED;
    d.emit();
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID, FIRST_ID]);
    expect(d.state.stored).toBeNull();
    expect(d.state.refreshes).toBe(1);
    stop();
  });

  test("a thrown request and an unsuccessful data result are not acknowledgments", async () => {
    const d = device();
    let throwRequest = true;
    const stop = startPushNotificationRead(
      d.options("owner", async (): Promise<ReadResponse> => {
        if (throwRequest) throw new Error("Offline");
        return { success: true, data: { success: false } };
      }),
      d.runtime,
    );
    await settled();
    throwRequest = false;
    d.emit();
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID, FIRST_ID]);
    expect(d.state.stored).not.toBeNull();
    expect(d.state.url.searchParams.get("notificationId")).toBe(FIRST_ID);
    expect(d.state.refreshes).toBe(0);
    stop();
  });

  test("offline capture survives a route change and retries when online", async () => {
    const d = device();
    d.state.online = false;
    const stop = startPushNotificationRead(d.options("owner"), d.runtime);
    expect(d.state.marks).toEqual([]);
    expect(d.state.stored).toBe(JSON.stringify({ id: FIRST_ID, userId: "owner" }));
    d.state.url = new URL("https://atria.example/offline");
    d.state.online = true;
    d.emit();
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID]);
    expect(d.state.stored).toBeNull();
    stop();
  });

  test("anonymous capture survives login/password navigation before binding to the user", async () => {
    const d = device();
    const stopAnonymous = startPushNotificationRead(d.options(null), d.runtime);
    expect(d.state.marks).toEqual([]);
    expect(d.state.stored).toBe(JSON.stringify({ id: FIRST_ID, userId: null }));
    stopAnonymous();
    d.state.url = new URL("https://atria.example/profile/password");
    const stop = startPushNotificationRead(d.options("pm"), d.runtime);
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID]);
    expect(d.state.stored).toBeNull();
    stop();
  });

  test("a bound pending intent is discarded under another user without replay", async () => {
    const d = device();
    d.state.online = false;
    const stopOwner = startPushNotificationRead(d.options("owner"), d.runtime);
    stopOwner();
    d.state.online = true;
    const stopPm = startPushNotificationRead(d.options("pm"), d.runtime);
    await settled();
    expect(d.state.marks).toEqual([]);
    expect(d.state.stored).toBeNull();
    expect(d.state.url.searchParams.has("notificationId")).toBe(false);
    stopPm();
  });

  test("anonymous intent binds immediately after authentication, including while offline", async () => {
    const d = device();
    d.state.online = false;
    const stopAnonymous = startPushNotificationRead(d.options(null), d.runtime);
    stopAnonymous();
    d.state.url = new URL("https://atria.example/profile/password");
    const stopOwner = startPushNotificationRead(d.options("owner"), d.runtime);
    expect(d.state.stored).toBe(JSON.stringify({ id: FIRST_ID, userId: "owner" }));
    stopOwner();
    d.state.online = true;
    const stopPm = startPushNotificationRead(d.options("pm"), d.runtime);
    await settled();
    expect(d.state.marks).toEqual([]);
    expect(d.state.stored).toBeNull();
    stopPm();
  });

  test("duplicate resume events never create simultaneous writes", async () => {
    const d = device();
    const response = deferredResponse();
    const stop = startPushNotificationRead(
      d.options("owner", (): Promise<ReadResponse> => response.promise),
      d.runtime,
    );
    d.emit();
    d.emit();
    expect(d.state.marks).toEqual([FIRST_ID]);
    response.resolve(ACCEPTED);
    await settled();
    d.emit();
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID]);
    expect(d.state.refreshes).toBe(1);
    stop();
  });

  test("disposed requests cannot clear intent or update the next session", async () => {
    const d = device();
    const response = deferredResponse();
    const stop = startPushNotificationRead(
      d.options("owner", (): Promise<ReadResponse> => response.promise),
      d.runtime,
    );
    stop();
    response.resolve(ACCEPTED);
    await settled();
    expect(d.state.stored).toBe(JSON.stringify({ id: FIRST_ID, userId: "owner" }));
    expect(d.state.url.searchParams.get("notificationId")).toBe(FIRST_ID);
    expect(d.state.refreshes).toBe(0);
    d.emit();
    expect(d.state.marks).toEqual([FIRST_ID]);
    const stopNext = startPushNotificationRead(d.options("owner"), d.runtime);
    await settled();
    expect(d.state.stored).toBeNull();
    expect(d.state.refreshes).toBe(1);
    stopNext();
  });

  test("a second tray click replaces the bounded intent without being cleared by the first", async () => {
    const d = device();
    const response = deferredResponse();
    let request = 0;
    const stop = startPushNotificationRead(
      d.options("owner", (): Promise<ReadResponse> => {
        request += 1;
        return request === 1 ? response.promise : Promise.resolve(ACCEPTED);
      }),
      d.runtime,
    );
    d.state.url.searchParams.set("notificationId", SECOND_ID);
    d.emit();
    expect(d.state.stored).toBe(JSON.stringify({ id: SECOND_ID, userId: "owner" }));
    expect(d.state.marks).toEqual([FIRST_ID]);
    response.resolve(ACCEPTED);
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID, SECOND_ID]);
    expect(d.state.stored).toBeNull();
    expect(d.state.url.searchParams.has("notificationId")).toBe(false);
    stop();
  });

  test("storage and history restrictions keep navigation usable without duplicate acknowledgments", async () => {
    const d = device();
    d.state.storageDenied = true;
    d.state.historyDenied = true;
    const stop = startPushNotificationRead(d.options("owner"), d.runtime);
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID]);
    expect(d.state.refreshes).toBe(1);
    d.emit();
    await settled();
    expect(d.state.marks).toEqual([FIRST_ID]);
    d.state.historyDenied = false;
    d.emit();
    expect(d.state.url.searchParams.has("notificationId")).toBe(false);
    stop();
  });

  test("malformed or oversized storage and invalid markers cannot enqueue a write", async () => {
    for (const stored of [
      "broken JSON",
      "x".repeat(513),
      JSON.stringify({ id: "bad", userId: null }),
    ]) {
      const d = device();
      d.state.url.searchParams.set("notificationId", "bad");
      d.state.stored = stored;
      const stop = startPushNotificationRead(d.options("owner"), d.runtime);
      await settled();
      expect(d.state.marks).toEqual([]);
      expect(d.state.refreshes).toBe(0);
      stop();
    }
  });

  test("browser adapter preserves a nested login-return marker and navigation query/hash", async () => {
    const url = new URL("https://atria.example/login?surface=mobile#login");
    url.searchParams.set("returnTo", `/projects/test?tab=rap&notificationId=${FIRST_ID}#detail`);
    await withBrowser(url.href, async (frame: Window): Promise<void> => {
      const d = device();
      const stopAnonymous = startPushNotificationRead(d.options(null));
      expect(frame.sessionStorage.length).toBe(1);
      expect(d.state.marks).toEqual([]);
      stopAnonymous();
      const stop = startPushNotificationRead(d.options("pm"));
      await settled();
      expect(d.state.marks).toEqual([FIRST_ID]);
      expect(frame.sessionStorage.length).toBe(0);
      expect(new URLSearchParams(frame.location.search).get("returnTo")).toBe(
        "/projects/test?tab=rap#detail",
      );
      expect(new URLSearchParams(frame.location.search).get("surface")).toBe("mobile");
      expect(frame.location.hash).toBe("#login");
      expect(d.state.refreshes).toBe(1);
      frame.dispatchEvent(new frame.Event("atria:urlchange"));
      frame.dispatchEvent(new frame.Event("focus"));
      await settled();
      expect(d.state.marks).toEqual([FIRST_ID]);
      stop();
    });
  });

  test("browser adapter keeps a captured intent across a password gate without requiring its marker", async () => {
    const url = `https://atria.example/projects/test?notificationId=${FIRST_ID}`;
    await withBrowser(url, async (frame: Window): Promise<void> => {
      const d = device();
      const stopAnonymous = startPushNotificationRead(d.options(null));
      stopAnonymous();
      frame.history.replaceState({}, "", "/profile/password");
      const stop = startPushNotificationRead(d.options("pm"));
      await settled();
      expect(d.state.marks).toEqual([FIRST_ID]);
      expect(frame.location.pathname).toBe("/profile/password");
      expect(frame.sessionStorage.length).toBe(0);
      stop();
    });
  });

  test("browser adapter rejects a foreign login-return URL", async () => {
    const url = new URL("https://atria.example/login");
    url.searchParams.set(
      "returnTo",
      `https://other.example/projects/test?notificationId=${FIRST_ID}`,
    );
    await withBrowser(url.href, async (): Promise<void> => {
      const d = device();
      const stop = startPushNotificationRead(d.options("pm"));
      await settled();
      expect(d.state.marks).toEqual([]);
      stop();
    });
  });
});
