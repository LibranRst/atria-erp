"use client";

import React from "react";

import { AppIcon, Button } from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useProfileActions } from "./profile-actions-provider";

const ROW_CLASS =
  "flex min-h-16 w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low";

function ActionRow({
  icon,
  title,
  description,
  onClick,
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button type="button" onClick={onClick} className={ROW_CLASS}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-primary/6.5 text-primary ring-1 ring-primary/6"
        aria-hidden="true"
      >
        <AppIcon name={icon} className="icon-md leading-none" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-row font-bold text-on-surface">{title}</span>
        <span className="mt-1 block truncate text-[10px] leading-[1.3] text-on-surface-variant">
          {description}
        </span>
      </span>
      <AppIcon name="chevron_right" className="icon-md shrink-0 leading-none text-primary" />
    </button>
  );
}

export function ProfileAccountRows(): React.JSX.Element | null {
  const actions = useProfileActions();
  const desktop = useWorkspacePresentation() === "desktop";
  if (!actions) return null;
  if (desktop)
    return (
      <div className="flex min-h-14 items-center justify-between gap-4 px-3.5 py-3 pointer-coarse:min-h-16">
        <div className="min-w-0">
          <p className="text-row font-semibold text-on-surface">Password</p>
          <p className="mt-0.5 text-support text-on-surface-variant">
            Perangkat lain akan keluar setelah diubah.
          </p>
        </div>
        <Button size="compact" variant="secondary" onClick={actions.openChangePassword}>
          Ganti password
        </Button>
      </div>
    );

  return (
    <>
      <ActionRow
        icon="edit"
        title="Ubah profil"
        description="Ganti foto dan nama tampilan."
        onClick={actions.openEditProfile}
      />
      <ActionRow
        icon="password"
        title="Ganti password"
        description="Perangkat lain akan keluar otomatis."
        onClick={actions.openChangePassword}
      />
    </>
  );
}
