import { describe, expect, test } from "bun:test";
import { resolveRuntimeURL } from "./runtime-url";

describe("independent API and web hosts", () => {
  test("development uses Metro's reachable host with separate service ports", () => {
    expect(resolveRuntimeURL("api", undefined, "192.168.1.18:8081", true)).toBe(
      "http://192.168.1.18:3001",
    );
    expect(resolveRuntimeURL("web", undefined, "192.168.1.18:8081", true)).toBe(
      "http://192.168.1.18:3000",
    );
  });

  test("explicit service URLs override local development independently", () => {
    expect(resolveRuntimeURL("api", " https://api.atria.test/// ", "localhost:8081", true)).toBe(
      "https://api.atria.test",
    );
    expect(resolveRuntimeURL("web", "http://localhost:3000", "localhost:8081", true)).toBe(
      "http://localhost:3000",
    );
  });

  test("simulator loopback and IPv6 retain a valid hostname", () => {
    expect(resolveRuntimeURL("api", " ", "localhost:8081", true)).toBe("http://localhost:3001");
    expect(resolveRuntimeURL("api", undefined, "[::1]:8081", true)).toBe("http://[::1]:3001");
  });

  test("release builds never derive API or web URLs from Metro", () => {
    expect(() => resolveRuntimeURL("api", undefined, "192.168.1.18:8081", false)).toThrow(
      "EXPO_PUBLIC_API_URL wajib diisi",
    );
    expect(() => resolveRuntimeURL("web", undefined, "192.168.1.18:8081", false)).toThrow(
      "EXPO_PUBLIC_WEB_URL wajib diisi",
    );
  });

  test("missing development host requires explicit config", () => {
    expect(() => resolveRuntimeURL("api", undefined, undefined, true)).toThrow(
      "EXPO_PUBLIC_API_URL wajib diisi",
    );
  });

  test("service hosts reject non-HTTP protocols and embedded credentials", () => {
    expect(() => resolveRuntimeURL("api", "file:///etc/passwd", null, false)).toThrow();
    expect(() =>
      resolveRuntimeURL("web", "https://user:password@atria.test", null, false),
    ).toThrow();
  });
});
