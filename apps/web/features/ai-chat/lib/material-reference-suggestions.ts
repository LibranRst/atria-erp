import {
  normalizeMaterialIdentity,
  type MaterialDraftView,
  type MaterialReference,
} from "@atria/core/ai/material-import";

export function materialReferenceSuggestions(draft: MaterialDraftView | null): MaterialReference[] {
  const suggestions: MaterialReference[] = [];
  if (!draft) return suggestions;
  const seen = new Set<string>();
  for (const row of draft.payload.rows) {
    if (row.materialId) continue;
    for (const kind of ["category", "location", "vendor"] as const) {
      const name =
        row.fields[
          kind === "category" ? "categoryName" : kind === "location" ? "locationName" : "vendorName"
        ];
      const registered =
        draft.options[
          kind === "category" ? "categories" : kind === "location" ? "locations" : "vendors"
        ];
      const key = `${kind}:${normalizeMaterialIdentity(name)}`;
      if (
        !name.trim() ||
        seen.has(key) ||
        (kind === "vendor" && (row.fields.withoutVendor || !draft.canCreateVendor)) ||
        registered.some(
          (value) => normalizeMaterialIdentity(value) === normalizeMaterialIdentity(name),
        )
      )
        continue;
      seen.add(key);
      suggestions.push({ kind, name, phone: "" });
    }
  }
  return suggestions;
}
