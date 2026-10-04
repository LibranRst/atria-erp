import { expect, test } from "bun:test";
import {
  classifyDependencies,
  parseLock,
  resolveDependency,
  type Audit,
} from "./classify-dependencies";

const advisory = {
  id: 1,
  url: "https://github.com/advisories/GHSA-fixture",
  title: "Fixture vulnerability",
  severity: "high",
  vulnerable_versions: "<2.0.0",
};
const audit: Audit = { vulnerable: [advisory] };

test("workspace production edges never import another workspace's devDependencies", () => {
  const lock = parseLock(
    JSON.stringify({
      lockfileVersion: 1,
      workspaces: {
        "": { name: "root" },
        "apps/web": { name: "web", dependencies: { "@atria/api": "workspace:*" } },
        "apps/api": { name: "@atria/api", devDependencies: { tool: "1" } },
      },
      packages: {
        "@atria/api": ["@atria/api@workspace:apps/api"],
        tool: ["tool@1.0.0", "", { dependencies: { vulnerable: "1" } }],
        vulnerable: ["vulnerable@1.0.0", "", {}],
      },
    }),
  );
  const result = classifyDependencies(lock, audit);
  expect(result.findings).toHaveLength(1);
  expect(result.findings[0]?.webOrApiDependency).toBe(false);
  expect(result.findings[0]?.contexts.map((value) => [value.profile, value.kind])).toEqual([
    ["apps/api", "development"],
  ]);
});

test("separates optional Expo-style peers from API dependency exposure", () => {
  const lock = parseLock(
    JSON.stringify({
      lockfileVersion: 1,
      workspaces: {
        "apps/api": { name: "api", dependencies: { sdk: "1" } },
        "apps/mobile": { name: "mobile", dependencies: { vulnerable: "1" } },
      },
      packages: {
        sdk: [
          "sdk@1.0.0",
          "",
          { peerDependencies: { vulnerable: "*" }, optionalPeers: ["vulnerable"] },
        ],
        vulnerable: ["vulnerable@1.0.0", "", {}],
      },
    }),
  );
  const result = classifyDependencies(lock, audit);
  expect(result.findings[0]?.webOrApiDependency).toBe(false);
  expect(result.findings[0]?.contexts).toMatchObject([
    { profile: "apps/api", peer: "optional" },
    { profile: "apps/mobile", peer: "none" },
  ]);
});

test("API declaration contract in web does not become a web runtime claim", () => {
  const lock = parseLock(
    JSON.stringify({
      lockfileVersion: 1,
      workspaces: {
        "apps/web": { name: "web", dependencies: { "@atria/api": "workspace:*" } },
        "apps/api": { name: "@atria/api", dependencies: { vulnerable: "1" } },
      },
      packages: {
        "@atria/api": ["@atria/api@workspace:apps/api"],
        vulnerable: ["vulnerable@1.0.0", "", {}],
      },
    }),
  );
  const result = classifyDependencies(lock, audit);
  expect(result.findings[0]?.webOrApiDependency).toBe(true);
  expect(
    result.findings[0]?.contexts.find((value) => value.profile === "apps/web")?.contractOnly,
  ).toBe(true);
  expect(
    result.findings[0]?.contexts.find((value) => value.profile === "apps/api")?.contractOnly,
  ).toBe(false);
});

test("follows the actual nested scoped package instead of the hoisted different version", () => {
  const keys = new Set([
    "vulnerable",
    "@scope/parent",
    "@scope/parent/@scope/child",
    "@scope/parent/vulnerable",
  ]);
  expect(resolveDependency(keys, "@scope/parent/@scope/child", "vulnerable")).toBe(
    "@scope/parent/vulnerable",
  );
  const lock = parseLock(
    JSON.stringify({
      lockfileVersion: 1,
      workspaces: { "apps/web": { name: "web", dependencies: { "@scope/parent": "1" } } },
      packages: {
        "@scope/parent": ["@scope/parent@1.0.0", "", { dependencies: { "@scope/child": "1" } }],
        "@scope/parent/@scope/child": [
          "@scope/child@1.0.0",
          "",
          { dependencies: { vulnerable: "1" } },
        ],
        "@scope/parent/vulnerable": ["vulnerable@1.0.0", "", {}],
        vulnerable: ["vulnerable@2.0.0", "", {}],
      },
    }),
  );
  const result = classifyDependencies(lock, audit);
  expect(result.findings.map((value) => value.lockedKey)).toEqual(["@scope/parent/vulnerable"]);
  expect(result.findings[0]?.webOrApiDependency).toBe(true);
  expect(result.unresolved).toEqual([]);
});

test("patched locked versions do not retain stale audit findings", () => {
  const lock = parseLock(
    '{ "lockfileVersion":1, "workspaces":{"apps/web":{"name":"web","dependencies":{"vulnerable":"2"},},}, "packages":{"vulnerable":["vulnerable@2.0.0", "", {},],}, }',
  );
  const result = classifyDependencies(lock, audit);
  expect(result.findings).toEqual([]);
  expect(result.unmatchedAdvisories).toEqual([
    "vulnerable: https://github.com/advisories/GHSA-fixture",
  ]);
});

test("supports URL tarball metadata tuples and reports unresolved required edges", () => {
  const lock = parseLock(
    JSON.stringify({
      lockfileVersion: 1,
      workspaces: { "apps/web": { name: "web", dependencies: { xlsx: "url", missing: "1" } } },
      packages: {
        xlsx: [
          "xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
          { bin: {} },
          "sha512-fixture",
        ],
      },
    }),
  );
  const result = classifyDependencies(lock, {
    xlsx: [{ ...advisory, vulnerable_versions: "<=0.20.2" }],
  });
  expect(result.findings).toEqual([]);
  expect(result.unresolved).toEqual(["apps/web -> missing"]);
});
