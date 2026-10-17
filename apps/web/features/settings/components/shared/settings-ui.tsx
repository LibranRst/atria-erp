"use client";

import React from "react";

import { MetadataChip } from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

type SettingsHeaderProps = {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly role: string;
  readonly canManage?: boolean;
  readonly action?: React.ReactNode;
};

export function SettingsHeader({
  eyebrow,
  title,
  description,
  role,
  canManage,
  action,
}: SettingsHeaderProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  return (
    <header className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-eyebrow font-bold tracking-[0.15em] text-on-surface-variant/65 uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="text-title font-semibold tracking-tight text-on-surface">{title}</h1>
          {description && (
            <p
              className={
                desktop
                  ? "mt-1 text-support text-on-surface-variant"
                  : "mt-0.5 text-support text-on-surface-variant"
              }
            >
              {description}
            </p>
          )}
        </div>
        <MetadataChip className="font-extrabold tracking-[0.08em] uppercase">
          {canManage === false ? "Hanya baca" : formatBusinessLabel(role)}
        </MetadataChip>
      </div>
      {action && <div className="mt-2 w-full">{action}</div>}
    </header>
  );
}
