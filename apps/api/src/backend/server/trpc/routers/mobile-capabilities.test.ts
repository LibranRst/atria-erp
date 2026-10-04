import { describe, expect, test } from "bun:test";
import type { Actor } from "@backend/server/actor";
import { screenRouter } from "./screen";
import { getRoleNavItems } from "@atria/core/navigation/role-navigation";

const actor: Actor = {
  userId: "custom-user",
  roleId: "custom-role",
  roleName: "SITE_FINANCE",
  permissions: ["view:project", "view:cost"],
  dataScope: "ASSIGNED",
  name: "Finance Lapangan",
  email: "finance@example.invalid",
  isActive: true,
  mustChangePassword: false,
  sessionId: "private-session",
  developerActorUserId: null,
};
const router = screenRouter;
function caller(value: Actor | null): ReturnType<typeof router.createCaller> {
  return router.createCaller({ actor: value, headers: new Headers() });
}

describe("mobile effective capabilities", () => {
  test("custom role mendapat navigasi dari grant server dan scope aslinya", async () => {
    const result = await caller(actor).capabilities();
    expect(result.roleName).toBe("SITE_FINANCE");
    expect(result.dataScope).toBe("ASSIGNED");
    expect(getRoleNavItems(result.permissions).map((item) => item.href)).toEqual([
      "/projects",
      "/expenses",
    ]);
    expect(result).not.toHaveProperty("sessionId");
    expect(result).not.toHaveProperty("email");
  });
  test("role bawaan tidak mendapat grant seed yang telah dicabut", async () => {
    const result = await caller({ ...actor, roleName: "OWNER", permissions: [] }).capabilities();
    expect(result.permissions).toEqual([]);
    expect(getRoleNavItems(result.permissions)).toEqual([]);
  });
  test("request berikutnya mencerminkan perubahan permission", async () => {
    const before = await caller(actor).capabilities();
    const after = await caller({ ...actor, permissions: ["view:inventory"] }).capabilities();
    expect(getRoleNavItems(before.permissions).map((item) => item.href)).toEqual([
      "/projects",
      "/expenses",
    ]);
    expect(getRoleNavItems(after.permissions).map((item) => item.href)).toEqual(["/materials"]);
  });
  test("tanpa sesi atau akun nonaktif ditolak", async () => {
    await expect(caller(null).capabilities()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ ...actor, isActive: false }).capabilities()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  test("kata sandi sementara tetap menutup bootstrap operasional", async () => {
    await expect(
      caller({ ...actor, mustChangePassword: true }).capabilities(),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "MUST_CHANGE_PASSWORD",
    });
  });
});
