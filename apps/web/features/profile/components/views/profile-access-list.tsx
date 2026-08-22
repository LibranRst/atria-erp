"use client";

import React from "react";

import { AppIcon, DetailSheet, GroupedSurface } from "@/components/ui";
import type { ProfileAccessGroup } from "@/features/profile/utils/profile-access";
export function ProfileAccessList({
  groups,
  roleLabel,
}: {
  readonly groups: readonly ProfileAccessGroup[];
  readonly roleLabel: string;
}): React.JSX.Element {
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const selectedGroup = groups.find((group) => group.key === selectedKey) ?? null;

  return (
    <>
      <GroupedSurface>
        <div className="divide-y divide-black/5.5">
          {groups.map((group) => {
            const activeCount = group.activePermissionDescriptions.length;
            const hasAccess = activeCount > 0;

            return (
              <button
                key={group.key}
                type="button"
                onClick={() => setSelectedKey(group.key)}
                className="flex min-h-17 w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low"
                aria-label={`Tinjau akses ${group.title}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${hasAccess ? "bg-primary/6.5 text-primary ring-primary/6" : "bg-surface-container-high/65 text-on-surface-variant/55 ring-ring-subtle"}`}
                  aria-hidden="true"
                >
                  <AppIcon name={group.iconName} className="icon-md leading-none" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-row font-bold text-on-surface">
                    {group.title}
                  </span>
                  <span className="mt-1 line-clamp-1 block text-[10px] leading-[1.3] text-on-surface-variant">
                    {group.description}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`block text-eyebrow font-semibold ${hasAccess ? "text-success" : "text-on-surface-variant/60"}`}
                  >
                    {hasAccess ? "Tersedia" : "Tidak tersedia"}
                  </span>
                  <span className="mt-1 block font-mono text-eyebrow font-bold text-on-surface-variant tabular-nums">
                    {activeCount}/{group.permissions.length}
                  </span>
                </span>
                <AppIcon
                  name="chevron_right"
                  className="icon-md shrink-0 leading-none text-on-surface-variant/50"
                />
              </button>
            );
          })}
        </div>
      </GroupedSurface>

      <DetailSheet
        open={selectedGroup !== null}
        title={selectedGroup?.title ?? "Detail akses"}
        onClose={() => setSelectedKey(null)}
      >
        {selectedGroup ? (
          <div className="space-y-4">
            <div className="flex min-w-0 items-start gap-3 rounded-[22px] bg-surface-container-low p-3.5">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-primary shadow-control"
                aria-hidden="true"
              >
                <AppIcon name={selectedGroup.iconName} className="icon-lg leading-none" />
              </span>
              <div className="min-w-0">
                <p className="text-row font-bold text-on-surface">
                  {selectedGroup.activePermissionDescriptions.length > 0
                    ? `${selectedGroup.activePermissionDescriptions.length} hak tersedia`
                    : "Belum tersedia untuk peran ini"}
                </p>
                <p className="mt-1 text-[11px] leading-[1.4] text-on-surface-variant">
                  {selectedGroup.activePermissionDescriptions.length > 0
                    ? `Akses mengikuti peran ${roleLabel}.`
                    : `Peran ${roleLabel} tidak memiliki akses aktif pada modul ini.`}
                </p>
              </div>
            </div>

            {selectedGroup.activePermissionDescriptions.length > 0 ? (
              <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-ring-subtle">
                <div className="divide-y divide-black/5.5">
                  {selectedGroup.activePermissionDescriptions.map((permission) => (
                    <div
                      key={permission}
                      className="flex min-h-12 items-center gap-2.5 px-3.5 py-2.5"
                    >
                      <AppIcon
                        name="check_circle"
                        className="shrink-0 text-[17px] leading-none text-success"
                      />
                      <span className="text-[11px] leading-[1.35] font-semibold text-on-surface">
                        {permission}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DetailSheet>
    </>
  );
}
