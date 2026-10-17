"use client";

import React from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { useCan, useCurrentUserProfile } from "@/components/auth/permissions-provider";
import { ActionMenu, IconButton, UserAvatar, type ActionMenuItem } from "@/components/ui";
import { getProfileInitials } from "@atria/core/presentation/user-identity";
import { LogoutButton } from "@/features/profile/components/views/logout-button";

export function DesktopProfileMenu(): React.JSX.Element {
  const user = useCurrentUserProfile();
  const can = useCan();
  const router = useRouter();
  const name = user?.name || "Pengguna Paduna Build";
  const initials = getProfileInitials(name);
  return (
    <LogoutButton
      renderTrigger={(requestLogout, pending): React.JSX.Element => {
        const items: ActionMenuItem[] = [
          {
            id: "profile",
            label: "Profil saya",
            icon: "person",
            onSelect: () => router.push("/profile"),
          },
          ...(can("view:settings")
            ? [
                {
                  id: "settings",
                  label: "Pengaturan",
                  icon: "tune",
                  onSelect: () => router.push("/settings"),
                },
              ]
            : []),
          {
            id: "logout",
            label: "Keluar",
            icon: "logout",
            tone: "critical",
            disabledReason: pending ? "Sedang keluar…" : undefined,
            onSelect: requestLogout,
          },
        ];
        return (
          <ActionMenu
            label="Menu akun"
            placement="bottom-end"
            trigger={
              <IconButton
                label={`Menu akun ${name}`}
                icon={<UserAvatar imageUrl={user?.image} initials={initials} renderPx={32} />}
              />
            }
            header={
              <div className="flex items-center gap-3 border-b border-outline-variant/20 px-3 py-3">
                <UserAvatar imageUrl={user?.image} initials={initials} renderPx={40} />
                <div className="min-w-0">
                  <p className="truncate text-row font-bold text-on-surface">{name}</p>
                  <p className="text-support text-on-surface-variant">Akun Paduna Build</p>
                </div>
              </div>
            }
            items={items}
          />
        );
      }}
    />
  );
}
