"use client";

import React from "react";
import { Avatar } from "@heroui/react";

/** HeroUI owns desktop image/fallback behavior inside the shared avatar contract. */
export function DesktopAvatar({
  imageUrl,
  initials,
  displayName,
  renderPx,
  className,
}: {
  readonly imageUrl?: string | null;
  readonly initials: string;
  readonly displayName?: string;
  readonly renderPx: number;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <Avatar
      className={`atria-desktop-avatar shrink-0 text-support ${className ?? ""}`}
      style={{ width: renderPx, height: renderPx }}
      aria-label={displayName ? `Foto profil ${displayName}` : undefined}
    >
      {imageUrl ? (
        <Avatar.Image
          className="object-cover"
          src={imageUrl}
          alt={displayName ? `Foto profil ${displayName}` : ""}
        />
      ) : null}
      <Avatar.Fallback aria-hidden={!displayName}>{initials}</Avatar.Fallback>
    </Avatar>
  );
}
