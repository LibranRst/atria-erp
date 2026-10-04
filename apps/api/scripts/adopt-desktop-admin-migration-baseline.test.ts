import { expect, test } from "bun:test";
import {
  baselineChanges,
  assertDdlPostconditions,
  REVIEWED_BASELINE_HASHES,
} from "./adopt-desktop-admin-migration-baseline";
import type { HashedMigration } from "./apply-desktop-admin-migration";

const entries = Object.entries(REVIEWED_BASELINE_HASHES);
const journal: readonly HashedMigration[] = entries.map(([tag, value], index) => ({
  tag,
  when: index + 1,
  hash: value.current,
  sql: "",
}));
const history = entries.map(([, value], index) => ({
  id: index + 1,
  created_at: index + 1,
  hash: value.previous,
}));

test("baseline adoption is restricted to exact reviewed identities and is idempotent", () => {
  expect(baselineChanges(journal, history)).toHaveLength(3);
  expect(
    baselineChanges(
      journal,
      history.map((row, index) => ({ ...row, hash: journal[index]?.hash ?? "" })),
    ),
  ).toEqual([]);
  expect(() =>
    baselineChanges(
      journal,
      history.map((row) => ({ ...row, hash: "unknown" })),
    ),
  ).toThrow("Unrecognized tracking");
  expect(() =>
    baselineChanges(
      journal.map((row) => ({ ...row, hash: "edited SQL" })),
      history,
    ),
  ).toThrow("Reviewed SQL changed");
  const duplicate = history[0];
  if (!duplicate) throw new Error("Reviewed history fixture is missing.");
  expect(() => baselineChanges(journal, [...history, duplicate])).toThrow("duplicate tracking");
});

test("live FK/index definitions must match, not merely exist", () => {
  const sql =
    'ALTER TABLE "child" ADD CONSTRAINT "child_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action; CREATE INDEX "child_idx" ON "child" USING btree ("tenant_id");';
  const catalog = {
    columns: [],
    constraints: [
      {
        conname: "child_fk",
        table_name: "child",
        definition: "FOREIGN KEY (tenant_id) REFERENCES tenant(id)",
      },
    ],
    indexes: [
      {
        indexname: "child_idx",
        tablename: "child",
        indexdef: "CREATE INDEX child_idx ON public.child USING btree (tenant_id)",
      },
    ],
  };
  const existingIndex = catalog.indexes[0];
  const existingConstraint = catalog.constraints[0];
  if (!existingIndex || !existingConstraint) throw new Error("Schema fixtures are missing.");
  expect(() => assertDdlPostconditions(sql, catalog)).not.toThrow();
  expect(() =>
    assertDdlPostconditions(sql, {
      ...catalog,
      indexes: [
        {
          ...existingIndex,
          indexdef: "CREATE INDEX child_idx ON public.child USING btree (id)",
        },
      ],
    }),
  ).toThrow("Index postcondition mismatch");
  expect(() =>
    assertDdlPostconditions(sql, {
      ...catalog,
      constraints: [
        {
          ...existingConstraint,
          definition: "FOREIGN KEY (tenant_id) REFERENCES another(id)",
        },
      ],
    }),
  ).toThrow("FK postcondition mismatch");
});

test("legacy uniqueness structures must be absent before baseline adoption", () => {
  expect(() =>
    assertDdlPostconditions('DROP INDEX "legacy_idx";', {
      columns: [],
      constraints: [],
      indexes: [{ indexname: "legacy_idx", tablename: "child", indexdef: "old" }],
    }),
  ).toThrow("Legacy index still present");
  expect(() =>
    assertDdlPostconditions('ALTER TABLE "child" DROP CONSTRAINT "legacy_unique";', {
      columns: [],
      indexes: [],
      constraints: [{ conname: "legacy_unique", table_name: "child", definition: "old" }],
    }),
  ).toThrow("Legacy constraint still present");
});
