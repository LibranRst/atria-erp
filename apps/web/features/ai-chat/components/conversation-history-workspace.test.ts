import { describe, expect, test } from "bun:test";

const sourcePath = new URL("./conversation-history-workspace.tsx", import.meta.url);

describe("conversation history contextual actions", () => {
  test("opens lightweight row actions before protected rename and delete surfaces", async () => {
    const source = await Bun.file(sourcePath).text();

    expect(source).toContain("<ActionMenu");
    expect(source).toContain('label: "Ganti judul…"');
    expect(source).toContain('label: "Hapus percakapan…"');
    expect(source).toContain('tone: "critical"');
    expect(source).toContain("<CompactFormDialog");
    expect(source).toContain('title="Ganti judul"');
    expect(source).toContain("<ConfirmationDialog");
    expect(source).not.toContain('title={renameMode ? "Ganti judul" : "Aksi percakapan"}');
  });
});
