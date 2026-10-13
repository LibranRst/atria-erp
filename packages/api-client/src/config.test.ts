import { describe, expect, test } from "bun:test";
import { readBackendConnection } from "./config";

describe("server-supplied API connection", (): void => {
  test("requires explicit production origin and secret while keeping local API at 3001", (): void => {
    expect(readBackendConnection({}).origin).toBe("http://localhost:3001");
    expect(() => readBackendConnection({ NODE_ENV: "production" })).toThrow();
    expect(() =>
      readBackendConnection({ NODE_ENV: "production", API_ORIGIN: "https://api.example.test" }),
    ).toThrow();
    expect(
      readBackendConnection({
        NODE_ENV: "production",
        API_ORIGIN: "https://api.example.test",
        API_BRIDGE_SECRET: "fixture-production-secret",
      }).origin,
    ).toBe("https://api.example.test");
  });

  test("refuses credential-bearing or path-based URLs and invalid timeouts", (): void => {
    for (const API_ORIGIN of [
      "https://user:pass@example.test",
      "https://example.test/api",
      "https://example.test?x=1",
      "file:///api",
    ])
      expect(() => readBackendConnection({ API_ORIGIN })).toThrow();
    for (const API_CALL_TIMEOUT_MS of ["0", "-1", "1.5", "bad"])
      expect(() => readBackendConnection({ API_CALL_TIMEOUT_MS })).toThrow();
  });
});
