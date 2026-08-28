import { describe, expect, test } from "bun:test";

import {
  buildRoleCreateHref,
  buildRoleEditorHref,
  parsePermissionKeyList,
  ROLE_DEEP_LINK_PARAMS,
} from "./role-deep-link";

const ROLE_ID = "00000000-0000-0000-0000-000000000003";

describe("Tautan penyunting peran", () => {
  test("selalu membawa tab dan workspace yang benar", () => {
    const href = buildRoleEditorHref({ roleId: ROLE_ID });
    const params = new URLSearchParams(href.split("?")[1]);

    expect(href.startsWith("/settings?")).toBe(true);
    expect(params.get("tab")).toBe("organization");
    expect(params.get(ROLE_DEEP_LINK_PARAMS.workspace)).toBe("roles");
    expect(params.get(ROLE_DEEP_LINK_PARAMS.role)).toBe(ROLE_ID);
  });

  test("menghilangkan parameter saran yang kosong", () => {
    const href = buildRoleEditorHref({ roleId: ROLE_ID, grant: [], revoke: [] });
    const params = new URLSearchParams(href.split("?")[1]);

    expect(params.has(ROLE_DEEP_LINK_PARAMS.grant)).toBe(false);
    expect(params.has(ROLE_DEEP_LINK_PARAMS.revoke)).toBe(false);
  });

  test("membawa saran pulang-pergi tanpa berubah", () => {
    const href = buildRoleEditorHref({
      roleId: ROLE_ID,
      grant: ["pay:cost", "approve:cost"],
      revoke: ["view:ledger"],
    });
    const params = new URLSearchParams(href.split("?")[1]);

    expect(parsePermissionKeyList(params.get(ROLE_DEEP_LINK_PARAMS.grant))).toEqual([
      "pay:cost",
      "approve:cost",
    ]);
    expect(parsePermissionKeyList(params.get(ROLE_DEEP_LINK_PARAMS.revoke))).toEqual([
      "view:ledger",
    ]);
  });

  test("menautkan ke sheet peran baru dengan isian awal", () => {
    const params = new URLSearchParams(
      buildRoleCreateHref({ name: "Site Supervisor", dataScope: "ASSIGNED" }).split("?")[1],
    );

    expect(params.get(ROLE_DEEP_LINK_PARAMS.workspace)).toBe("roles");
    expect(params.get(ROLE_DEEP_LINK_PARAMS.newRole)).toBe("1");
    expect(params.get(ROLE_DEEP_LINK_PARAMS.name)).toBe("Site Supervisor");
    expect(params.get(ROLE_DEEP_LINK_PARAMS.scope)).toBe("ASSIGNED");
    // Izin tidak ikut: sheet pembuatan tidak punya daftar sakelar.
    expect(params.has(ROLE_DEEP_LINK_PARAMS.grant)).toBe(false);
  });

  test("membaca daftar kosong dengan aman", () => {
    expect(parsePermissionKeyList(null)).toEqual([]);
    expect(parsePermissionKeyList("")).toEqual([]);
    expect(parsePermissionKeyList(" , ,")).toEqual([]);
  });
});
