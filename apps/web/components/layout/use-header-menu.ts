"use client";

import { authClient } from "@/lib/auth-client";
import { ROLE_ID_TO_NAME, ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

import { getHeaderMenuItems, type HeaderMenuItem } from "./header-menu-config";

/**
 * Segala yang dibutuhkan menu bilah atas, diturunkan sekali.
 *
 * Halaman asisten AI merender bilahnya sendiri — tombol kembalinya bergantung
 * pada state lokal `AiChatView` — tetapi menunya harus sama persis dengan menu
 * di rute lain. Yang dibagi karena itu adalah **penurunannya**, bukan
 * renderingnya: mengangkat state panel riwayat ke sebuah context agar shell bisa
 * merender tombol yang menutup panel yang tidak diketahuinya akan membalik
 * kepemilikan untuk satu rute saja.
 */

type SessionUserWithRole = {
  readonly roleId?: unknown;
};

function getRoleName(user: unknown): string | null {
  if (typeof user !== "object" || user === null || !("roleId" in user)) {
    return null;
  }

  const roleId = (user as SessionUserWithRole).roleId;
  return typeof roleId === "string" ? (ROLE_ID_TO_NAME[roleId] ?? null) : null;
}

/**
 * Tombol asisten AI hanya muncul untuk peran yang benar-benar memilikinya,
 * dibaca dari matriks izin yang sama dengan yang ditegakkan di server.
 */
export function canUseAiChat(roleName: string | null): boolean {
  return roleName !== null && (ROLE_PERMISSIONS[roleName] ?? []).includes("use:ai_chat");
}

export type HeaderMenu = {
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  readonly items: readonly HeaderMenuItem[];
  readonly roleName: string | null;
  readonly canUseAiChat: boolean;
  /** Identitas rute+kueri, dipakai untuk menutup menu begitu tujuannya tercapai. */
  readonly routeKey: string;
};

export function useHeaderMenu(): HeaderMenu {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();

  const roleName = React.useMemo(() => getRoleName(session?.user ?? null), [session?.user]);
  const items = React.useMemo(() => getHeaderMenuItems(roleName), [roleName]);

  return {
    pathname,
    searchParams,
    items,
    roleName,
    canUseAiChat: canUseAiChat(roleName),
    routeKey: `${pathname}?${searchParams.toString()}`,
  };
}
