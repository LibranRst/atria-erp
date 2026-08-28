"use client";

import { AppIcon, StatusBadge } from "@/components/ui";
import { roleReviewOutputSchema } from "@/lib/ai/tool-output";
import * as React from "react";

import { ResultRow, ResultShell } from "./result-shell";
import { EMPTY_TOOL_RESULT_CONTEXT, type ToolResultProps } from "./types";

/**
 * Kartu serah-terima perubahan peran.
 *
 * Bedanya dengan kartu usulan lain disengaja dan penting: **tidak ada tombol
 * konfirmasi di sini.** Asisten tidak bisa menerapkan perubahan izin, dan kartu
 * yang menyediakan satu ketukan untuk menerapkannya akan menjadi stempel di atas
 * pemberian wewenang. Yang ditawarkan hanyalah jalan ke penyunting peran dengan
 * sakelar yang disarankan sudah tersorot.
 */
export function RoleReviewResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const parsed = roleReviewOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const review = parsed.data;
  const changeCount = review.grant.length + review.revoke.length;
  const hasWarning = review.criticalGaps.length > 0 || review.blockedGrants.length > 0;

  return (
    <ResultShell
      eyebrow="Peran & akses"
      title={review.roleName}
      meta={`${changeCount} usulan · ${review.affectedUsers} pemegang aktif`}
      href={review.href}
      linkLabel="Buka di Peran & akses"
      onNavigate={context.onNavigate}
      trailing={
        <StatusBadge
          label={hasWarning ? "Perlu ditinjau" : "Belum diterapkan"}
          tone={hasWarning ? "warning" : "neutral"}
        />
      }
    >
      <p className="px-4 pb-2 text-meta leading-[1.45] text-on-surface-variant">{review.reason}</p>

      <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
        {review.grant.map((permission) => (
          <ResultRow
            key={`grant-${permission.key}`}
            label={permission.label}
            meta={permission.key}
            leading={
              <AppIcon
                name="add_circle"
                className="icon-sm shrink-0 leading-none text-success"
                aria-hidden="true"
              />
            }
            value={<span className="text-eyebrow font-bold text-success">Tambah</span>}
          />
        ))}
        {review.revoke.map((permission) => (
          <ResultRow
            key={`revoke-${permission.key}`}
            label={permission.label}
            meta={permission.key}
            leading={
              <AppIcon
                name="remove"
                className="icon-sm shrink-0 leading-none text-error"
                aria-hidden="true"
              />
            }
            value={<span className="text-eyebrow font-bold text-error">Cabut</span>}
          />
        ))}

        {review.criticalGaps.map((gap) => (
          <div
            key={`gap-${gap.permission}`}
            className="flex min-w-0 items-start gap-2.5 bg-warning-container/45 px-4 py-3"
          >
            <AppIcon
              name="warning"
              className="mt-0.5 icon-sm shrink-0 leading-none text-warning"
              aria-hidden="true"
            />
            <p className="min-w-0 text-meta leading-[1.4] font-semibold text-on-surface">
              Setelah ini {gap.consequence}.
            </p>
          </div>
        ))}

        {review.blockedGrants.length > 0 ? (
          <div className="flex min-w-0 items-start gap-2.5 bg-surface-container-low px-4 py-3">
            <AppIcon
              name="lock"
              className="mt-0.5 icon-sm shrink-0 leading-none text-on-surface-variant"
              aria-hidden="true"
            />
            <p className="min-w-0 text-meta leading-[1.4] text-on-surface-variant">
              Anda tidak memegang {review.blockedGrants.join(", ")}, jadi izin itu tidak dapat Anda
              berikan.
            </p>
          </div>
        ) : null}
      </div>
    </ResultShell>
  );
}
