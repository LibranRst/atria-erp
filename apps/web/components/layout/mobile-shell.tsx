"use client";

import React, { Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AppTopBar, TopBarControl, TOP_BAR_INSET_PX } from "@/components/layout/app-top-bar";
import { HeaderMorphMenu } from "@/components/layout/header-morph-menu";
import { getPageTitle } from "@/components/layout/header-menu-config";
import { useHeaderMenu } from "@/components/layout/use-header-menu";
import { useTopBarSlots } from "@/components/layout/top-bar-slots";
import { usePathname, useRouter } from "@/lib/navigation/workspace-navigation";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { DesktopChrome } from "./admin-shell";

import {
  AppIcon,
  ConnectivityBanner,
  IconButton,
  IconButtonLink,
  UserAvatar,
} from "@/components/ui";
import { getProfileInitials } from "@atria/core/presentation/user-identity";
import { DeveloperSimulationBanner } from "@/features/profile/components/developer/developer-simulation-banner";
import { NotificationBellButton } from "@/features/notifications";
type MobileShellProps = Readonly<{
  children: React.ReactNode;
}>;

/**
 * Perakit bilah atas untuk seluruh rute selain asisten AI.
 *
 * Isinya hanya penentuan apa yang masuk ke tiap slot; geometri, penengahan, dan
 * topeng gradien milik `AppTopBar`.
 */
function MobileHeader({ isRootRoute }: { readonly isRootRoute: boolean }): React.JSX.Element {
  const router = useRouter();
  const { pathname, searchParams, items, canUseAiChat, routeKey, userName, userImageUrl } =
    useHeaderMenu();
  const [openRouteKey, setOpenRouteKey] = React.useState<string | null>(null);
  const isMenuOpen = openRouteKey === routeKey;
  const isAiRoute = pathname === "/ai";
  const hasBackButton = !isRootRoute;
  const canShowAiButton = canUseAiChat && !isAiRoute;

  /**
   * Rute boleh menitipkan isi slotnya sendiri. Bilahnya tetap satu instance,
   * jadi menyeberangi batas rute memorf lebar pil alih-alih menukar dua bilah.
   */
  const override = useTopBarSlots();
  const pageTitle = React.useMemo(
    () => override?.title ?? getPageTitle(pathname),
    [override?.title, pathname],
  );

  return (
    <AppTopBar
      elevated={isMenuOpen}
      left={
        override?.left ?? [
          /*
           * Baris flex biasa dengan `key` stabil, bukan dua kepingan bertumpuk
           * dengan geseran `x: 46` yang ditulis tangan. Angka itu ternyata
           * memang hasil alami flex — lebar tombol 40px ditambah jarak 6px —
           * jadi menuliskannya hanya menduplikasi apa yang sudah dihitung tata
           * letak. Koreografinya sendiri milik `TopBarControl`.
           */
          hasBackButton ? (
            <TopBarControl key="back">
              <IconButton
                label="Kembali"
                size="compact"
                onClick={() => router.back()}
                icon={<AppIcon name="chevron_left" className="icon-md" />}
              />
            </TopBarControl>
          ) : null,
          canShowAiButton ? (
            <TopBarControl key="ai-chat">
              <IconButtonLink label="Buka asisten AI" href="/ai" size="compact">
                <AppIcon name="sparkle" aria-hidden="true" className="icon-md" />
              </IconButtonLink>
            </TopBarControl>
          ) : null,
        ]
      }
      center={
        <HeaderMorphMenu
          isOpen={isMenuOpen}
          items={items}
          pathname={pathname}
          searchParams={searchParams}
          title={pageTitle}
          onToggle={() => setOpenRouteKey((current) => (current === routeKey ? null : routeKey))}
          onClose={() => setOpenRouteKey(null)}
        />
      }
      right={
        override?.right ??
        (isAiRoute
          ? []
          : [
              <TopBarControl key="notifications" reflow={false}>
                <NotificationBellButton />
              </TopBarControl>,
              /*
               * Tanpa pergeseran tempat: avatar satu-satunya penghuni slot kanan
               * pada rute biasa, jadi ia tidak pernah pindah — ia digantikan oleh
               * kontrol halaman AI. Skala dan opasitas saja.
               */
              <TopBarControl key="profile" reflow={false}>
                <IconButtonLink
                  label="Profil Saya"
                  href="/profile"
                  size="compact"
                  className="overflow-hidden"
                >
                  {/*
                   * Selama sesi belum terbaca, inisial cadangan yang tampil — bukan
                   * kerangka. Bilah atas hadir di setiap rute, dan sesuatu yang
                   * berkedip di sana akan berkedip di setiap perpindahan halaman.
                   */}
                  <UserAvatar
                    imageUrl={userImageUrl}
                    initials={getProfileInitials(userName ?? "")}
                    renderPx={40}
                    className="h-full w-full text-support"
                  />
                </IconButtonLink>
              </TopBarControl>,
            ])
      }
    />
  );
}

