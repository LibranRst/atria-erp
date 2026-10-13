import { expect, test } from "bun:test";
import { quickStartInputSchema, quickStartIdentitySchema } from "./quick-start";
const id = "00000000-0000-0000-0000-000000000001";
test("setup inputs require actual stage, explicit stock decision and a complete unambiguous first project", () => {
  expect(quickStartInputSchema.safeParse({ action: "ADVANCE", stepId: "success" }).success).toBe(
    false,
  );
  expect(quickStartInputSchema.safeParse({ action: "STOCK_DECISION" }).success).toBe(false);
  const project = {
    name: "Proyek",
    clientId: id,
    totalContractValue: 1000.25,
    approvedRabValue: 900.5,
  };
  expect(quickStartInputSchema.safeParse({ action: "CREATE_PROJECT", project }).success).toBe(true);
  for (const changes of [
    { newClientName: "Klien" },
    { approvedRabValue: undefined },
    { totalContractValue: 1.234 },
    { budgetCapRatio: 0.85 },
  ])
    expect(
      quickStartInputSchema.safeParse({
        action: "CREATE_PROJECT",
        project: { ...project, ...changes },
      }).success,
    ).toBe(false);
  expect(
    quickStartInputSchema.safeParse({ action: "PAUSE", stepId: "welcome", userId: id }).success,
  ).toBe(false);
});
test("confirmation accepts stored identity only", () => {
  expect(
    quickStartIdentitySchema.safeParse({ conversationId: id, toolCallId: "call" }).success,
  ).toBe(true);
  expect(
    quickStartIdentitySchema.safeParse({
      conversationId: id,
      toolCallId: "call",
      decision: "NO_LEGACY_STOCK",
    }).success,
  ).toBe(false);
});
