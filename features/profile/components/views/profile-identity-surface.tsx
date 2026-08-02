"use client";

import Image from "next/image";
import React from "react";

import { AppIcon, Badge, type BadgeStatus } from "@/components/ui";
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
  const [showImage, setShowImage] = React.useState<boolean>(Boolean(imageUrl));

  return (
    <section
      aria-label="Identitas akun"
      className="relative isolate overflow-hidden rounded-[28px] bg-white/90 p-4 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl max-[430px]:rounded-3xl max-[430px]:p-3.5"
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white"
        aria-hidden="true"
      />
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-[23px] leading-none font-bold tracking-tight text-on-primary shadow-raised ring-1 ring-ring-subtle max-[430px]:h-14 max-[430px]:w-14 max-[430px]:text-[20px]">
          <span aria-hidden={showImage}>{initials}</span>
          {showImage && imageUrl ? (
            <Image
              src={imageUrl}
              alt={`Foto profil ${displayName}`}
              fill
              sizes="64px"
              unoptimized
              className="object-cover"
              onError={() => setShowImage(false)}
            />
          ) : null}
        </div>

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
