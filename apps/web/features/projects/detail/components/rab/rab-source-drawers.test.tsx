import { describe, expect, test } from "bun:test";

const sourceDrawersPath = new URL("./rab-source-drawers.tsx", import.meta.url);

describe("rab-source-drawers preview configuration", () => {
  test("inherits grouped presentation default for MoneyInput in manual item section", async () => {
    const source = await Bun.file(sourceDrawersPath).text();

    // In grouped presentation, MoneyInput inherits default showPreview=false without manual override
    expect(source).not.toContain("showPreview={false}");
    expect(source).not.toContain("showPreview\n");
    expect(source).toContain("<FormField label=\"Harga satuan klien\">");
  });
});
