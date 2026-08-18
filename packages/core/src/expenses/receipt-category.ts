/** Heuristik presentasi OCR; tidak mengubah data finansial tanpa pilihan pengguna. */
export function inferExpenseCategoryCode(itemName: string): string {
  const source = itemName.toUpperCase();
  if (
    ["MATERIAL", "BAHAN", "KAYU", "KACA", "CAT", "SEMEN", "BESI"].some((keyword) =>
      source.includes(keyword),
    )
  )
    return "MATERIAL";
  if (["TUKANG", "LABOR", "PEKERJA", "MANDOR", "UPAH"].some((keyword) => source.includes(keyword)))
    return "TUKANG";
  if (
    ["OPERASIONAL", "OPERATIONAL", "BENSIN", "TOLL", "PARKIR", "KIRIM"].some((keyword) =>
      source.includes(keyword),
    )
  )
    return "OPERASIONAL";
  if (source.includes("SUBCON") || source.includes("SUBKON")) return "SUBCON";
  return "LAIN_LAIN";
}
