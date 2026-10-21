import { describe, expect, test } from "bun:test";

import type { InstallEnvironment } from "@/lib/pwa/install";
import { PUSH_STATE_COPY, resolvePushState, type PushSignals } from "./push-state";

const IOS_SAFARI_TAB: InstallEnvironment = {
  platform: "ios",
  browser: "safari",
  standalone: false,
  pushSupported: false,
  canPromptInstall: false,
};
const IOS_SAFARI_INSTALLED: InstallEnvironment = {
  ...IOS_SAFARI_TAB,
  standalone: true,
  pushSupported: true,
};
const ANDROID_CHROME: InstallEnvironment = {
  platform: "android",
  browser: "chrome",
  standalone: false,
  pushSupported: true,
  canPromptInstall: true,
};
const DESKTOP_WITHOUT_PUSH: InstallEnvironment = {
  platform: "desktop",
  browser: "firefox",
  standalone: false,
  pushSupported: false,
  canPromptInstall: false,
};

function signals(input: {
  readonly install: InstallEnvironment;
  readonly permission?: PushSignals["permission"];
  readonly serverRegistration?: PushSignals["serverRegistration"];
  readonly subscribed?: boolean;
  readonly serverKeyConfigured?: boolean;
}): PushSignals {
  return {
    environment: {
      secureContext: true,
      install: input.install,
      pushApiSupported: input.install.pushSupported,
      serverKeyConfigured: input.serverKeyConfigured ?? true,
    },
    permission: input.permission ?? "default",
    serverRegistration: input.serverRegistration ?? "unknown",
    subscribed: input.subscribed ?? false,
  };
}

describe("resolvePushState", () => {
  test("alamat LAN HTTP menjelaskan HTTPS tanpa menawarkan izin yang gagal", () => {
    const input = signals({ install: ANDROID_CHROME });
    const state = resolvePushState({
      ...input,
      environment: { ...input.environment, secureContext: false },
    });
    expect(state).toBe("insecure");
    expect(PUSH_STATE_COPY[state].description).toContain("HTTPS");
    expect(PUSH_STATE_COPY[state].action).toBeNull();
  });
  test("iOS Safari di tab biasa meminta pemasangan, bukan menyebut browser tidak mendukung", () => {
    const state = resolvePushState(signals({ install: IOS_SAFARI_TAB }));
    expect(state).toBe("ios-install-required");
    const copy = PUSH_STATE_COPY[state];
    expect(copy.description).toContain("Layar Utama");
    expect(copy.description).not.toContain("belum mendukung");
    // Tanpa aksi: permintaan izin dari tab Safari iOS tidak akan pernah menghasilkan langganan.
    expect(copy.action).toBeNull();
  });

  test("iOS yang sudah dipasang menawarkan aktivasi normal", () => {
    expect(resolvePushState(signals({ install: IOS_SAFARI_INSTALLED }))).toBe("disabled");
    expect(
      resolvePushState(signals({ install: IOS_SAFARI_INSTALLED, permission: "granted" })),
    ).toBe("disabled");
  });

  test("iOS terpasang dengan langganan hidup adalah aktif", () => {
    expect(
      resolvePushState(
        signals({
          install: IOS_SAFARI_INSTALLED,
          permission: "granted",
          subscribed: true,
          serverRegistration: "confirmed",
        }),
      ),
    ).toBe("enabled");
  });

  test("Android dan desktop yang mendukung push berperilaku sama seperti iOS terpasang", () => {
    expect(resolvePushState(signals({ install: ANDROID_CHROME }))).toBe("disabled");
    expect(
      resolvePushState(
        signals({ install: ANDROID_CHROME, permission: "granted", subscribed: true }),
      ),
    ).toBe("enabled");
  });

  test("browser tanpa Push API tetap disebut tidak mendukung", () => {
    const state = resolvePushState(signals({ install: DESKTOP_WITHOUT_PUSH }));
    expect(state).toBe("unsupported");
    expect(PUSH_STATE_COPY[state].description).toContain("belum mendukung");
  });

  test("izin yang ditolak dibedakan dari izin yang belum diminta", () => {
    expect(resolvePushState(signals({ install: ANDROID_CHROME, permission: "denied" }))).toBe(
      "denied",
    );
    expect(PUSH_STATE_COPY.denied.description).toContain("pengaturan situs");
    expect(resolvePushState(signals({ install: ANDROID_CHROME, permission: "default" }))).toBe(
      "disabled",
    );
    expect(PUSH_STATE_COPY.disabled.action).toBe("enable");
  });

  test("langganan hidup tanpa catatan server meminta sinkronisasi ulang", () => {
    const state = resolvePushState(
      signals({
        install: ANDROID_CHROME,
        permission: "granted",
        subscribed: true,
        serverRegistration: "failed",
      }),
    );
    expect(state).toBe("sync-required");
    expect(PUSH_STATE_COPY[state].action).toBe("reconnect");
  });

  test("VAPID yang belum dikonfigurasi menang atas panduan pemasangan iOS", () => {
    expect(resolvePushState(signals({ install: IOS_SAFARI_TAB, serverKeyConfigured: false }))).toBe(
      "unconfigured",
    );
    expect(PUSH_STATE_COPY.unconfigured.action).toBeNull();
  });
});
