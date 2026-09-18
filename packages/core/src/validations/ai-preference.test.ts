import { describe, expect, test } from "bun:test";
import {
  aiPreferenceInputSchema,
  DEFAULT_AI_PREFERENCE,
  getAvailableFocusOptions,
  isPrimaryFocusAllowed,
  sanitizePrimaryFocus,
} from "./ai-preference";
import type { PermissionKey } from "../auth/permissions";

describe("AI preference validation", () => {
  test("menerima seluruh default canonical", () => {
    expect(aiPreferenceInputSchema.parse(DEFAULT_AI_PREFERENCE)).toEqual(DEFAULT_AI_PREFERENCE);
  });

  test("merapikan catatan kosong dan membatasi 300 karakter", () => {
    expect(
      aiPreferenceInputSchema.parse({
        responseStyle: "VERY_CONCISE",
        primaryFocus: "BUDGET_MARGIN",
        customNote: "   ",
      }).customNote,
    ).toBeNull();
    expect(
      aiPreferenceInputSchema.safeParse({
        responseStyle: "DETAILED",
        primaryFocus: "AUTO",
        customNote: "x".repeat(301),
      }).success,
    ).toBe(false);
  });

  test("memfilter dan memverifikasi opsi fokus sesuai hak akses", () => {
    // Role tanpa izin apa pun hanya dapat AUTO
    const canNone = () => false;
    expect(isPrimaryFocusAllowed("AUTO", canNone)).toBe(true);
    expect(isPrimaryFocusAllowed("BUDGET_MARGIN", canNone)).toBe(false);
    expect(isPrimaryFocusAllowed("CASH_BILLS", canNone)).toBe(false);
    expect(getAvailableFocusOptions(canNone).map((opt) => opt.value)).toEqual(["AUTO"]);
    expect(sanitizePrimaryFocus("BUDGET_MARGIN", canNone)).toBe("AUTO");
    expect(sanitizePrimaryFocus("AUTO", canNone)).toBe("AUTO");

    // Owner / Finance (punya view:profitability, view:bank_account, view:approval_queue, dll)
    const canAll = () => true;
    expect(getAvailableFocusOptions(canAll).map((opt) => opt.value)).toEqual([
      "AUTO",
      "BUDGET_MARGIN",
      "CASH_BILLS",
      "MATERIAL_STOCK",
      "ACTIONS_APPROVALS",
    ]);

    // PM (punya view:budget, view:material, view:rap — TIDAK punya view:profitability, view:bank_account, view:approval_queue)
    const pmPermissions = new Set<PermissionKey>(["view:budget", "view:material", "view:rap"]);
    const canPm = (p: PermissionKey) => pmPermissions.has(p);
    expect(getAvailableFocusOptions(canPm).map((opt) => opt.value)).toEqual([
      "AUTO",
      "MATERIAL_STOCK",
    ]);
    expect(sanitizePrimaryFocus("BUDGET_MARGIN", canPm)).toBe("AUTO");
    expect(sanitizePrimaryFocus("CASH_BILLS", canPm)).toBe("AUTO");
    expect(sanitizePrimaryFocus("ACTIONS_APPROVALS", canPm)).toBe("AUTO");
    expect(sanitizePrimaryFocus("MATERIAL_STOCK", canPm)).toBe("MATERIAL_STOCK");

    // Purchasing (punya view:budget, view:material, view:inventory, view:vendor_bill — TIDAK punya view:profitability)
    const purchPermissions = new Set<PermissionKey>([
      "view:budget",
      "view:material",
      "view:inventory",
      "view:vendor_bill",
    ]);
    const canPurch = (p: PermissionKey) => purchPermissions.has(p);
    expect(getAvailableFocusOptions(canPurch).map((opt) => opt.value)).toEqual([
      "AUTO",
      "MATERIAL_STOCK",
    ]);
    expect(sanitizePrimaryFocus("BUDGET_MARGIN", canPurch)).toBe("AUTO");
    expect(sanitizePrimaryFocus("CASH_BILLS", canPurch)).toBe("AUTO");
    expect(sanitizePrimaryFocus("ACTIONS_APPROVALS", canPurch)).toBe("AUTO");
    expect(sanitizePrimaryFocus("MATERIAL_STOCK", canPurch)).toBe("MATERIAL_STOCK");
  });
});
