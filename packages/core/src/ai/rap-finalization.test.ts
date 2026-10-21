import { describe, expect, test } from "bun:test";
import {
  setupInputSchema,
  setupIdentitySchema,
  simulateSetupStep,
  setupReadiness,
  setupStepPermission,
  type SetupState,
  type SetupStep,
} from "./rap-finalization";
const id = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002";
const snapshot = {
  name: "Paket pekerjaan",
  scopeDescription: null,
  area: "Utama",
  quantity: 1,
  unit: "ls",
  estimatedUnitCost: 100,
  estimatedTotalCost: 100,
  vendorId: null,
  vendorName: null,
  sourceLibraryItemId: null,
  internalNote: null,
};
function state(): SetupState {
  return {
    status: "DRAFT",
    stage: "MATERIAL",
    materialCount: 1,
    tukangSkipped: false,
    subconSkipped: false,
    packages: [
      { id, category: "TUKANG", status: "DRAFT", snapshot },
      { id: other, category: "SUBCON", status: "DRAFT", snapshot },
    ],
  };
}
const steps: SetupStep[] = [
  { action: "READY_PACKAGES", itemIds: [id, other] },
  { action: "ADVANCE", targetStage: "TUKANG" },
  { action: "ADVANCE", targetStage: "SUBCON" },
  { action: "ADVANCE", targetStage: "REVIEW" },
  { action: "FINALIZE" },
];
describe("RAP readiness simulation", () => {
  test("simulates explicit full workflow without mutating original facts", () => {
    const before = state();
    let after = before;
    const rights = steps.map((step) => {
      const permission = setupStepPermission(step, after);
      after = simulateSetupStep(after, step);
      return permission;
    });
    expect(after).toMatchObject({ status: "LOCKED", stage: "COMPLETE" });
    expect(after.packages.map((p) => p.status)).toEqual(["ACTIVE", "ACTIVE"]);
    expect(before.packages.every((p) => p.status === "DRAFT")).toBe(true);
    expect(rights).toEqual([
      "update:budget",
      "update:rap",
      "update:budget",
      "update:budget",
      "lock:rap",
    ]);
  });
  test("rejects missing material, unresolved packages, invalid stage order and locked plans", () => {
    expect(() =>
      simulateSetupStep(
        { ...state(), materialCount: 0 },
        { action: "ADVANCE", targetStage: "TUKANG" },
      ),
    ).toThrow();
    expect(() =>
      simulateSetupStep(state(), { action: "ADVANCE", targetStage: "REVIEW" }),
    ).toThrow();
    expect(() =>
      simulateSetupStep({ ...state(), stage: "REVIEW" }, { action: "FINALIZE" }),
    ).toThrow();
    expect(() =>
      simulateSetupStep(
        { ...state(), status: "LOCKED", stage: "COMPLETE" },
        { action: "SET_SCOPE", category: "SUBCON", skipped: true },
      ),
    ).toThrow();
  });
  test("requires explicit unused scope and refuses contradictory or no-op decisions", () => {
    let s: SetupState = { ...state(), packages: [] };
    expect(setupReadiness(s)).toMatchObject({ material: true, tukang: false, subcon: false });
    s = simulateSetupStep(s, { action: "SET_SCOPE", category: "TUKANG", skipped: true });
    s = simulateSetupStep(s, { action: "SET_SCOPE", category: "SUBCON", skipped: true });
    expect(setupReadiness(s).blockers).toEqual([]);
    expect(() =>
      simulateSetupStep(state(), { action: "SET_SCOPE", category: "TUKANG", skipped: true }),
    ).toThrow();
    expect(() =>
      simulateSetupStep(s, { action: "SET_SCOPE", category: "TUKANG", skipped: true }),
    ).toThrow();
    expect(() =>
      simulateSetupStep(
        { ...state(), tukangSkipped: true },
        { action: "READY_PACKAGES", itemIds: [id] },
      ),
    ).toThrow();
  });
  test("strict identity and batch bounds prevent duplicate package decisions or hidden extra writes", () => {
    expect(setupInputSchema.safeParse({ projectId: id, steps }).success).toBe(true);
    expect(
      setupInputSchema.safeParse({
        projectId: id,
        steps: [{ action: "FINALIZE" }, { action: "SET_SCOPE", category: "TUKANG", skipped: true }],
      }).success,
    ).toBe(false);
    expect(
      setupInputSchema.safeParse({
        projectId: id,
        steps: [
          { action: "READY_PACKAGES", itemIds: [id] },
          { action: "READY_PACKAGES", itemIds: [id] },
        ],
      }).success,
    ).toBe(false);
    expect(
      setupInputSchema.safeParse({
        projectId: id,
        steps: Array.from({ length: 51 }, () => ({
          action: "SET_SCOPE",
          category: "TUKANG",
          skipped: true,
        })),
      }).success,
    ).toBe(false);
    expect(
      setupIdentitySchema.safeParse({ conversationId: id, toolCallId: "confirm", steps }).success,
    ).toBe(false);
  });
});
