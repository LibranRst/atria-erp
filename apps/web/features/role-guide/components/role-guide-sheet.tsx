"use client";

import type { OwnRoleGuide } from "@atria/core/onboarding/role-guide";
import {
  AppIcon,
  DetailSheet,
  GroupedSurface,
  SheetSection,
  SheetFooterActions,
} from "@/components/ui";

export function RoleGuideSheet({
  guide,
  open,
  onClose,
  onStart,
  onExitComplete,
}: {
  readonly guide: OwnRoleGuide | null;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onStart: () => void;
  readonly onExitComplete: () => void;
}): React.JSX.Element {
  return (
    <DetailSheet
      open={open}
      title="Panduan peran Anda"
      dismissOnPull
      onClose={onClose}
      onExitComplete={onExitComplete}
      contentKey={guide?.contextKey}
      footer={
        guide ? (
          <SheetFooterActions
            primary={{ label: guide.primaryAction.label, onClick: onStart }}
            secondary={{ label: "Mengerti", onClick: onClose }}
          />
        ) : undefined
      }
    >
      {guide ? (
        <div className="space-y-4 pb-2">
          <GroupedSurface className="px-4 py-4">
            <div className="flex items-start gap-3">
              <AppIcon
                name="verified_user"
                className="mt-1 icon-lg shrink-0 text-on-surface-variant"
              />
              <div className="min-w-0">
                <p className="text-row text-on-surface-variant">Anda masuk sebagai</p>
                <h2 className="mt-1 text-title font-bold text-on-surface">{guide.roleLabel}</h2>
              </div>
            </div>
          </GroupedSurface>
          <SheetSection title="Tugas utama Anda">
            {guide.responsibilities.length > 0 ? (
              <ul className="divide-y divide-outline-variant/15 px-4">
                {guide.responsibilities.map((responsibility) => (
                  <li key={responsibility.id} className="py-3">
                    <h3 className="text-row font-bold text-on-surface">{responsibility.title}</h3>
                    <p className="mt-1 text-row text-on-surface-variant">
                      {responsibility.description}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-row text-on-surface-variant">
                Belum ada tugas operasional yang tersedia untuk akun ini. Periksa hak akses di
                Profil atau hubungi Owner.
              </p>
            )}
          </SheetSection>
          <div className="px-1">
            <p className="text-row text-on-surface-variant">{guide.scopeNote}</p>
            <p className="mt-2 text-meta text-on-surface-variant">
              Buka lagi melalui Profil → Panduan peran saya.
            </p>
          </div>
        </div>
      ) : null}
    </DetailSheet>
  );
}
