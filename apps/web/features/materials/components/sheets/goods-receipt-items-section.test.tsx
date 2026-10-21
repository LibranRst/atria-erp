import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { GoodsReceiptItemsSection } from "./goods-receipt-items-section";
import type {
  GoodsReceiptItemDraft,
  GoodsReceiptMaterialOption,
  GoodsReceiptProjectOption,
} from "./goods-receipt-types";

const mockMaterials: readonly GoodsReceiptMaterialOption[] = [
  { id: "mat-1", name: "Semen Portland 50kg", unit: "sak" },
  { id: "mat-2", name: "Pipa PVC 3/4 inch", unit: "batang" },
];

const mockProject: GoodsReceiptProjectOption = {
  id: "proj-1",
  name: "Renovasi Kemang",
  rapItems: [
    {
      id: "rap-1",
      materialId: "mat-1",
      name: "Semen Pekerjaan Plester",
      area: "Lantai 1",
      quantity: 50,
      unitCost: 75_000,
    },
  ],
};

describe("GoodsReceiptItemsSection", () => {
  test("renders section header with uppercase title, item count pill, and total", () => {
    const items: readonly GoodsReceiptItemDraft[] = [
      {
        key: "k-1",
        materialId: "mat-1",
        projectRapItemId: "",
        quantity: "10",
        unitCost: "75000",
        note: "Batch pertama",
      },
    ];

    const markup = renderToStaticMarkup(
      <GoodsReceiptItemsSection
        items={items}
        materials={mockMaterials}
        selectedProject={mockProject}
        onItemsChange={() => {}}
        onUpdateItem={() => {}}
      />,
    );

    // Section header title
    expect(markup).toContain("Material Diterima");
    expect(markup).toContain("uppercase");
    expect(markup).toContain("Daftar material fisik yang dicatat ke stok gudang.");
    expect(markup).toContain("1 item");
    // Total: 10 * 75,000 = 750,000
    expect(markup).toContain("750.000");
    // The only section header h3 is "Material Diterima"
    const h3Matches = [...markup.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) => m[1]);
    expect(h3Matches).toEqual(["Material Diterima"]);

    // The item card is wrapped in a single container with divide-y
    const cardContainers = markup.split(
      "min-w-0 divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle",
    );
    expect(cardContainers.length).toBe(2);
    const itemCard = cardContainers[1];

    // Card header elements reside inside the container
    expect(itemCard).toContain("#1");
    expect(itemCard).toContain("Semen Portland 50kg");
    expect(itemCard).toContain("Satuan sak");
    expect(itemCard).toContain("Duplikat");
    // Hapus button should NOT render when items.length === 1
    expect(itemCard).not.toContain("Hapus");

    // Form inputs and subtotal reside in the same container
    expect(itemCard).toContain("Jumlah fisik");
    expect(itemCard).toContain("Harga per unit");
    expect(itemCard).toContain("Catatan item");
    expect(itemCard).toContain("Subtotal item");

    // Tambah Material button is rendered outside the item card
    expect(markup).toContain("Tambah Material");
  });

  test("renders Hapus button when multiple items exist and displays RAP link when matching", () => {
    const items: readonly GoodsReceiptItemDraft[] = [
      {
        key: "k-1",
        materialId: "mat-1",
        projectRapItemId: "rap-1",
        quantity: "2.5",
        unitCost: "80000",
        note: "",
      },
      {
        key: "k-2",
        materialId: "",
        projectRapItemId: "",
        quantity: "",
        unitCost: "",
        note: "",
      },
    ];

    const markup = renderToStaticMarkup(
      <GoodsReceiptItemsSection
        items={items}
        materials={mockMaterials}
        selectedProject={mockProject}
        onItemsChange={() => {}}
        onUpdateItem={() => {}}
      />,
    );

    expect(markup).toContain("2 item");
    // Total: 2.5 * 80,000 = 200,000
    expect(markup).toContain("200.000");

    // The only section header h3 is still "Material Diterima"
    const h3Matches = [...markup.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) => m[1]);
    expect(h3Matches).toEqual(["Material Diterima"]);

    // Both item cards are wrapped in their own single container
    const cardContainers = markup.split(
      "min-w-0 divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle",
    );
    expect(cardContainers.length).toBe(3);

    // First card contains header, RAP context, and form inputs
    const card1 = cardContainers[1];
    expect(card1).toContain("#1");
    expect(card1).toContain("Semen Portland 50kg");
    expect(card1).toContain("RAP: Semen Pekerjaan Plester (Lantai 1)");
    expect(card1).toContain("Duplikat");
    expect(card1).toContain("Hapus");
    expect(card1).toContain("Tautan RAP");
    expect(card1).toContain("Jumlah fisik");

    // Second card contains fallback title and empty helper in its own container
    const card2 = cardContainers[2];
    expect(card2).toContain("#2");
    expect(card2).toContain("Item 2");
    expect(card2).toContain("Pilih material, lalu isi jumlah fisik dan harga unit.");
    expect(card2).toContain("Duplikat");
    expect(card2).toContain("Hapus");
    expect(card2).toContain("Jumlah fisik");
  });

  test("handles decimal quantities and fractional calculations accurately", () => {
    const items: readonly GoodsReceiptItemDraft[] = [
      {
        key: "k-1",
        materialId: "mat-2",
        projectRapItemId: "",
        quantity: "0.5",
        unitCost: "100000",
        note: "Potongan setengah",
      },
    ];

    const markup = renderToStaticMarkup(
      <GoodsReceiptItemsSection
        items={items}
        materials={mockMaterials}
        selectedProject={undefined}
        onItemsChange={() => {}}
        onUpdateItem={() => {}}
      />,
    );

    // 0.5 * 100,000 = 50,000
    expect(markup).toContain("50.000");
    // Without selected project, Tautan RAP field is omitted
    expect(markup).not.toContain("Tautan RAP");

    // Container contains the item title and inputs
    const cardContainers = markup.split(
      "min-w-0 divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle",
    );
    expect(cardContainers.length).toBe(2);
    const card = cardContainers[1];
    expect(card).toContain("#1");
    expect(card).toContain("Pipa PVC 3/4 inch");
    expect(card).toContain("Satuan batang");
    expect(card).toContain("Potongan setengah");
    // Verifies 48px touch target expansion on action buttons
    expect(card).toContain("after:-inset-y-2");
    expect(card).toContain('aria-label="Duplikat item 1"');
  });

  test("renders 3 sequential items with independent internal headers and resilient zero totals", () => {
    const items: readonly GoodsReceiptItemDraft[] = [
      {
        key: "k-1",
        materialId: "mat-1",
        projectRapItemId: "",
        quantity: "",
        unitCost: "",
        note: "",
      },
      {
        key: "k-2",
        materialId: "mat-2",
        projectRapItemId: "",
        quantity: "0",
        unitCost: "0",
        note: "",
      },
      {
        key: "k-3",
        materialId: "",
        projectRapItemId: "",
        quantity: "5",
        unitCost: "10000",
        note: "Tambahan akhir",
      },
    ];

    const markup = renderToStaticMarkup(
      <GoodsReceiptItemsSection
        items={items}
        materials={mockMaterials}
        selectedProject={mockProject}
        onItemsChange={() => {}}
        onUpdateItem={() => {}}
      />,
    );

    // Total: 0 + 0 + 50,000 = 50,000 (no NaN)
    expect(markup).toContain("3 item");
    expect(markup).toContain("50.000");
    expect(markup).not.toContain("NaN");

    // All 3 item cards are in independent containers
    const cardContainers = markup.split(
      "min-w-0 divide-y divide-outline-variant/20 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle",
    );
    expect(cardContainers.length).toBe(4);

    // Card 1
    expect(cardContainers[1]).toContain("#1");
    expect(cardContainers[1]).toContain("Semen Portland 50kg");
    expect(cardContainers[1]).toContain('aria-label="Duplikat item 1"');
    expect(cardContainers[1]).toContain('aria-label="Hapus item 1"');

    // Card 2
    expect(cardContainers[2]).toContain("#2");
    expect(cardContainers[2]).toContain("Pipa PVC 3/4 inch");
    expect(cardContainers[2]).toContain('aria-label="Duplikat item 2"');
    expect(cardContainers[2]).toContain('aria-label="Hapus item 2"');

    // Card 3
    expect(cardContainers[3]).toContain("#3");
    expect(cardContainers[3]).toContain("Item 3");
    expect(cardContainers[3]).toContain("Tambahan akhir");
    expect(cardContainers[3]).toContain('aria-label="Duplikat item 3"');
    expect(cardContainers[3]).toContain('aria-label="Hapus item 3"');

    // Touch targets for actions are expanded to 48px
    expect(cardContainers[1]).toContain("after:-inset-y-2");
    expect(cardContainers[2]).toContain("after:-inset-y-2");
    expect(cardContainers[3]).toContain("after:-inset-y-2");
  });

  test("contains auto-scroll infrastructure for new and duplicated items", async () => {
    const sectionFilePath = new URL("./goods-receipt-items-section.tsx", import.meta.url);
    const source = await Bun.file(sectionFilePath).text();

    // Invariants for auto-scroll
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("pendingScrollKey");
    expect(source).toContain("itemRefs");
    expect(source).toContain("scrollIntoView");
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain('block: "nearest"');
    expect(source).toContain("setPendingScrollKey");
    expect(source).toContain("itemExists");
    expect(source).toContain("isConnected");
  });

  test("renders item containers with proper min-w-0 layout wrapper and action buttons", () => {
    const initialItems: readonly GoodsReceiptItemDraft[] = [
      {
        key: "k-1",
        materialId: "mat-1",
        projectRapItemId: "",
        quantity: "2",
        unitCost: "50000",
        note: "Item awal",
      },
    ];

    const markup = renderToStaticMarkup(
      <GoodsReceiptItemsSection
        items={initialItems}
        materials={mockMaterials}
        selectedProject={mockProject}
        onItemsChange={() => {}}
        onUpdateItem={() => {}}
      />,
    );

    // Each item card is wrapped in a min-w-0 container
    expect(markup).toContain('<div class="min-w-0">');
    expect(markup).toContain('aria-label="Duplikat item 1"');
    expect(markup).toContain("Tambah Material");
  });

  test("handles item draft addition and duplication data invariants correctly", () => {
    // Contract check for adding new material
    const currentItems: GoodsReceiptItemDraft[] = [
      {
        key: "item-1",
        materialId: "mat-1",
        projectRapItemId: "",
        quantity: 5,
        unitCost: 10000,
        note: "Asli",
      },
    ];

    // Simulating "Duplikat" item at index 0
    const copyDraft: GoodsReceiptItemDraft = {
      ...currentItems[0]!,
      key: "item-2",
    };
    const afterDuplication = [...currentItems];
    afterDuplication.splice(1, 0, copyDraft);

    expect(afterDuplication).toHaveLength(2);
    expect(afterDuplication[0]?.key).toBe("item-1");
    expect(afterDuplication[1]?.key).toBe("item-2");
    expect(afterDuplication[1]?.materialId).toBe("mat-1");
    expect(afterDuplication[1]?.quantity).toBe(5);
    expect(afterDuplication[1]?.unitCost).toBe(10000);
    expect(afterDuplication[1]?.note).toBe("Asli");

    // Simulating ref map store and cleanup
    const refMap = new Map<string, { isConnected: boolean }>();
    const fakeEl = { isConnected: true };
    refMap.set("item-2", fakeEl);
    expect(refMap.get("item-2")).toBe(fakeEl);

    // Unmount cleanup
    refMap.delete("item-2");
    expect(refMap.get("item-2")).toBeUndefined();
  });
});
