import { describe, expect, test } from "bun:test";

const projectTabsPath = new URL("./project-tabs.tsx", import.meta.url);
const scrollHeightHookPath = new URL(
  "../../../../../lib/hooks/use-preserved-scroll-height.ts",
  import.meta.url,
);

describe("project tab position contract", () => {
  test("delegates reading-position preservation to the shared scroll-height hook", async () => {
    const source = await Bun.file(projectTabsPath).text();

    expect(source).toContain("usePreservedScrollHeight");
    expect(source).not.toContain("behavior:");
  });

  test("restores the reading position without animated document scrolling", async () => {
    const source = await Bun.file(scrollHeightHookPath).text();

    expect(source).toContain('behavior: "auto"');
    expect(source).not.toContain('behavior: "smooth"');
  });
});
