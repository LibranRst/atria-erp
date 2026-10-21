import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ActionMenu, ContextPopover, MAX_ACTION_MENU_ITEMS, Tooltip } from "./anchored-surfaces";
import { DesktopButton } from "../desktop/desktop-controls";

const sourcePath = new URL("./anchored-surfaces.tsx", import.meta.url);
const listboxPath = new URL("./anchored-listbox.tsx", import.meta.url);

describe("anchored interaction surfaces", () => {
  test("owns trigger identity above the native or composed control's hook tree", () => {
    const items = [{ id: "edit", label: "Ubah", onSelect: (): void => undefined }];
    const native = renderToStaticMarkup(
      <ActionMenu label="Aksi" trigger={<button>Buka</button>} items={items} />,
    );
    const desktop = renderToStaticMarkup(
      <ActionMenu label="Aksi" trigger={<DesktopButton>Buka</DesktopButton>} items={items} />,
    );
    const nativeId = native.match(/<button[^>]*id="([^"]+)"/)?.[1];
    const desktopId = desktop.match(/<button[^>]*id="([^"]+)"/)?.[1];
    expect(nativeId).toStartWith("anchored-trigger-");
    expect(desktopId).toBe(nativeId);
    expect(desktop).toContain('aria-haspopup="menu"');
    expect(desktop.match(/tabindex="0"/g)?.length).toBe(1);
  });

  test("preserves a caller-owned trigger id for menu labelling", () => {
    const html = renderToStaticMarkup(
      <ActionMenu
        label="Aksi"
        trigger={<DesktopButton id="project-menu">Buka</DesktopButton>}
        items={[]}
      />,
    );
    expect(html).toContain('id="project-menu"');
    expect(html).not.toContain("anchored-trigger-");
  });
  test("keeps action menus and contextual disclosures semantically distinct", () => {
    const menu = renderToStaticMarkup(
      <ActionMenu
        label="Aksi percakapan"
        trigger={<button type="button">Buka aksi</button>}
        items={[{ id: "rename", label: "Ganti judul", onSelect: () => undefined }]}
      />,
    );
    const popover = renderToStaticMarkup(
      <ContextPopover label="Ringkasan" trigger={<button type="button">Lihat</button>}>
        Isi ringkas
      </ContextPopover>,
    );

    expect(menu).toContain('aria-haspopup="menu"');
    expect(menu).toContain('aria-expanded="false"');
    expect(popover).toContain('aria-haspopup="dialog"');
    expect(menu).not.toContain('aria-haspopup="dialog"');
  });

  test("leaves tooltip triggers untouched during server rendering", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Tutup">
        <button type="button" aria-label="Tutup">
          ×
        </button>
      </Tooltip>,
    );

    expect(html).toContain('aria-label="Tutup"');
    expect(html).not.toContain("title=");
    expect(html).not.toContain('role="tooltip"');
  });

  test("rejects action lists that exceed the compact menu contract", () => {
    const items = Array.from({ length: MAX_ACTION_MENU_ITEMS + 1 }, (_, index) => ({
      id: String(index),
      label: `Aksi ${index + 1}`,
      onSelect: () => undefined,
    }));

    expect(() =>
      renderToStaticMarkup(
        <ActionMenu label="Aksi" trigger={<button type="button">Buka</button>} items={items} />,
      ),
    ).toThrow(`ActionMenu menerima maksimal ${MAX_ACTION_MENU_ITEMS} tindakan.`);
  });

  test("supports touch-enabled tooltips while leaving trigger safe during server rendering", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Rp 150.000.000" touch>
        <span aria-label="Rp 150.000.000">Rp 150 jt</span>
      </Tooltip>,
    );

    expect(html).toContain('aria-label="Rp 150.000.000"');
    expect(html).toContain("Rp 150 jt");
    expect(html).not.toContain('role="tooltip"');
  });

  test("centralizes collision, keyboard, typeahead, and delayed-action behavior", async () => {
    const source = await Bun.file(sourcePath).text();
    const listbox = await Bun.file(listboxPath).text();

    for (const contract of ["flip(", "shift(", "size({", "useDismiss", "useListNavigation"])
      expect(source + listbox).toContain(contract);

    expect(source).toContain("useTypeahead");
    expect(listbox).toContain("useTypeahead");
    expect(source).toContain("onExitComplete");
    expect(source).toContain("pendingAction.current");
    expect(source).toContain("mouseOnly: true");
    expect(source).toContain("visibleOnly: true");
    expect(source).toContain("ignoreMouse: true");
    expect(source).toContain("transitionSpringSnappy");
  });
});
