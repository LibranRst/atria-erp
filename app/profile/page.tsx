import Link from "next/link";
import React from "react";

import { ProfileAccessList } from "@/features/profile/components/profile-access-list";
import { ProfileIdentitySurface } from "@/features/profile/components/profile-identity-surface";
import { LogoutButton } from "@/features/profile/components/logout-button";
import {
  countAccessibleProfileModules,
  formatProfileRole,
  getProfileInitials,
  summarizeProfileAccess,
} from "@/features/profile/lib/profile-access";
import {
  resolveRoleName,
  ROLE_PERMISSIONS,
  type PermissionKey,
} from "@/lib/auth/permissions";
import { requireServerSession } from "@/lib/server/session";

function getBadgeStatus(role: string): "PRIMARY" | "APPROVED" | "PENDING" | "DRAFT" {
  if (role === "OWNER") return "PRIMARY";
  if (role === "FINANCE_ADMIN") return "APPROVED";
  if (role === "PROJECT_MANAGER") return "PENDING";
  return "DRAFT";
}

function SectionHeader({
  title,
  meta,
}: {
  readonly title: string;
  readonly meta?: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 px-1">
      <h2 className="min-w-0 truncate text-[17px] font-bold leading-6 tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5">
        {title}
      </h2>
      {meta ? <span className="shrink-0 text-[9px] font-semibold text-on-surface-variant/65">{meta}</span> : null}
    </div>
  );
}

export default async function ProfilePage(): Promise<React.JSX.Element> {
  const session = await requireServerSession();
  const roleName = await resolveRoleName(session.user.roleId);
  const permissions: readonly PermissionKey[] = ROLE_PERMISSIONS[roleName] ?? [];
  const accessGroups = summarizeProfileAccess(permissions);
  const accessibleModuleCount = countAccessibleProfileModules(accessGroups);
  const roleLabel = formatProfileRole(roleName);
  const canAccessSettings = permissions.includes("view:settings");
  const displayName = session.user.name || "Pengguna Atria";
  const displayEmail = session.user.email || "Email belum tersedia";

  return (
    <section className="space-y-5 pb-8 max-[430px]:-mx-1 max-[430px]:space-y-4 max-[430px]:pb-6">
      <header className="px-1">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">Akun</p>
          <h1 className="mt-1 text-[25px] font-bold leading-7 tracking-[-0.025em] text-on-surface max-[430px]:text-[22px] max-[430px]:leading-6">
            Profil saya
          </h1>
          <p className="mt-1.5 max-w-[290px] text-[11px] leading-[1.4] text-on-surface-variant">
            Identitas akun dan akses ERP yang tersedia untuk peran Anda.
          </p>
        </div>
      </header>

      <ProfileIdentitySurface
        displayName={displayName}
        displayEmail={displayEmail}
        imageUrl={session.user.image}
        initials={getProfileInitials(displayName)}
        roleLabel={roleLabel}
        roleStatus={getBadgeStatus(roleName)}
        isActive={session.user.isActive}
        accessibleModuleCount={accessibleModuleCount}
        moduleCount={accessGroups.length}
      />

      <section className="space-y-2">
        <SectionHeader title="Akun & akses" />
        <div className="relative isolate overflow-hidden rounded-[26px] bg-white/[0.9] shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/[0.025] backdrop-blur-xl max-[430px]:rounded-[24px]">
          <div className="divide-y divide-black/[0.055]">
            <div className="flex min-h-[64px] min-w-0 items-center gap-3 px-3.5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-high/65 text-on-surface-variant ring-1 ring-black/[0.035]" aria-hidden="true">
                <span className="material-symbols-outlined text-[18px] leading-none">verified_user</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold leading-4 text-on-surface">Peran autentikasi</p>
                <p className="mt-1 truncate text-[10px] leading-[1.3] text-on-surface-variant">Menentukan menu dan tindakan yang tersedia.</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-on-surface">{roleLabel}</span>
            </div>

            <div className="flex min-h-[64px] min-w-0 items-center gap-3 px-3.5 py-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${session.user.isActive ? "bg-success/[0.07] text-success ring-success/[0.06]" : "bg-error/[0.07] text-error ring-error/[0.06]"}`} aria-hidden="true">
                <span className="material-symbols-outlined text-[18px] leading-none">{session.user.isActive ? "check_circle" : "block"}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold leading-4 text-on-surface">Status akun</p>
                <p className="mt-1 truncate text-[10px] leading-[1.3] text-on-surface-variant">Akses masuk dan aktivitas ERP.</p>
              </div>
              <span className={`shrink-0 text-[10px] font-semibold ${session.user.isActive ? "text-success" : "text-error"}`}>{session.user.isActive ? "Aktif" : "Nonaktif"}</span>
            </div>

            {canAccessSettings ? (
              <Link
                href="/settings"
                className="flex min-h-[64px] min-w-0 items-center gap-3 px-3.5 py-3 outline-none transition-colors active:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-primary/[0.065] text-primary ring-1 ring-primary/[0.06]" aria-hidden="true">
                  <span className="material-symbols-outlined text-[18px] leading-none">tune</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-4 text-on-surface">Pengaturan ERP</p>
                  <p className="mt-1 truncate text-[10px] leading-[1.3] text-on-surface-variant">Kelola default dan master data sesuai akses.</p>
                </div>
                <span className="material-symbols-outlined shrink-0 text-[18px] leading-none text-primary" aria-hidden="true">chevron_right</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <SectionHeader title="Hak akses" meta={`${accessibleModuleCount} dari ${accessGroups.length} modul`} />
        <ProfileAccessList groups={accessGroups} roleLabel={roleLabel} />
      </section>

      <section className="space-y-2">
        <SectionHeader title="Sesi" />
        <div className="overflow-hidden rounded-[26px] bg-white/[0.9] shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/[0.025] backdrop-blur-xl max-[430px]:rounded-[24px]">
          <LogoutButton />
        </div>
      </section>
    </section>
  );
}
