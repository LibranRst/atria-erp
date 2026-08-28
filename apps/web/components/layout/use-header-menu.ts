"use client";

import { authClient } from "@/lib/auth-client";
import { usePermissions } from "@/components/auth/permissions-provider";
import type { PermissionKey } from "@atria/core/auth/permissions";
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
  readonly name?: unknown;
  readonly image?: unknown;
};

function readStringField(user: unknown, field: "name" | "image"): string | null {
  if (typeof user !== "object" || user === null || !(field in user)) return null;

  const value = (user as SessionUserWithRole)[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Tombol asisten AI hanya muncul untuk peran yang benar-benar memilikinya,
 * dibaca dari izin efektif sesi — daftar yang sama dengan yang ditegakkan
 * `app/api/ai/chat/route.ts`.
 */
export function canUseAiChat(permissions: readonly PermissionKey[]): boolean {
  return permissions.includes("use:ai_chat");
}

export type HeaderMenu = {
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  readonly items: readonly HeaderMenuItem[];
  /** Identitas untuk avatar bilah atas; `null` selama sesi belum terbaca. */
  readonly userName: string | null;
  readonly userImageUrl: string | null;
  readonly canUseAiChat: boolean;
  /** Identitas rute+kueri, dipakai untuk menutup menu begitu tujuannya tercapai. */
  readonly routeKey: string;
};

export function useHeaderMenu(): HeaderMenu {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();

  const permissions = usePermissions();
  const items = React.useMemo(() => getHeaderMenuItems(permissions), [permissions]);

  return {
    pathname,
    searchParams,
    items,
    userName: readStringField(session?.user ?? null, "name"),
    userImageUrl: readStringField(session?.user ?? null, "image"),
    canUseAiChat: canUseAiChat(permissions),
    routeKey: `${pathname}?${searchParams.toString()}`,
  };
}
