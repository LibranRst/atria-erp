"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

import { usePermissions } from "@/components/auth/permissions-provider";
import { useProjectState } from "@/features/projects/detail/components/shared/project-state-context";
import { updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import { toast } from "sonner";
import { buildFabActions, getRoleNavItems, type FabAction } from "./bottom-nav-config";
import { BottomNavBackdrop, BottomTabBar, QuickActionFab } from "./bottom-nav-parts";

export function BottomNav(): React.JSX.Element | null {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFabOpen, setIsFabOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [menuHeight, setMenuHeight] = React.useState<number | null>(null);
  const [clickedTabHref, setClickedTabHref] = React.useState<string | null>(null);
  const [hasMounted, setHasMounted] = React.useState(false);
  const [isElevated, setIsElevated] = React.useState(false);

  function handleOpenFab(): void {
    setIsElevated(true);
    setIsFabOpen(true);
  }

  function handleCloseFab(): void {
    setIsFabOpen(false);
  }

  function handleExitComplete(): void {
    setIsElevated(false);
  }

  // Tutup FAB dengan tombol Escape
  React.useEffect(() => {
    if (!isFabOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsFabOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFabOpen]);

  React.useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setHasMounted(true);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setClickedTabHref(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname, searchParams]);

  /*
   * Tab dan aksi cepat dibaca dari izin efektif yang diselesaikan server, bukan
   * dari pencarian UUID peran di peta statis: peran buatan Owner tidak ada di
   * peta itu, sehingga pemegangnya selalu mendarat di bilah "peran tidak
   * dikenal" apa pun izin yang diberikan padanya.
   */
  const permissions = usePermissions();

  const { isLocked, projectId } = useProjectState();
  const isCurrentProjectLocked = React.useMemo(() => {
    return !!(isLocked && projectId && pathname.includes(projectId));
  }, [isLocked, projectId, pathname]);

  const filteredNavItems = React.useMemo(() => getRoleNavItems(permissions), [permissions]);
  const isProjectDetail = pathname.startsWith("/projects/");

  const activeIndex = React.useMemo(() => {
    return filteredNavItems.findIndex((item) => {
      if (clickedTabHref) {
        return item.href === clickedTabHref;
      }
      return item.match(pathname, searchParams);
    });
  }, [filteredNavItems, clickedTabHref, pathname, searchParams]);

  const withQuery = React.useCallback(
    (key: string, value: string = "true", targetPath: string = pathname): string => {
      const params =
        targetPath === pathname
          ? new URLSearchParams(searchParams.toString())
          : new URLSearchParams();
      params.set(key, value);
      const query = params.toString();
      return `${targetPath}${query ? `?${query}` : ""}`;
    },
    [pathname, searchParams],
  );

  const fabActions: readonly FabAction[] = React.useMemo(
    () =>
      buildFabActions({
        permissions,
        pathname,
        isProjectDetail,
        isCurrentProjectLocked,
        withQuery,
      }),
    [isProjectDetail, pathname, permissions, withQuery, isCurrentProjectLocked],
  );

  React.useEffect(() => {
    if (isFabOpen && contentRef.current) {
      setMenuHeight(contentRef.current.scrollHeight);
    } else {
      setMenuHeight(null);
    }
  }, [isFabOpen, fabActions]);

  function handleFabAction(action: FabAction): void {
    setIsFabOpen(false);

    if (action.disabled) {
      toast.error(
        "Aksi Terkunci: Proyek ini belum memiliki RAB yang disetujui. Susun RAP dan approve RAB terlebih dahulu.",
        {
          duration: 4000,
        },
      );
      return;
    }

    const { href } = action;
    try {
      // Check if target is same page (pathname) to open drawer instantly client-side
      const targetUrl = new URL(href, window.location.origin);
      if (targetUrl.pathname === pathname) {
        updateBrowserUrl(href, "push");
        return;
      }
    } catch (err) {
      console.error("Error parsing FAB action URL:", err);
    }

    router.push(href, { scroll: false });
  }

  if (!hasMounted || pathname === "/login") return null;

  return (
    <>
      <div
        aria-hidden="true"
        style={{ height: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md bg-linear-to-t from-background via-background/90 to-transparent"
      />
      <div
        className={`pointer-events-none fixed right-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 mx-auto flex w-fit max-w-md items-center gap-2 select-none ${
          isElevated ? "z-70" : "z-30"
        }`}
      >
        <BottomNavBackdrop
          isOpen={isFabOpen}
          onClose={handleCloseFab}
          onExitComplete={handleExitComplete}
        />
        <BottomTabBar
          activeIndex={activeIndex}
          clickedTabHref={clickedTabHref}
          items={filteredNavItems}
          pathname={pathname}
          searchParams={searchParams}
          onTabClick={setClickedTabHref}
        />
        {fabActions.length > 0 ? (
          <QuickActionFab
            actions={fabActions}
            contentRef={contentRef}
            isOpen={isFabOpen}
            menuHeight={menuHeight}
            onAction={handleFabAction}
            onOpen={handleOpenFab}
          />
        ) : null}
      </div>
    </>
  );
}
