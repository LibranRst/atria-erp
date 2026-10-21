import { expect, test } from "bun:test";
import {
  pendingWarehouseIntakeMigration,
  type WarehouseIntakeMigration,
} from "./apply-warehouse-intake-migration";

const prior: WarehouseIntakeMigration = { tag: "0047_prior", when: 47, hash: "prior", sql: "" };
const guide: WarehouseIntakeMigration = {
  tag: "0048_warehouse_intake",
  when: 48,
  hash: "guide",
  sql: "",
};
test("targeted intake migration never skips unknown earlier migrations", () => {
  expect(() => pendingWarehouseIntakeMigration([prior, guide], new Set())).toThrow(
    "Earlier migrations",
  );
  expect(pendingWarehouseIntakeMigration([prior, guide], new Set(["prior"]))).toEqual(guide);
});
test("already applied receipts and missing migration fail safely", () => {
  expect(pendingWarehouseIntakeMigration([prior, guide], new Set(["prior", "guide"]))).toBeNull();
  expect(() => pendingWarehouseIntakeMigration([prior], new Set(["prior"]))).toThrow("missing");
});
