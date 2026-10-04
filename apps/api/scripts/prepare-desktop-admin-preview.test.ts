import { expect, test } from "bun:test";
import { assertPreviewHost, previewMigrationPlan } from "./prepare-desktop-admin-preview";
import type { HashedMigration } from "./apply-desktop-admin-migration";

const journal: readonly HashedMigration[] = [
  { tag: "0039_existing", when: 39, hash: "baseline", sql: "" },
  { tag: "0041_rab_item_nature", when: 41, hash: "rab", sql: "reviewed column" },
  { tag: "0042_grant_desktop_admin", when: 42, hash: "desktop", sql: "reviewed grant" },
];

test("clone host must match exactly and cannot be source UAT or production", () => {
  expect(() => assertPreviewHost("clone.neon.tech", "clone.neon.tech", [])).not.toThrow();
  expect(() => assertPreviewHost("clone.neon.tech", "different.neon.tech", [])).toThrow(
    "exactly match",
  );
  expect(() =>
    assertPreviewHost("prod-pooler.neon.tech", "prod-pooler.neon.tech", ["prod.neon.tech"]),
  ).toThrow("forbidden");
  expect(() =>
    assertPreviewHost(
      "ep-square-mountain-aomb85pp-pooler.c-2.ap-southeast-1.aws.neon.tech",
      "ep-square-mountain-aomb85pp-pooler.c-2.ap-southeast-1.aws.neon.tech",
      [],
    ),
  ).toThrow("forbidden");
});

test("historical clone drift is preserved while only reviewed pending migrations are planned", () => {
  const plan = previewMigrationPlan(journal, [{ hash: "inherited-old-hash", created_at: 39 }]);
  expect(plan.pending.map((entry) => entry.tag)).toEqual([
    "0041_rab_item_nature",
    "0042_grant_desktop_admin",
  ]);
  expect(plan.inheritedDrift).toEqual(["0039_existing"]);
  expect(() => previewMigrationPlan(journal, [])).toThrow("must already exist");
  expect(() => previewMigrationPlan(journal, [{ hash: "rab", created_at: 41 }])).toThrow(
    "missing a predecessor",
  );
});

test("recorded preview migrations never rerun or restore revoked grants", () => {
  expect(
    previewMigrationPlan(journal, [
      { hash: "inherited-old-hash", created_at: 39 },
      { hash: "rab", created_at: 41 },
      { hash: "desktop", created_at: 42 },
    ]).pending,
  ).toEqual([]);
  expect(() =>
    previewMigrationPlan(journal, [
      { hash: "baseline", created_at: 39 },
      { hash: "unknown-desktop", created_at: 42 },
    ]),
  ).toThrow("reviewed file");
});
