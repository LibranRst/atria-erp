import { expect, test } from "bun:test";
import { resolveAuthClientBaseURL } from "./auth-client-url";

test("local auth follows the actual Next origin when its port or network host changes", () => {
  expect(
    resolveAuthClientBaseURL("http://localhost:3000", "http://localhost:3001"),
  ).toBeUndefined();
  expect(
    resolveAuthClientBaseURL("http://localhost:3000", "http://192.168.1.4:3000"),
  ).toBeUndefined();
  expect(resolveAuthClientBaseURL("http://localhost:3000", "http://localhost:3000")).toBe(
    "http://localhost:3000",
  );
});
test("configured deployed auth origins are preserved", () => {
  expect(resolveAuthClientBaseURL("https://atria.example.com", "https://preview.example.com")).toBe(
    "https://atria.example.com",
  );
  expect(resolveAuthClientBaseURL("invalid", "http://localhost:3000")).toBeUndefined();
  expect(resolveAuthClientBaseURL(undefined)).toBeUndefined();
});
