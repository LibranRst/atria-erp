import { describe, expect, test } from "bun:test";
import { ROLE_PERMISSIONS } from "../auth/permissions";
import { SYSTEM_ROLES } from "../auth/role-constants";
import {
  acknowledgeRoleGuideSchema,
  buildRoleGuide,
  isRoleGuideWorkspaceRoute,
  serializeRoleGuideContext,
  type RoleGuideAccess,
} from "./role-guide";

function access(index: number): RoleGuideAccess {
  const role = SYSTEM_ROLES[index];
  if (!role) throw new Error("Unknown fixture role");
  return {
    roleId: role.id,
    roleName: role.name.toUpperCase(),
    dataScope: role.dataScope,
    permissions: ROLE_PERMISSIONS[role.name.toUpperCase()] ?? [],
  };
}
describe("role introduction reflects actual effective access", () => {
  test.each([
    [0, "Owner", "/ledger", ["budget", "approval", "settings"]],
    [1, "Finance Admin", "/ledger", ["verify", "payment", "reconcile"]],
    [2, "Project Manager", "/projects", ["budget", "cost", "vendor"]],
    [3, "Purchasing", "/materials", ["stock", "movement", "material"]],
  ] as const)(
    "default role %s has useful duties and a safe first step",
    (index, label, href, ids) => {
      const guide = buildRoleGuide(access(index));
      expect(guide.roleLabel).toBe(label);
      expect(guide.primaryAction.href).toBe(href);
      expect(guide.responsibilities.map((row) => row.id)).toEqual([...ids]);
    },
  );
  test("Finance is not promised unrestricted approval; PM is not promised cash/stock mutations", () => {
    expect(buildRoleGuide(access(1)).responsibilities.map((row) => row.id)).not.toContain(
      "approval",
    );
    expect(buildRoleGuide(access(2)).responsibilities.map((row) => row.id)).not.toContain(
      "payment",
    );
    expect(buildRoleGuide(access(2)).scopeNote).toContain("Jika proyek belum muncul");
  });
  test("revoked permissions never fall back to seed and custom names do not impersonate system roles", () => {
    const guide = buildRoleGuide({
      ...access(0),
      roleId: "custom",
      roleName: "warehouse_reader",
      permissions: ["view:inventory"],
      dataScope: "NONE",
    });
    expect(guide.roleLabel).not.toContain("_");
    expect(guide.responsibilities.map((row) => row.id)).toEqual(["stock"]);
    expect(guide.primaryAction.href).toBe("/materials");
    const revoked = buildRoleGuide({ ...access(0), permissions: [] });
    expect(revoked.responsibilities).toEqual([]);
    expect(revoked.primaryAction.href).toBe("/profile");
  });
  test("scope and route-level guards beat nominal ledger/project grants", () => {
    const none = buildRoleGuide({
      ...access(0),
      permissions: ["view:ledger", "view:budget", "view:approval_queue", "approve:cost"],
      dataScope: "NONE",
    });
    expect(none.primaryAction.href).toBe("/profile");
    expect(none.responsibilities).toEqual([]);
    const assigned = buildRoleGuide({ ...access(2), permissions: ["view:ledger", "view:budget"] });
    expect(assigned.primaryAction.href).toBe("/projects");
  });
  test("partial material permissions only explain the granted operation", () => {
    const guide = buildRoleGuide({
      ...access(3),
      permissions: ["view:material", "update:material"],
    });
    expect(guide.responsibilities[0]?.description).toContain("Perbarui");
    expect(guide.responsibilities[0]?.description).not.toContain("Tambahkan");
    expect(guide.responsibilities[0]?.title).not.toContain("pembelian");
    expect(guide.primaryAction.href).toBe("/profile");
  });

  test("scope alone never promises project access or payment rights", () => {
    const stockReader = buildRoleGuide({ ...access(0), permissions: ["view:inventory"] });
    expect(stockReader.scopeNote).not.toContain("mengakses seluruh proyek");
    const blockedPayment = buildRoleGuide({
      ...access(3),
      permissions: ["view:vendor_bill", "pay:vendor_bill"],
    });
    expect(blockedPayment.responsibilities).toEqual([]);
    const teamOnly = buildRoleGuide({
      ...access(0),
      permissions: ["view:settings", "manage:users"],
    });
    expect(teamOnly.responsibilities[0]?.title).toBe("Kelola anggota tim");
    const billOnly = buildRoleGuide({
      ...access(3),
      permissions: ["view:vendor_bill", "create:vendor_bill"],
    });
    expect(billOnly.responsibilities.map((row) => row.id)).toEqual(["vendor"]);
  });
  test("context ignores ordering, duplicate and technical/deferred grants", () => {
    const original = access(2);
    expect(serializeRoleGuideContext(original)).toBe(
      serializeRoleGuideContext({
        ...original,
        permissions: [
          ...original.permissions.toReversed(),
          "use:desktop_admin",
          "view:ai_brief",
          "view:budget",
        ],
      }),
    );
    expect(serializeRoleGuideContext(original)).not.toBe(
      serializeRoleGuideContext({
        ...original,
        permissions: original.permissions.filter((key) => key !== "create:cost"),
      }),
    );
    expect(serializeRoleGuideContext(original)).not.toBe(
      serializeRoleGuideContext({ ...original, dataScope: "GLOBAL" }),
    );
    expect(serializeRoleGuideContext(original)).not.toBe(
      serializeRoleGuideContext({ ...original, roleId: "another-role" }),
    );
  });
  test("acknowledgment has no client user identifier and requires a valid context", () => {
    expect(acknowledgeRoleGuideSchema.safeParse({ contextKey: "a".repeat(64) }).success).toBe(true);
    expect(
      acknowledgeRoleGuideSchema.safeParse({ contextKey: "a".repeat(64), userId: "someone-else" })
        .success,
    ).toBe(false);
    expect(acknowledgeRoleGuideSchema.safeParse({ contextKey: "old" }).success).toBe(false);
  });
  test.each([
    "/",
    "/login",
    "/setup",
    "/profile/password",
    "/onboarding",
    "/onboarding/review",
    "/api/auth/sign-in",
    "/admin/projects",
  ])("suppresses protected/public route %s", (route) => {
    expect(isRoleGuideWorkspaceRoute(route)).toBe(false);
  });
  test.each([
    "/ledger",
    "/projects",
    "/projects/project-id",
    "/materials",
    "/profile",
    "/settings",
  ])("allows ordinary workspace %s", (route) => {
    expect(isRoleGuideWorkspaceRoute(route)).toBe(true);
  });
});
