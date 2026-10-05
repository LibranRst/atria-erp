import { describe, expect, test } from "bun:test";

import type { PushEnvironment } from "./push-state";
import { inspectWebPush, type WebPushRegistration } from "./push-sync";

const ANDROID: PushEnvironment = {
  secureContext: true,
  install: {
    platform: "android",
    browser: "chrome",
    standalone: false,
    pushSupported: true,
    canPromptInstall: true,
  },
  pushApiSupported: true,
  serverKeyConfigured: true,
};

const LIVE_SUBSCRIPTION: WebPushRegistration = {
  endpoint: "https://push.example.test/live",
  p256dh: "key",
  auth: "auth",
};

/** Perangkat palsu dengan state nyata, bukan pencatat panggilan. */
function device(options: {
  readonly subscription?: WebPushRegistration | null;
  readonly permission?: "granted" | "default" | "denied";
  readonly serverAccepts?: boolean;
  readonly serverThrows?: boolean;
}) {
  const state = {
    subscription: options.subscription ?? null,
    /** Catatan server yang bertahan antar-panggilan, seperti baris basis data. */
    server: new Map<string, WebPushRegistration>(),
    registrations: 0,
  };
  return {
    state,
    deps: {
      readEnvironment: () => ANDROID,
      readPermission: () => options.permission ?? "granted",
      readSubscription: async (): Promise<WebPushRegistration | null> => state.subscription,
      register: async (registration: WebPushRegistration): Promise<boolean> => {
        state.registrations += 1;
        if (options.serverThrows) throw new Error("jaringan gagal");
        if (options.serverAccepts === false) return false;
        state.server.set(registration.endpoint, registration);
        return true;
      },
    },
  };
}

describe("rekonsiliasi langganan push", () => {
  test("langganan hidup dengan catatan server hilang dipulihkan dan tercatat", async () => {
    const { state, deps } = device({ subscription: LIVE_SUBSCRIPTION, serverAccepts: true });
    const signals = await inspectWebPush(deps);
    expect(signals.subscribed).toBe(true);
    expect(signals.serverRegistration).toBe("confirmed");
    expect(state.server.get(LIVE_SUBSCRIPTION.endpoint)).toEqual(LIVE_SUBSCRIPTION);
  });

  test("rekonsiliasi bersifat idempoten: pemanggilan berulang tidak menumpuk catatan", async () => {
    const { state, deps } = device({ subscription: LIVE_SUBSCRIPTION, serverAccepts: true });
    await inspectWebPush(deps);
    await inspectWebPush(deps);
    await inspectWebPush(deps);
    expect(state.server.size).toBe(1);
  });

  test("tanpa langganan perangkat tidak ada catatan server yang dibuat", async () => {
    const { state, deps } = device({ subscription: null });
    const signals = await inspectWebPush(deps);
    expect(state.registrations).toBe(0);
    expect(state.server.size).toBe(0);
    expect(signals.subscribed).toBe(false);
    expect(signals.serverRegistration).toBe("unknown");
  });

  test("tidak ada penulisan server sebelum izin diberikan", async () => {
    const { state, deps } = device({ subscription: LIVE_SUBSCRIPTION, permission: "default" });
    const signals = await inspectWebPush(deps);
    expect(state.registrations).toBe(0);
    expect(signals.serverRegistration).toBe("unknown");
    expect(signals.subscribed).toBe(true);
  });

  test("catatan server yang gagal dilaporkan sebagai perlu sinkronisasi", async () => {
    const failing = device({ subscription: LIVE_SUBSCRIPTION, serverAccepts: false });
    expect((await inspectWebPush(failing.deps)).serverRegistration).toBe("failed");
    const throwing = device({ subscription: LIVE_SUBSCRIPTION, serverThrows: true });
    expect((await inspectWebPush(throwing.deps)).serverRegistration).toBe("failed");
    // Langganan perangkat tidak dicabut hanya karena satu percobaan gagal.
    expect(throwing.state.subscription).toEqual(LIVE_SUBSCRIPTION);
  });

  test("tanpa Push API tidak ada pembacaan langganan maupun penulisan server", async () => {
    const { state, deps } = device({ subscription: LIVE_SUBSCRIPTION });
    const signals = await inspectWebPush({
      ...deps,
      readEnvironment: () => ({ ...ANDROID, pushApiSupported: false }),
    });
    expect(signals.subscribed).toBe(false);
    expect(state.registrations).toBe(0);
  });
});
