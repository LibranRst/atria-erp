"use client";
import * as React from "react";
import { ChoiceRow, FormSection, FormField, TextInput } from "@/components/ui";
import { referenceReviewKey, type ReferenceReviewEntry } from "../../lib/material-reference-review";

export function MaterialReferenceReview({
  entries,
  pending,
  onChange,
}: {
  readonly entries: readonly ReferenceReviewEntry[];
  readonly pending: boolean;
  readonly onChange: (entries: ReferenceReviewEntry[]) => void;
}): React.JSX.Element {
  function patch(index: number, changes: Partial<ReferenceReviewEntry>): void {
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)));
  }
  return (
    <div className="space-y-5">
      <p className="text-support text-on-surface-variant">
        Referensi yang dipilih dibuat lebih dahulu. Material disimpan melalui tindakan terpisah.
      </p>
      {(["category", "location", "vendor"] as const).map((kind) => {
        const group = entries
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.reference.kind === kind);
        if (!group.length) return null;
        return (
          <FormSection
            key={kind}
            title={kind === "category" ? "Kategori" : kind === "location" ? "Lokasi" : "Vendor"}
            helper={
              kind === "location"
                ? "Lokasi baru menyiapkan inventory nol untuk seluruh material aktif. Tidak menambah stok fisik atau kas."
                : undefined
            }
          >
            {group.map(({ entry, index }) => (
              <React.Fragment
                key={referenceReviewKey({ ...entry.reference, name: entry.sourceName })}
              >
                <ChoiceRow
                  checked={entry.selected}
                  disabled={pending}
                  title={entry.sourceName}
                  emphasis="neutral"
                  onChange={(selected) => patch(index, { selected })}
                />
                {entry.selected && (
                  <>
                    <FormField label="Nama" required>
                      <TextInput
                        disabled={pending}
                        value={entry.reference.name}
                        onChange={(name) =>
                          patch(index, { reference: { ...entry.reference, name } })
                        }
                      />
                    </FormField>
                    {kind === "vendor" && (
                      <FormField label="Nomor telepon" required>
                        <TextInput
                          disabled={pending}
                          type="tel"
                          value={entry.reference.phone}
                          onChange={(phone) =>
                            patch(index, { reference: { ...entry.reference, phone } })
                          }
                        />
                      </FormField>
                    )}
                  </>
                )}
              </React.Fragment>
            ))}
          </FormSection>
        );
      })}
      <p className="text-meta text-on-surface-variant">
        Referensi yang sudah dibuat tetap tersimpan jika import material dibatalkan.
      </p>
    </div>
  );
}
