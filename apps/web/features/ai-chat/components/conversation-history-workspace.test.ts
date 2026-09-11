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

  test("uses FormSection, SegmentedTabs, OptionChoiceGroup, and FormField for assistant preferences", async () => {
    const source = await Bun.file(sourcePath).text();

    expect(source).toContain("<OperationalFormSheet");
    expect(source).toContain('title="Preferensi asisten"');
    expect(source).toContain('<FormSection title="Gaya jawaban"');
    expect(source).toContain("<SegmentedTabs");
    expect(source).toContain("options={STYLE_OPTIONS}");
    expect(source).toContain("<OptionChoiceGroup");
    expect(source).toContain('label="Fokus utama"');
    expect(source).toContain("options={FOCUS_OPTIONS}");
    expect(source).toContain("<FormField");
    expect(source).toContain('label="Catatan personal"');
    expect(source).not.toContain('<fieldset className="space-y-2">');
  });
});
