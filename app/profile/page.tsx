import Link from "next/link";
import React from "react";

import { ProfileAccessList } from "@/features/profile/components/views/profile-access-list";
import { ProfileIdentitySurface } from "@/features/profile/components/views/profile-identity-surface";
import { LogoutButton } from "@/features/profile/components/views/logout-button";
import { DeveloperAccountSwitcher } from "@/features/profile/components/developer/developer-account-switcher";
import { getProfilePageData } from "@/features/profile/server/get-profile-page-data";
import { AppIcon } from "@/components/ui/icon/app-icon";

function SectionHeader({
  title,
  meta,
}: {
  readonly title: string;
  readonly meta?: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <h2 className="min-w-0 truncate text-title font-bold tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5">
        {title}
      </h2>
      {meta ? (
        <span className="shrink-0 text-[9px] font-semibold text-on-surface-variant/65">{meta}</span>
      ) : null}
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function ProfilePage(): Promise<React.JSX.Element> {
  const data = await getProfilePageData();

  return (
    <section className="space-y-sm pb-8 max-[430px]:-mx-1 max-[430px]:pb-6">
      <header className="px-1">
        <div className="min-w-0">
          <p className="text-[9px] font-bold tracking-[0.16em] text-primary uppercase">Akun</p>
          <h1 className="mt-1 text-[25px] leading-7 font-bold tracking-tight text-on-surface max-[430px]:text-[22px] max-[430px]:leading-6">
            Profil saya
          </h1>
          <p className="mt-1.5 max-w-72.5 text-[11px] leading-[1.4] text-on-surface-variant">
            Identitas akun dan akses ERP yang tersedia untuk peran Anda.
          </p>
        </div>
      </header>

      <ProfileIdentitySurface
        displayName={data.displayName}
        displayEmail={data.displayEmail}
        imageUrl={data.imageUrl}
        initials={data.initials}
        roleLabel={data.roleLabel}
        roleStatus={data.roleStatus}
        isActive={data.isActive}
        accessibleModuleCount={data.accessibleModuleCount}
        moduleCount={data.accessGroups.length}
      />

      <section className="space-y-2">
        <SectionHeader title="Akun & akses" />
        <div className="relative isolate overflow-hidden rounded-[26px] bg-white/90 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl max-[430px]:rounded-3xl">
          <div className="divide-y divide-black/5.5">
            <div className="flex min-h-16 min-w-0 items-center gap-3 px-3.5 py-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-high/65 text-on-surface-variant ring-1 ring-ring-subtle"
                aria-hidden="true"
              >
                <AppIcon name="verified_user" className="text-[18px] leading-none" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-row font-bold text-on-surface">Peran autentikasi</p>
                <p className="mt-1 truncate text-[10px] leading-[1.3] text-on-surface-variant">
                  Menentukan menu dan tindakan yang tersedia.
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-on-surface">
                {data.roleLabel}
              </span>
            </div>

            <div className="flex min-h-16 min-w-0 items-center gap-3 px-3.5 py-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${data.isActive ? "bg-success/[0.07] text-success ring-success/6" : "bg-error/[0.07] text-error ring-error/6"}`}
                aria-hidden="true"
              >
                <AppIcon
                  name={data.isActive ? "check_circle" : "block"}
                  className="text-[18px] leading-none"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-row font-bold text-on-surface">Status akun</p>
                <p className="mt-1 truncate text-[10px] leading-[1.3] text-on-surface-variant">
                  Akses masuk dan aktivitas ERP.
                </p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-semibold ${data.isActive ? "text-success" : "text-error"}`}
              >
                {data.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </div>

            {data.canAccessSettings ? (
              <Link
                href="/settings"
                className="flex min-h-16 min-w-0 items-center gap-3 px-3.5 py-3 transition-colors outline-none focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-primary/6.5 text-primary ring-1 ring-primary/6"
                  aria-hidden="true"
                >
                  <AppIcon name="tune" className="text-[18px] leading-none" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-row font-bold text-on-surface">Pengaturan ERP</p>
                  <p className="mt-1 truncate text-[10px] leading-[1.3] text-on-surface-variant">
                    Kelola default dan master data sesuai akses.
                  </p>
                </div>
                <AppIcon
                  name="chevron_right"
                  className="shrink-0 text-[18px] leading-none text-primary"
                />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <SectionHeader
          title="Hak akses"
          meta={`${data.accessibleModuleCount} dari ${data.accessGroups.length} modul`}
        />
        <ProfileAccessList groups={data.accessGroups} roleLabel={data.roleLabel} />
      </section>

      {data.developerSimulation ? (
        <DeveloperAccountSwitcher state={data.developerSimulation} />
      ) : null}

      <section className="space-y-2">
        <SectionHeader title="Sesi" />
        <div className="overflow-hidden rounded-[26px] bg-white/90 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl max-[430px]:rounded-3xl">
          <LogoutButton />
        </div>
      </section>
    </section>
  );
}
