import { describe, expect, test } from "bun:test";
import { asSchema, tool } from "ai";
import { z } from "zod";
import {
  IntroductionArgumentReader,
  introductionTools,
  readSafeIntroduction,
} from "./chat-introduction";

describe("model-authored public introduction", () => {
  test("waits for a closed escaped JSON string and emits once across tools", (): void => {
    const reader = new IntroductionArgumentReader();
    expect(reader.add("first", '{"_introduction":"Aku akan meninjau \\')).toBeNull();
    expect(reader.add("first", '"material\\" dulu.')).toBeNull();
    expect(reader.add("first", '","projectQuery":"QA"}')).toBe(
      'Aku akan meninjau "material" dulu.',
    );
    expect(
      reader.add("second", '{"_introduction":"Aku akan membaca rincian proyek dulu."}'),
    ).toBeNull();
  });

  test("does not repair partial JSON or emit unsafe/result text", (): void => {
    for (const value of [
      "",
      "Aku akan cek saldo Rp 10.000.",
      "Aku akan memberi tahu bahwa pembayaran sudah berhasil.",
      "Aku akan langsung membayar tagihan vendor.",
      "Aku akan membaca data.\nHasilnya tersedia.",
      `Aku akan ${"meninjau ".repeat(40)}`,
      "Saldo sekarang tersedia.",
      "Aku akan <script>membaca</script>.",
    ]) {
      expect(readSafeIntroduction(value)).toBeNull();
      const reader = new IntroductionArgumentReader();
      expect(reader.add("call", JSON.stringify({ _introduction: value }))).toBeNull();
    }
    const reader = new IntroductionArgumentReader();
    expect(reader.add("call", '{"_introduction":"Aku akan membaca data dulu.')).toBeNull();
    expect(reader.add("oversized", " ".repeat(2_049))).toBeNull();
    expect(reader.add("oversized", '{"_introduction":"Aku akan membaca data dulu."}')).toBeNull();
  });

  test("reads a reordered closed root field but ignores nested or quoted copies", (): void => {
    const reader = new IntroductionArgumentReader();
    expect(
      reader.add(
        "nested",
        JSON.stringify({
          payload: { _introduction: "Aku akan menampilkan nilai tersembunyi." },
          query: '"_introduction": "Aku akan menampilkan teks kutipan."',
        }),
      ),
    ).toBeNull();
    const reordered = JSON.stringify({
      query: "Proyek QA",
      filters: { values: [1, { name: 'Q"A' }] },
      _introduction: "Aku akan mencari proyek yang sesuai.",
    });
    const splitAt = reordered.indexOf(" proyek yang");
    expect(reader.add("reordered", reordered.slice(0, splitAt))).toBeNull();
    expect(reader.add("reordered", reordered.slice(splitAt))).toBe(
      "Aku akan mencari proyek yang sesuai.",
    );
  });

  test("only first-step provider schema includes metadata; original strict validation remains", async (): Promise<void> => {
    let initial = true;
    const original = tool({
      inputSchema: z.object({ projectQuery: z.string().trim().min(1) }).strict(),
      execute: async (input): Promise<string> => input.projectQuery,
    });
    const tools = introductionTools({ getProject: original }, () => initial);
    const schema = asSchema(tools.getProject.inputSchema);
    const first = await schema.jsonSchema;
    expect(Object.keys(first.properties ?? {})).toEqual(["_introduction", "projectQuery"]);
    expect(first.required).toEqual(["_introduction", "projectQuery"]);
    expect(
      await schema.validate?.({
        _introduction: "Aku akan membaca proyek pilihanmu dulu.",
        projectQuery: " QA ",
      }),
    ).toEqual({ success: true, value: { projectQuery: "QA" } });
    expect(
      (await schema.validate?.({ _introduction: "anything", projectQuery: "" }))?.success,
    ).toBe(false);
    expect(
      (await schema.validate?.({ _introduction: "anything", projectQuery: "QA", extra: true }))
        ?.success,
    ).toBe(false);
    // A provider may omit presentation metadata: this must not reject safe business input.
    expect(await schema.validate?.({ projectQuery: "QA" })).toEqual({
      success: true,
      value: { projectQuery: "QA" },
    });
    expect(tools.getProject.execute).toBe(original.execute);
    expect(tools.getProject.onInputAvailable).toBe(original.onInputAvailable);
    initial = false;
    const next = await schema.jsonSchema;
    expect(next.properties).not.toHaveProperty("_introduction");
    expect(next.required).toEqual(["projectQuery"]);
  });

  test("metadata joins root union branches without changing original discriminated validation", async (): Promise<void> => {
    const tools = introductionTools(
      {
        read: tool({
          inputSchema: z.discriminatedUnion("kind", [
            z.object({ kind: z.literal("project"), name: z.string() }).strict(),
            z.object({ kind: z.literal("account"), id: z.string() }).strict(),
          ]),
          execute: async (input): Promise<string> => input.kind,
        }),
      },
      () => true,
    );
    const schema = asSchema(tools.read.inputSchema);
    const definition = await schema.jsonSchema;
    const branches = definition.oneOf ?? definition.anyOf ?? [];
    expect(branches.length).toBe(2);
    for (const branch of branches) {
      expect(typeof branch).toBe("object");
      if (typeof branch === "object") expect(branch.required?.[0]).toBe("_introduction");
    }
    expect(
      await schema.validate?.({
        _introduction: "Aku akan membaca proyek dulu.",
        kind: "project",
        name: "QA",
      }),
    ).toEqual({ success: true, value: { kind: "project", name: "QA" } });
    expect((await schema.validate?.({ kind: "account", name: "QA" }))?.success).toBe(false);
  });
});
