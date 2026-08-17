import { cleanAnswerText } from "@/features/ai-chat/utils/answer-text";
import { describe, expect, it } from "bun:test";

describe("pembersihan penanda Markdown pada jawaban AI", () => {
  it("membuang penebalan dengan dua bintang", () => {
    expect(cleanAnswerText("Proyek **Sudirman Suites** berstatus WARNING.")).toBe(
      "Proyek Sudirman Suites berstatus WARNING.",
    );
  });

  it("membuang penekanan satu bintang dan tiga bintang", () => {
    expect(cleanAnswerText("Ini *penting* dan ***sangat penting***.")).toBe(
      "Ini penting dan sangat penting.",
    );
  });

  it("membuang tanda petik balik di sekitar istilah", () => {
    expect(cleanAnswerText("Kategori `MATERIAL` sudah 92%.")).toBe("Kategori MATERIAL sudah 92%.");
  });

  it("membuang penanda judul di awal baris", () => {
    expect(cleanAnswerText("## Ringkasan\nBudget aman.")).toBe("Ringkasan\nBudget aman.");
  });

  it("mempertahankan tanda hubung penanda daftar", () => {
    const list = "Rinciannya:\n- Material 92%\n- Tukang 55%";
    expect(cleanAnswerText(list)).toBe(list);
  });

  it("tidak merusak perkalian atau bintang yang berdiri sendiri", () => {
    expect(cleanAnswerText("Nilai 3 * 4 tetap utuh.")).toBe("Nilai 3 * 4 tetap utuh.");
  });

  it("membiarkan teks tanpa penanda apa adanya", () => {
    expect(cleanAnswerText("Budget material tersisa Rp 343.000.000.")).toBe(
      "Budget material tersisa Rp 343.000.000.",
    );
  });
});
