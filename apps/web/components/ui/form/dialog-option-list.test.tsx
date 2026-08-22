import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DialogOptionList } from "./dialog-option-list";

const sourcePath = new URL("./dialog-option-list.tsx", import.meta.url);

describe("DialogOptionList", () => {
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
