import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { setupInputSchema } from "@atria/core/ai/rap-finalization";
import { compatibleToolSchema, providerTools } from "./tool-schema-compatibility";
import { tool } from "ai";

const projectId = "11111111-1111-4111-8111-111111111111";
describe("gateway model-facing tool object unions", () => {
  test("all nested RAP action fields and discriminator choices are visible on one object", async () => {
    const schema = await compatibleToolSchema(setupInputSchema).jsonSchema;
    expect(JSON.stringify(schema)).not.toContain('"oneOf"');
    expect(JSON.stringify(schema)).toContain('"targetStage"');
    expect(JSON.stringify(schema)).toContain('"skipped"');
    expect(JSON.stringify(schema)).toContain(
      '"enum":["READY_PACKAGES","SET_SCOPE","ADVANCE","FINALIZE"]',
    );
  });
  test("original branch validation still rejects missing fields, extra keys and refinement failures", async () => {
    const schema = compatibleToolSchema(setupInputSchema);
    for (const steps of [
      [{ action: "SET_SCOPE" }],
      [{ action: "ADVANCE", itemIds: [] }],
      [{ action: "FINALIZE", skipped: true }],
      [{ action: "READY_PACKAGES", itemIds: [projectId, projectId] }],
    ])
      expect((await schema.validate?.({ projectId, steps }))?.success).toBe(false);
    expect(
      (
        await schema.validate?.({
          projectId,
          steps: [
            { action: "SET_SCOPE", category: "TUKANG", skipped: true },
            { action: "ADVANCE", targetStage: "TUKANG" },
            { action: "FINALIZE" },
          ],
        })
      )?.success,
    ).toBe(true);
  });
  test("root operation unions expose later fields without weakening original execution checks", async () => {
    const canonical = z.discriminatedUnion("action", [
      z.object({ action: z.literal("SCHEDULE"), amount: z.number().positive() }).strict(),
      z
        .object({ action: z.literal("PAY"), reference: z.string().min(3), bankId: z.guid() })
        .strict(),
    ]);
    const schema = compatibleToolSchema(canonical);
    const json = await schema.jsonSchema;
    expect(json.properties?.reference).toBeDefined();
    expect(json.properties?.bankId).toBeDefined();
    expect(json.required).toEqual(["action"]);
    expect(
      (await schema.validate?.({ action: "PAY", reference: "QA", bankId: projectId }))?.success,
    ).toBe(false);
    expect(
      (await schema.validate?.({ action: "PAY", reference: "QA-1", bankId: projectId }))?.success,
    ).toBe(true);
  });
  test("other providers retain their original tool object and schema", () => {
    const tools = {
      sample: tool({
        inputSchema: z.object({ name: z.string() }),
        execute: async (input) => input.name,
      }),
    };
    expect(providerTools(tools, "GEMINI")).toBe(tools);
    expect(providerTools(tools, "OPENROUTER")).toBe(tools);
  });
  test("numeric discriminators and original defaults/transforms retain their type and value", async () => {
    const canonical = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal(1), enabled: z.boolean().default(true) }).strict(),
      z.object({ kind: z.literal(2), name: z.string().trim() }).strict(),
    ]);
    const schema = compatibleToolSchema(canonical),
      json = await schema.jsonSchema;
    expect(json.properties?.kind).toEqual({ enum: [1, 2], type: "number" });
    expect(await schema.validate?.({ kind: 1 })).toEqual({
      success: true,
      value: { kind: 1, enabled: true },
    });
    expect(await schema.validate?.({ kind: 2, name: "  QA  " })).toEqual({
      success: true,
      value: { kind: 2, name: "QA" },
    });
    expect((await schema.validate?.({ kind: 2, name: "QA", enabled: true }))?.success).toBe(false);
  });
});
