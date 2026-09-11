import { describe, expect, test } from "bun:test";

const drawerPath = new URL("./rap-detail-drawers.tsx", import.meta.url);

describe("rap-detail-drawers button styling", () => {
  test("uses canonical Button and AppIcon from shared UI with proper design system variants", async () => {
    const source = await Bun.file(drawerPath).text();

    // Imports canonical Button and AppIcon
    expect(source).toContain("AppIcon,");
    expect(source).toContain("Button,");

    // RapItemDetailDrawer: Edit Material uses variant="primary" and AppIcon edit
    expect(source).toContain('variant="primary"');
    expect(source).toContain('leadingIcon={<AppIcon name="edit" className="icon-sm" />}');
    expect(source).toContain("Edit Material");

    // RapItemDetailDrawer: Hapus uses variant="criticalQuiet" and AppIcon delete
    expect(source).toContain('variant="criticalQuiet"');
    expect(source).toContain('leadingIcon={<AppIcon name="delete" className="icon-sm" />}');
    expect(source).toContain("Hapus");

    // PackageDetailDrawer: Uses canonical Button variants
    expect(source).toContain('variant="secondary"');
    expect(source).toContain('leadingIcon={<AppIcon name="check" className="icon-sm" />}');
    expect(source).toContain("Tandai Siap");
    expect(source).toContain("Hapus Paket");

    // Must NOT contain washed-out legacy unstyled button classes
    expect(source).not.toContain("bg-surface-container text-xs");
    expect(source).not.toContain("bg-error-container/25");
  });
});