export function MobileShell({ children }: MobileShellProps): React.JSX.Element {
  const pathname = usePathname();
  const desktop = useWorkspacePresentation() === "desktop";

  const isLoginPage =
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname.startsWith("/onboarding") ||
    pathname === "/profile/password";

  const isAiPage = pathname === "/ai";
  /**
   * Bilah atas kini satu untuk seluruh aplikasi, termasuk `/ai` — itulah yang
   * membuat pil judul bisa bermorf saat menyeberangi batas rute alih-alih
   * ditukar. Yang tetap disembunyikan di `/ai` hanyalah kelengkapan lain:
   * navigasi bawah, spanduk, dan jarak isi — layar percakapan mengatur ruangnya
   * sendiri.
   */
  const hideTopBar = isLoginPage;
  const hideStandardChrome = isLoginPage || isAiPage;

  // Check if current route is a root-level tab route
  const isRootRoute = React.useMemo(() => {
    return [
      "/ledger",
      "/projects",
      "/materials",
      "/expenses",
      "/profile",
      "/settings",
      "/approvals",
    ].includes(pathname);
  }, [pathname]);

  return (
    <div
      data-workspace-layout={desktop ? "desktop" : "mobile"}
      className={`min-h-screen bg-background font-sans text-on-surface ${desktop && !isLoginPage ? "pl-52" : ""}`}
    >
      <DesktopChrome hidden={!desktop || isLoginPage} />
      {/* Top AppBar - Fixed, contents centered to match page width */}
      {/*
       * Fallback `null`, bukan sebuah blok setinggi bilah.
       *
       * `MobileHeader` merender bilah `fixed` yang tidak memakan ruang
       * aliran sama sekali; blok pengganti setinggi 56px **dalam** aliran
       * mendorong seluruh isi halaman turun selama boundary tertunda, lalu
       * menyentaknya naik. Ruangnya sudah disediakan `TOP_BAR_INSET_PX` di
       * bawah, dan blok itu juga menggambar bilah buram bergaris bawah yang
       * tidak pernah ada dalam rancangan aslinya.
       */}
      {!hideTopBar && (
        <div hidden={desktop}>
          <Suspense fallback={null}>
            <MobileHeader isRootRoute={isRootRoute} />
          </Suspense>
        </div>
      )}

      {!hideStandardChrome && <ConnectivityBanner />}

      {/* Screen Content */}
      <main
        // Jarak atas diturunkan dari geometri bilah, bukan ditulis sebagai
        // `pt-20`. Nilainya tetap 80px, jadi tidak ada halaman yang bergeser.
        id="workspace-content"
        style={hideStandardChrome || desktop ? undefined : { paddingTop: TOP_BAR_INSET_PX }}
        className={
          desktop && !isLoginPage
            ? isAiPage
              ? "mx-auto h-[calc(100dvh-64px)] w-full max-w-400 min-w-0 overflow-hidden"
              : "mx-auto w-full max-w-400 min-w-0 space-y-6 px-6 py-5"
            : isAiPage
              ? "mx-auto h-dvh w-full max-w-md overflow-hidden p-0"
              : isLoginPage
                ? "mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-margin-mobile pt-6 pb-6"
                : "mx-auto w-full max-w-md space-y-lg px-margin-mobile pb-[calc(10rem+env(safe-area-inset-bottom))]"
        }
      >
        {children}
      </main>

      {!hideStandardChrome ? <DeveloperSimulationBanner /> : null}

      {/* Bottom Navigation wrapped in Suspense */}
      {!hideStandardChrome && (
        <div hidden={desktop}>
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
        </div>
      )}
    </div>
  );
}
