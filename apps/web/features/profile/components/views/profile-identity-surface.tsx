"use client";

import React from "react";

import { AppIcon, Badge, UserAvatar, type BadgeStatus } from "@/components/ui";
import { useProfileActions } from "./profile-actions-provider";
export function ProfileIdentitySurface({
  displayName,
  displayEmail,
  imageUrl,
  initials,
  roleLabel,
  roleStatus,
  isActive,
  accessibleModuleCount,
  moduleCount,
}: {
  readonly displayName: string;
  readonly displayEmail: string;
  readonly imageUrl?: string | null;
  readonly initials: string;
  readonly roleLabel: string;
  readonly roleStatus: BadgeStatus;
  readonly isActive: boolean;
  readonly accessibleModuleCount: number;
  readonly moduleCount: number;
}): React.JSX.Element {
  const actions = useProfileActions();

  const avatar = (
    <UserAvatar
      imageUrl={imageUrl}
      initials={initials}
      displayName={displayName}
      renderPx={64}
      className="h-16 w-16 text-[23px] tracking-tight shadow-raised ring-1 ring-ring-subtle max-[430px]:h-14 max-[430px]:w-14 max-[430px]:text-[20px]"
    />
  );

  return (
    <section
      aria-label="Identitas akun"
      className="relative isolate overflow-hidden rounded-owner bg-white/90 p-4 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl max-[430px]:rounded-3xl max-[430px]:p-3.5"
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white"
        aria-hidden="true"
      />
      <div className="flex min-w-0 items-start gap-3.5">
        {actions ? (
          /*
           * Jalan pintas, bukan satu-satunya pintu: baris "Ubah profil" di grup
           * di bawah membuka sheet yang sama. Avatar sendiri sudah 64 px, jadi
           * target sentuhnya lewat dari 48 px tanpa padding tambahan.
           */
          <button
            type="button"
            onClick={actions.openEditProfile}
            aria-label="Ubah profil"
            className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
          >
            {avatar}
            <span
              className="absolute -right-0.5 -bottom-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-on-surface-variant shadow-control ring-1 ring-ring-subtle"
              aria-hidden="true"
            >
              <AppIcon name="photo_camera" className="icon-xs leading-none" />
            </span>
          </button>
        ) : (
          avatar
        )}

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <Badge status={roleStatus}>
              <span>{roleLabel}</span>
            </Badge>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 text-meta font-semibold ${isActive ? "text-success" : "text-error"}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {isActive ? "Aktif" : "Nonaktif"}
            </span>
          </div>
          <h2 className="mt-2 line-clamp-2 text-[19px] leading-[1.12] font-bold tracking-[-0.02em] text-on-surface max-[430px]:text-[17px]">
            {displayName}
          </h2>
          <p className="mt-1.5 truncate text-support text-on-surface-variant" title={displayEmail}>
            {displayEmail}
          </p>
        </div>
      </div>

      <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-black/5.5 pt-3.5">
        <div className="min-w-0">
          <p className="text-eyebrow font-bold tracking-[0.13em] text-on-surface-variant/60 uppercase">
            Akses aplikasi
          </p>
          <p className="mt-1 text-row font-bold text-on-surface">
            {accessibleModuleCount} dari {moduleCount} modul tersedia
          </p>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-high/65 text-on-surface-variant ring-1 ring-ring-subtle"
          aria-hidden="true"
        >
          <AppIcon name="verified_user" className="icon-md leading-none" />
        </span>
      </div>
    </section>
  );
}
