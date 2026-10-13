import { expect, test } from "bun:test";
import {
  rabExportInputSchema,
  rabExportTotal,
  rabPageSlices,
  rabPrintableSchema,
} from "./rab-export";
const id = "10000000-0000-4000-8000-000000000001";
test("export input requires an explicit revision and rejects client authority/payload fields", () => {
  expect(rabExportInputSchema.safeParse({ projectId: id, format: "PDF" }).success).toBe(false);
  expect(
    rabExportInputSchema.safeParse({ projectId: id, rabEstimateId: id, userId: id }).success,
  ).toBe(false);
});
test("exact export sum counts visible bundle once and strips unapproved payload fields", () => {
  const line = {
    id,
    clientLabel: "Panel",
    description: null,
    quantity: "1.00",
    unit: "unit",
    unitPrice: "0.10",
    lineTotal: "0.10",
    isHidden: false,
    displayOrder: 0,
  };
  const estimate = rabPrintableSchema.parse({
    id,
    status: "DRAFT",
    revision: 1,
    title: "RAB",
    clientNotes: null,
    approvedValue: "0",
    internalCost: "SECRET",
    bundles: [{ ...line, lineTotal: "0.20" }],
    items: [
      { ...line, bundleId: null, itemNature: "PRODUCTION" },
      { ...line, bundleId: id, itemNature: "PRODUCTION", lineTotal: "90" },
      { ...line, bundleId: null, isHidden: true, lineTotal: "99", itemNature: "PRODUCTION" },
    ],
  });
  expect(rabExportTotal(estimate)).toBe("0.30");
  expect(JSON.stringify(estimate)).not.toContain("SECRET");
});
test("PDF slices cover every pixel exactly once without splitting a normal row", () => {
  const blocks = [
    { top: 990, bottom: 1040 },
    { top: 1980, bottom: 2100 },
  ];
  const pages = rabPageSlices(2310, 1000, blocks);
  expect(pages[0].height).toBe(990);
  expect(pages.reduce((n, p) => n + p.height, 0)).toBe(2310);
  for (let i = 0; i < pages.length; i++) {
    expect(pages[i].height).toBeLessThanOrEqual(1000);
    if (i) expect(pages[i].top).toBe(pages[i - 1].top + pages[i - 1].height);
  }
  for (const block of blocks)
    expect(pages.some((p) => p.top <= block.top && p.top + p.height >= block.bottom)).toBe(true);
  expect(() => rabPageSlices(1, 0, [])).toThrow();
});
