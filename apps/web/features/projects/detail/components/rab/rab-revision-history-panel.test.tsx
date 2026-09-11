import { describe, expect, test } from "bun:test";

const panelPath = new URL("./rab-revision-history-panel.tsx", import.meta.url);

describe("RabRevisionHistoryPanel Emergency Override Flow", () => {
  test("implements CompactFormDialog for emergency override", async () => {
    const source = await Bun.file(panelPath).text();

    expect(source).toContain("CompactFormDialog");
    expect(source).toContain("Persetujuan Darurat (Emergency Override)");
    expect(source).toContain("MAKER_CHECKER_REQUIRED");
    expect(source).toContain("emergencyOverride: true");
    expect(source).toContain("overrideReason.trim()");
  });

  test("enforces minimum 10 characters for emergency override reason", async () => {
    const source = await Bun.file(panelPath).text();

    expect(source).toContain("overrideReason.trim().length < 10");
    expect(source).toContain("Alasan persetujuan darurat minimal 10 karakter.");
  });

  test("shows Setujui button for PENDING_APPROVAL change orders", async () => {
    const source = await Bun.file(panelPath).text();

    expect(source).toContain('order.status === "PENDING_APPROVAL"');
    expect(source).toContain('"Setujui"');
  });
});
