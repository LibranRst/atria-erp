import { describe, expect, test } from "bun:test";

import {
  isIosPushAvailableWithoutInstall,
  resolveInstallEnvironment,
  resolveInstallSurface,
} from "./install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("PWA install environment", () => {
  test("Safari iOS yang belum dipasang menuntut pemasangan sebelum push bisa dipakai", () => {
    const environment = resolveInstallEnvironment({
      userAgent: IPHONE_SAFARI,
      maxTouchPoints: 5,
      standalone: false,
      pushSupported: false,
      canPromptInstall: false,
    });

    expect(environment.platform).toBe("ios");
    expect(environment.browser).toBe("safari");
    expect(isIosPushAvailableWithoutInstall(environment)).toBe(false);
    expect(resolveInstallSurface(environment)).toBe("ios-steps");
  });

  test("iPad yang melaporkan diri sebagai Macintosh tetap dikenali sebagai iOS", () => {
    const environment = resolveInstallEnvironment({
      userAgent: IPAD_SAFARI,
      maxTouchPoints: 5,
      standalone: false,
      pushSupported: false,
      canPromptInstall: false,
    });

    expect(environment.platform).toBe("ios");
    expect(resolveInstallSurface(environment)).toBe("ios-steps");
  });

  test("iOS yang sudah dipasang membuka push dan berhenti menawarkan pemasangan", () => {
    const environment = resolveInstallEnvironment({
      userAgent: IPHONE_SAFARI,
      maxTouchPoints: 5,
      standalone: true,
      pushSupported: true,
      canPromptInstall: false,
    });

    expect(isIosPushAvailableWithoutInstall(environment)).toBe(true);
    expect(resolveInstallSurface(environment)).toBe("installed");
  });

  test("Chrome di iOS tidak pernah mendapat instruksi Layar Utama milik Safari", () => {
    const environment = resolveInstallEnvironment({
      userAgent: IPHONE_CHROME,
      maxTouchPoints: 5,
      standalone: false,
      pushSupported: false,
      canPromptInstall: false,
    });

    expect(environment.browser).toBe("chrome");
    expect(resolveInstallSurface(environment)).toBe("unavailable");
  });

  test("Android Chrome tanpa prompt tertahan mengarahkan ke menu peramban", () => {
    const environment = resolveInstallEnvironment({
      userAgent: ANDROID_CHROME,
      maxTouchPoints: 5,
      standalone: false,
      pushSupported: true,
      canPromptInstall: false,
    });

    expect(environment.platform).toBe("android");
    expect(resolveInstallSurface(environment)).toBe("browser-menu");
  });

  test("Android Chrome dengan prompt tertahan menawarkan pemasangan", () => {
    const environment = resolveInstallEnvironment({
      userAgent: ANDROID_CHROME,
      maxTouchPoints: 5,
      standalone: false,
      pushSupported: true,
      canPromptInstall: true,
    });

    expect(environment.platform).toBe("android");
    expect(isIosPushAvailableWithoutInstall(environment)).toBe(true);
    expect(resolveInstallSurface(environment)).toBe("prompt");
  });

  test("Android yang sudah terpasang tidak menawarkan pemasangan lagi", () => {
    const environment = resolveInstallEnvironment({
      userAgent: ANDROID_CHROME,
      maxTouchPoints: 5,
      standalone: true,
      pushSupported: true,
      canPromptInstall: false,
    });

    expect(resolveInstallSurface(environment)).toBe("installed");
  });

  test("desktop tanpa prompt mengarahkan ke menu peramban, bukan menawarkan tombol", () => {
    const environment = resolveInstallEnvironment({
      userAgent: MAC_CHROME,
      maxTouchPoints: 0,
      standalone: false,
      pushSupported: true,
      canPromptInstall: false,
    });

    expect(environment.platform).toBe("desktop");
    expect(resolveInstallSurface(environment)).toBe("browser-menu");
  });
});
