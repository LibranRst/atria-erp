"use client";

import React from "react";

import { ChangePasswordSheet } from "./change-password-sheet";
import { EditProfileSheet } from "./edit-profile-sheet";

/**
 * Pemilik state kedua sheet profil.
 *
 * Pemicunya duduk di dua tempat yang tidak saling mengenal — avatar di
 * permukaan identitas dan baris di grup "Akun & akses" — sementara sheet-nya
 * harus satu instance. Merendernya dua kali berarti dua sumber kebenaran untuk
 * satu formulir yang sama.
 */

type ProfileActions = {
  readonly openEditProfile: () => void;
  readonly openChangePassword: () => void;
};

const ProfileActionsContext = React.createContext<ProfileActions | null>(null);

/**
 * `null` ketika dipakai di luar provider — permukaan identitas juga dirender di
 * tes presentasi dan cerita tanpa sheet apa pun, dan di sana avatarnya memang
 * bukan pemicu.
 */
export function useProfileActions(): ProfileActions | null {
  return React.useContext(ProfileActionsContext);
}

export function ProfileActionsProvider({
  displayName,
  imageUrl,
  initials,
  children,
}: {
  readonly displayName: string;
  readonly imageUrl?: string | null;
  readonly initials: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [openSheet, setOpenSheet] = React.useState<"edit" | "password" | null>(null);
  /*
   * Penghitung terpisah per sheet. Nilainya masuk ke `key`, jadi setiap kali
   * sebuah sheet dibuka ia terpasang ulang dengan state kosong — tanpa itu,
   * nama yang sudah diketik lalu dibatalkan akan menyambut pengguna lagi saat
   * sheet dibuka berikutnya. Terpisah supaya membuka sheet yang satu tidak
   * memotong animasi keluar sheet yang lain.
   */
  const [editSession, setEditSession] = React.useState(0);
  const [passwordSession, setPasswordSession] = React.useState(0);

  const actions = React.useMemo<ProfileActions>(
    () => ({
      openEditProfile: () => {
        setEditSession((current) => current + 1);
        setOpenSheet("edit");
      },
      openChangePassword: () => {
        setPasswordSession((current) => current + 1);
        setOpenSheet("password");
      },
    }),
    [],
  );

  const close = React.useCallback(() => setOpenSheet(null), []);

  return (
    <ProfileActionsContext.Provider value={actions}>
      {children}
      <EditProfileSheet
        key={`edit-${editSession}`}
        open={openSheet === "edit"}
        displayName={displayName}
        imageUrl={imageUrl}
        initials={initials}
        onClose={close}
      />
      <ChangePasswordSheet
        key={`password-${passwordSession}`}
        open={openSheet === "password"}
        onClose={close}
      />
    </ProfileActionsContext.Provider>
  );
}
