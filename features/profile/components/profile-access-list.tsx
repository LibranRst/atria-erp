"use client";

import React from "react";

import { BottomSheet } from "@/components/ui";
import type { ProfileAccessGroup } from "@/features/profile/lib/profile-access";

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
      <div className="relative isolate overflow-hidden rounded-[26px] bg-white/90 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-3xl">
        <div className="divide-y divide-black/5.5">
          {groups.map((group) => {
            const activeCount = group.activePermissionDescriptions.length;
            const hasAccess = activeCount > 0;

            return (
              <button
                key={group.key}
                type="button"
                onClick={() => setSelectedKey(group.key)}
                className="flex min-h-17 w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-inset active:bg-surface-container-low"
                aria-label={`Tinjau akses ${group.title}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${hasAccess ? "bg-primary/6.5 text-primary ring-primary/6" : "bg-surface-container-high/65 text-on-surface-variant/55 ring-black/2.5"}`}
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">
                    {group.iconName}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-4 font-bold text-on-surface">
                    {group.title}
                  </span>
                  <span className="mt-1 line-clamp-1 block text-[10px] leading-[1.3] text-on-surface-variant">
                    {group.description}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`block text-[9px] font-semibold ${hasAccess ? "text-success" : "text-on-surface-variant/60"}`}
                  >
                    {hasAccess ? "Tersedia" : "Tidak tersedia"}
                  </span>
                  <span className="mt-1 block font-mono text-[9px] font-bold text-on-surface-variant tabular-nums">
                    {activeCount}/{group.permissions.length}
                  </span>
                </span>
                <span
                  className="material-symbols-outlined shrink-0 text-[18px] leading-none text-on-surface-variant/50"
                  aria-hidden="true"
                >
                  chevron_right
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <BottomSheet
        open={selectedGroup !== null}
        title={selectedGroup?.title ?? "Detail akses"}
        onClose={() => setSelectedKey(null)}
      >
        {selectedGroup ? (
          <div className="space-y-4">
            <div className="flex min-w-0 items-start gap-3 rounded-[22px] bg-surface-container-low p-3.5">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-primary shadow-sm"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-[20px] leading-none">
                  {selectedGroup.iconName}
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-4 font-bold text-on-surface">
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
              <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-black/[0.035]">
                <div className="divide-y divide-black/5.5">
                  {selectedGroup.activePermissionDescriptions.map((permission) => (
                    <div
                      key={permission}
                      className="flex min-h-12 items-center gap-2.5 px-3.5 py-2.5"
                    >
                      <span
                        className="material-symbols-outlined shrink-0 text-[17px] leading-none text-success"
                        aria-hidden="true"
                      >
                        check_circle
                      </span>
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
      </BottomSheet>
    </>
  );
}
