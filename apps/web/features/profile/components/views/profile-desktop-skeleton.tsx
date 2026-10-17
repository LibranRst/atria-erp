"use client";

import { DesktopTable, GroupedSurface } from "@/components/ui";
import { summarizeProfileAccess } from "../../utils/profile-access";
import { ProfileWorkspaceLayout } from "./profile-workspace-layout";

function Line({ className }: { readonly className: string }): React.JSX.Element {
  return <div aria-hidden="true" className={`rounded-full bg-surface-container ${className}`} />;
}

/** Mirrors identity, compact security/preferences and the native permission table. */
export function ProfileDesktopSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-label="Memuat profil" aria-busy="true">
      <ProfileWorkspaceLayout>
        <header aria-hidden="true" className="space-y-2 px-1">
          <Line className="h-6 w-36" />
          <Line className="h-3 w-80 max-w-full" />
        </header>
        <section data-profile-section="identity" aria-hidden="true">
          <GroupedSurface className="space-y-5 p-5">
            <div className="space-y-3">
              <Line className="h-16 w-16" />
              <div className="space-y-2">
                <Line className="h-5 w-40 max-w-full" />
                <Line className="h-3 w-48 max-w-full" />
              </div>
            </div>
            <div className="space-y-3 border-t border-outline-variant/20 pt-4">
              {["role", "status"].map((row) => (
                <div key={row} className="flex items-center justify-between gap-3">
                  <Line className="h-3 w-20" />
                  <Line className="h-5 w-16" />
                </div>
              ))}
            </div>
            <Line className="h-3 w-40" />
            <Line className="h-8 w-full" />
          </GroupedSurface>
        </section>
        <div data-profile-column="details">
          <section data-profile-section="account" aria-hidden="true" className="space-y-2">
            <Line className="h-4 w-32" />
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                <div className="flex min-h-14 items-center justify-between gap-4 px-3.5 py-3">
                  <div className="space-y-2">
                    <Line className="h-3 w-20" />
                    <Line className="h-3 w-48 max-w-full" />
                  </div>
                  <Line className="h-8 w-28 shrink-0" />
                </div>
                <div className="flex min-h-14 items-center gap-3 px-3.5 py-3">
                  <Line className="h-8 w-8 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Line className="h-3 w-32" />
                    <Line className="h-3 w-56 max-w-full" />
                  </div>
                  <Line className="h-3 w-3" />
                </div>
              </div>
            </GroupedSurface>
          </section>
          <section data-profile-section="notifications" aria-hidden="true" className="space-y-2">
            <Line className="h-4 w-36" />
            <GroupedSurface className="flex min-h-16 items-center gap-3 px-3.5 py-3">
              <Line className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Line className="h-3 w-40 max-w-full" />
                <Line className="h-3 w-full" />
              </div>
            </GroupedSurface>
          </section>
          <section data-profile-section="access" className="space-y-2">
            <div aria-hidden="true" className="flex items-center justify-between gap-3">
              <Line className="h-4 w-24" />
              <Line className="h-3 w-24" />
            </div>
            <div aria-hidden="true" inert className="min-w-0">
              <DesktopTable
                ariaLabel="Struktur hak akses sedang dimuat"
                rows={summarizeProfileAccess([]).map((group) => ({ id: group.key }))}
                rowKey={(row): string => row.id}
                columns={[
                  {
                    key: "module",
                    label: "Modul",
                    render: (): React.JSX.Element => <Line className="h-3 w-36 max-w-full" />,
                  },
                  {
                    key: "access",
                    label: "Hak akses",
                    render: (): React.JSX.Element => <Line className="h-5 w-36 max-w-full" />,
                  },
                ]}
              />
            </div>
            <div aria-hidden="true">
              <Line className="h-8 w-36" />
            </div>
          </section>
        </div>
        <section data-profile-section="session" aria-hidden="true" className="space-y-2">
          <Line className="h-4 w-12" />
          <GroupedSurface className="space-y-3 p-4">
            <Line className="h-3 w-48 max-w-full" />
            <Line className="h-8 w-full" />
          </GroupedSurface>
        </section>
      </ProfileWorkspaceLayout>
      <span className="sr-only">Identitas akun dan hak akses sedang disiapkan.</span>
    </div>
  );
}
