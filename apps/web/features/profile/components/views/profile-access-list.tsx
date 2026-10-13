"use client";

import React from "react";

import {
  AppIcon,
  DetailSheet,
  DesktopTable,
  GroupedSurface,
  WorkspaceStatusLabel,
  useSheetPresenceValue,
  type DesktopTableColumn,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  describeAccessCoverage,
  type ProfileAccessGroup,
} from "@/features/profile/utils/profile-access";

type Coverage = "full" | "partial" | "none";

function coverageOf(group: ProfileAccessGroup): Coverage {
  if (group.grantedCount === 0) return "none";
  return group.grantedCount === group.totalCount ? "full" : "partial";
}

const COVERAGE_LABEL: Record<Coverage, string> = {
  full: "Penuh",
  partial: "Sebagian",
  none: "Tidak ada",
};

const COVERAGE_TONE: Record<Coverage, "positive" | "neutral" | "inactive"> = {
  full: "positive",
  partial: "neutral",
  none: "inactive",
};

const ACCESS_COLUMNS: readonly DesktopTableColumn<ProfileAccessGroup>[] = [
  {
    key: "module",
    label: "Modul",
    render: (group) => (
      <div className="flex items-center gap-2.5">
        <AppIcon name={group.iconName} className="icon-md shrink-0 text-on-surface-variant" />
        <span className="text-row font-semibold text-on-surface">{group.title}</span>
      </div>
    ),
  },
  {
    key: "access",
    label: "Hak akses",
    render: (group) => (
      <div className="flex items-center gap-2">
        <WorkspaceStatusLabel
          label={COVERAGE_LABEL[coverageOf(group)]}
          tone={COVERAGE_TONE[coverageOf(group)]}
        />
        <p className="text-meta whitespace-nowrap text-on-surface-variant">
          {group.grantedCount} dari {group.totalCount} hak
        </p>
        <span className="sr-only">Tinjau akses {group.title}</span>
        <AppIcon
          name="chevron_right"
          className="ml-auto icon-sm shrink-0 text-on-surface-variant"
        />
      </div>
    ),
  },
];

/**
 * Daftar modul akses pada Profile.
 *
 * Sheet detailnya menampilkan **seluruh** hak dalam satu modul, yang diberikan
 * maupun tidak. Sebelumnya ia hanya memuat yang diberikan, sehingga sebuah
 * modul bertuliskan "7 dari 8" tidak punya satu pun tempat untuk menjawab
 * pertanyaan yang wajar muncul berikutnya: yang satu itu apa.
 */
export function ProfileAccessList({
  groups,
  roleLabel,
}: {
  readonly groups: readonly ProfileAccessGroup[];
  readonly roleLabel: string;
}): React.JSX.Element {
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const desktop = useWorkspacePresentation() === "desktop";
  const presence = useSheetPresenceValue(
    groups.find((group) => group.key === selectedKey) ?? null,
    selectedKey,
  );
  const selectedGroup = presence.presentedValue;
  const selectedCoverage = selectedGroup ? coverageOf(selectedGroup) : "none";

  return (
    <>
      {desktop ? (
        <DesktopTable
          ariaLabel="Hak akses per modul"
          columns={ACCESS_COLUMNS}
          rows={groups}
          rowKey={(group) => group.key}
          onRowAction={(group) => setSelectedKey(group.key)}
        />
      ) : (
        <GroupedSurface>
          <div className="divide-y divide-outline-variant/20">
            {groups.map((group) => {
              const coverage = coverageOf(group);

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setSelectedKey(group.key)}
                  className="flex min-h-18 w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low"
                  aria-label={`Tinjau akses ${group.title}`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${
                      coverage === "none"
                        ? "bg-surface-container-low text-on-surface-variant/55"
                        : "bg-primary/6.5 text-primary"
                    }`}
                    aria-hidden="true"
                  >
                    <AppIcon name={group.iconName} className="icon-md leading-none" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] leading-5 font-bold text-on-surface">
                      {group.title}
                    </span>
                    <span className="block truncate text-meta text-on-surface-variant">
                      {describeAccessCoverage(group)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-row items-center">
                    <WorkspaceStatusLabel
                      label={COVERAGE_LABEL[coverage]}
                      tone={COVERAGE_TONE[coverage]}
                    />
                    <AppIcon
                      name="chevron_right"
                      className="icon-sm shrink-0 text-on-surface-variant/55"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </GroupedSurface>
      )}

      <DetailSheet
        open={presence.open}
        title={selectedGroup?.title ?? "Detail akses"}
        onClose={() => setSelectedKey(null)}
        onExitComplete={presence.handleExitComplete}
      >
        {selectedGroup ? (
          <div className="space-y-3">
            <p className="px-1 text-[11px] leading-[1.45] text-on-surface-variant">
              {selectedGroup.description}
            </p>

            <div className="flex min-w-0 items-center gap-3 rounded-[22px] bg-surface-container-low px-3.5 py-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${
                  selectedCoverage === "none"
                    ? "bg-surface text-on-surface-variant/55"
                    : "bg-white text-primary shadow-control"
                }`}
                aria-hidden="true"
              >
                <AppIcon name={selectedGroup.iconName} className="icon-lg leading-none" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-row font-bold text-on-surface">
                  {describeAccessCoverage(selectedGroup)}
                </span>
                <span className="mt-0.5 block text-[11px] leading-[1.4] text-on-surface-variant">
                  Mengikuti peran {roleLabel}.
                </span>
              </span>
            </div>

            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                {selectedGroup.permissions.map((permission) => (
                  <div
                    key={permission.key}
                    className="flex min-h-13 min-w-0 items-center gap-2.5 px-3.5 py-2.5"
                  >
                    <AppIcon
                      name={permission.granted ? "check_circle" : "lock"}
                      className={`icon-sm shrink-0 leading-none ${
                        permission.granted ? "text-success" : "text-on-surface-variant/45"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[11px] leading-[1.35] font-semibold ${
                          permission.granted ? "text-on-surface" : "text-on-surface-variant/70"
                        }`}
                      >
                        {permission.label}
                      </span>
                      {!permission.granted ? (
                        <span className="mt-0.5 block text-eyebrow font-semibold text-on-surface-variant/60">
                          Tidak diberikan ke peran ini
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </GroupedSurface>
          </div>
        ) : null}
      </DetailSheet>
    </>
  );
}
