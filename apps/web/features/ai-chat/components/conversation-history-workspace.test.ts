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

  test("uses FormSection, SegmentedTabs, ChoiceRow radio group, and grouped personal note for assistant preferences", async () => {
    const source = await Bun.file(sourcePath).text();

    expect(source).toContain("<OperationalFormSheet");
    expect(source).toContain('title="Preferensi asisten"');
    expect(source).toContain('<FormSection title="Gaya jawaban"');
    expect(source).toContain("<SegmentedTabs");
    expect(source).toContain("options={STYLE_OPTIONS}");
    expect(source).toContain('<FormSection title="Fokus utama" presentation="grouped"');
    expect(source).toContain('role="radiogroup"');
    expect(source).toContain("<ChoiceRow");
    expect(source).toContain('selectionMode="radio"');
    expect(source).not.toContain("<OptionChoiceGroup");
    expect(source).toContain('<FormSection title="Catatan personal" presentation="grouped"');
    expect(source).toContain("customNoteLength}/300");
    expect(source).toContain("useCan");
  });
});
