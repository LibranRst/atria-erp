import { expect, test } from "bun:test";
import {
  DESKTOP_MIGRATION_TAG,
  pendingDesktopMigration,
  pendingDesktopMigrations,
  type HashedMigration,
} from "./apply-desktop-admin-migration";

const baseline: HashedMigration = { tag: "0041_existing", when: 100, hash: "baseline", sql: "" };
const desktop: HashedMigration = {
  tag: DESKTOP_MIGRATION_TAG,
  when: 200,
  hash: "desktop",
  sql: "reviewed grants",
};
const journal = [baseline, desktop];

test("reviewed 0041 predecessor requires explicit opt-in and does not permit others", () => {
  const rab: HashedMigration = {
    tag: "0041_rab_item_nature",
    when: 150,
    hash: "rab",
    sql: "reviewed column",
  };
  const expanded = [baseline, rab, desktop];
  const applied = [{ hash: "baseline", created_at: 100 }];
  expect(() => pendingDesktopMigrations(expanded, applied, false)).toThrow("Other migrations");
  expect(pendingDesktopMigrations(expanded, applied, true).map((entry) => entry.tag)).toEqual([
    "0041_rab_item_nature",
    DESKTOP_MIGRATION_TAG,
  ]);
  expect(() =>
    pendingDesktopMigrations(
      [...expanded, { ...rab, tag: "unknown", hash: "other" }],
      applied,
      true,
    ),
  ).toThrow("Other migrations");
});

test("only the desktop migration may remain pending", () => {
  expect(pendingDesktopMigration(journal, [{ hash: "baseline", created_at: "100" }])).toBe(desktop);
  expect(() => pendingDesktopMigration(journal, [{ hash: "desktop", created_at: 200 }])).toThrow(
    "Other migrations are pending",
  );
  expect(() => pendingDesktopMigration(journal, [])).toThrow("history is empty");
});

test("unknown, mismatched and duplicate history is refused", () => {
  expect(() => pendingDesktopMigration(journal, [{ hash: "untracked", created_at: 100 }])).toThrow(
    "exactly match",
  );
  expect(() => pendingDesktopMigration(journal, [{ hash: "baseline", created_at: 101 }])).toThrow(
    "exactly match",
  );
  expect(() => pendingDesktopMigration(journal, [{ hash: "baseline", created_at: null }])).toThrow(
    "exactly match",
  );
  expect(() =>
    pendingDesktopMigration(journal, [
      { hash: "baseline", created_at: 100 },
      { hash: "baseline", created_at: 100 },
    ]),
  ).toThrow("duplicated");
});

test("an applied desktop migration is skipped, preserving later revocations", () => {
  expect(
    pendingDesktopMigration(journal, [
      { hash: "baseline", created_at: 100 },
      { hash: "desktop", created_at: 200 },
    ]),
  ).toBeNull();
});
