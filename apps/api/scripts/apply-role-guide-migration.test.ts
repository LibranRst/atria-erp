import { expect, test } from "bun:test";
import { pendingRoleGuideMigration, type GuideMigration } from "./apply-role-guide-migration";

const prior: GuideMigration = { tag: "0046_prior", when: 46, hash: "prior", sql: "" };
const guide: GuideMigration = {
  tag: "0047_user_role_guide_state",
  when: 47,
  hash: "guide",
  sql: "",
};
test("targeted guide migration never skips unknown earlier migrations", () => {
  expect(() => pendingRoleGuideMigration([prior, guide], new Set())).toThrow("Earlier migrations");
  expect(pendingRoleGuideMigration([prior, guide], new Set(["prior"]))).toEqual(guide);
});
test("already applied receipts and missing migration fail safely", () => {
  expect(pendingRoleGuideMigration([prior, guide], new Set(["prior", "guide"]))).toBeNull();
  expect(() => pendingRoleGuideMigration([prior], new Set(["prior"]))).toThrow("missing");
});
