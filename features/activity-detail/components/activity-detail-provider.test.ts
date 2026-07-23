import { describe, expect, test } from "bun:test";

const providerPath = new URL("./activity-detail-provider.tsx", import.meta.url);

describe("activity detail UI contract", () => {
  test("uses the canonical sheet with structural states and grouped facts", async () => {
    const source = await Bun.file(providerPath).text();
    expect(source).toContain("<BottomSheet");
    expect(source).toContain("DetailSkeleton");
    expect(source).toContain("Coba lagi");
    expect(source).toContain("Rincian transaksi");
    expect(source).toContain("Dampak bisnis");
    expect(source).toContain(
      "Riwayat lama belum menyimpan semua perubahan. Hanya data yang tersedia yang ditampilkan.",
    );
    expect(source).toContain("MoneyValue");
    expect(source).toContain("isActivityDetailSourceRepresentedInCurrentContext");
    expect(source).toContain("useSearchParams");
    expect(source).not.toContain("originalState");
    expect(source).not.toContain("newState");
  });
});
