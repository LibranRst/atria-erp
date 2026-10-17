import { describe, expect, test } from "bun:test";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { getRapPermissions } from "./rap-manager-utils";
import { emptyManualQuotationLine, getRabManagerDerivedValues } from "./rab-manager-utils";

function rabRights(permissions: readonly PermissionKey[]): {
  readonly create: boolean;
  readonly edit: boolean;
  readonly approve: boolean;
} {
  const rights = getRabManagerDerivedValues({
    permissions,
    rabEstimate: null,
    revisionHistory: [],
    selectedRapQuotationIds: [],
    selectedCategoryQuotationIds: [],
    manualQuotationLine: emptyManualQuotationLine,
  });
  return { create: rights.canCreateRab, edit: rights.canManageRab, approve: rights.canApproveRab };
}

describe("project planning controls follow existing writer permissions", () => {
  test("RAB creation, editing and approval are independent capabilities", () => {
    expect(rabRights(["create:rab"])).toEqual({ create: true, edit: false, approve: false });
    expect(rabRights(["update:rab"])).toEqual({ create: false, edit: true, approve: false });
    expect(rabRights(["approve:rab"])).toEqual({ create: false, edit: false, approve: true });
    expect(rabRights(["view:rab"])).toEqual({ create: false, edit: false, approve: false });
  });
  test("RAP and package controls retain their distinct domain rights", () => {
    expect(getRapPermissions(["create:rap"])).toEqual({
      canCreateRap: true,
      canEditRap: false,
      canEditCategoryPlan: false,
      canFinalizeRap: false,
    });
    expect(getRapPermissions(["update:rap"])).toEqual({
      canCreateRap: false,
      canEditRap: true,
      canEditCategoryPlan: false,
      canFinalizeRap: false,
    });
    expect(getRapPermissions(["update:budget"])).toEqual({
      canCreateRap: false,
      canEditRap: false,
      canEditCategoryPlan: true,
      canFinalizeRap: false,
    });
    expect(getRapPermissions(["lock:rap"])).toEqual({
      canCreateRap: false,
      canEditRap: false,
      canEditCategoryPlan: false,
      canFinalizeRap: true,
    });
  });
});
