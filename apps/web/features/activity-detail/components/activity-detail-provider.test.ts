import { describe, expect, test } from "bun:test";

const providerPath = new URL("./activity-detail-provider.tsx", import.meta.url);
const sheetPath = new URL("./activity-detail-sheet.tsx", import.meta.url);

describe("activity detail UI contract", () => {
  test("uses the canonical sheet with structural states and grouped facts", async () => {
    const providerSource = await Bun.file(providerPath).text();
    const sheetSource = await Bun.file(sheetPath).text();
    const combinedSource = `${providerSource}\n${sheetSource}`;

    expect(combinedSource).toContain("<DetailSheet");
    expect(combinedSource).toContain("<SheetFooterActions");
    expect(combinedSource).toContain('state.status === "success" && actions');
    expect(combinedSource).toContain("<ActivityDetailStatusFooter");
    expect(combinedSource).toContain('role="status"');
    expect(combinedSource).toContain("pendingActionRef");
    expect(combinedSource).toContain("finishSheetExit");
    expect(combinedSource).toContain("DetailSkeleton");
    expect(combinedSource).toContain("Coba lagi");
    expect(combinedSource).toContain("Rincian transaksi");
    expect(combinedSource).toContain("Dampak bisnis");
    expect(combinedSource).toContain(
      "Riwayat lama belum menyimpan semua perubahan. Hanya data yang tersedia yang ditampilkan.",
    );
    expect(combinedSource).toContain("MoneyValue");
    expect(combinedSource).toContain("useSheetPresenceValue");
    expect(combinedSource).toContain("open={open}");
    expect(combinedSource).toContain("active = false");
    expect(combinedSource).toContain('name="refresh"');
    expect(combinedSource).toContain("isActivityDetailSourceRepresentedInCurrentContext");
    expect(combinedSource).toContain("useSearchParams");
    expect(combinedSource).not.toContain('from "lucide-react"');
    expect(combinedSource).not.toContain("originalState");
    expect(combinedSource).not.toContain("newState");
  });
});
