import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DialogOptionList } from "./dialog-option-list";

const sourcePath = new URL("./dialog-option-list.tsx", import.meta.url);
const controlsPath = new URL("./select-form-controls.tsx", import.meta.url);
const composerPath = new URL(
  "../../../features/ai-chat/components/morphed-input-composer.tsx",
  import.meta.url,
);

describe("DialogOptionList", () => {
  test("search filtering preserves the list instance instead of keying it by query", async () => {
    const [list, controls, composer] = await Promise.all([
      Bun.file(sourcePath).text(),
      Bun.file(controlsPath).text(),
      Bun.file(composerPath).text(),
    ]);

    expect(list).toContain("animateHeight");
    expect(list).toContain("new ResizeObserver(measure)");
    expect(list).toContain("{ height: measuredHeight }");
    expect(list).toContain("<motion.div");
    expect(controls).not.toContain('key={searchable ? query : "selection"}');
    expect(controls).not.toContain("key={query}");
    expect(composer).not.toContain("key={selectSearchQuery}");
  });

  test("exposes selected and blocked options without hiding the reason", () => {
    const html = renderToStaticMarkup(
      <DialogOptionList
        label="Proyek"
        value="active"
        emptyText="Tidak ada opsi"
        options={[
          { value: "active", label: "Aktif" },
          {
            value: "blocked",
            label: "Terkunci",
            disabled: true,
            disabledReason: "Budget belum disetujui.",
          },
        ]}
        onSelect={() => undefined}
      />,
    );

    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Budget belum disetujui.");
    expect(html).not.toContain("data-dialog-autofocus");
  });

  test("supports arrow, boundary, typeahead, Enter, and Space keyboard paths", async () => {
    const source = await Bun.file(sourcePath).text();

    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      expect(source).toContain(`event.key === "${key}"`);
    }
    expect(source).toContain('event.key !== "Enter"');
    expect(source).toContain('event.key !== " "');
    expect(source).toContain("typeahead.current");
    expect(source).toContain("event.stopPropagation()");
  });
});
