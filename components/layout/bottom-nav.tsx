"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

import { authClient } from "@/lib/auth-client";
import { ROLE_ID_TO_NAME } from "@/lib/auth/permissions";
import { useProjectState } from "@/features/projects/detail/components/project-state-context";
import { updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import { toast } from "sonner";
import {
  buildFabActions,
  getRoleNavItems,
  type FabAction,
  type SessionUserWithRole,
} from "./bottom-nav-config";
import { BottomNavBackdrop, BottomTabBar, QuickActionFab } from "./bottom-nav-parts";

export function BottomNav(): React.JSX.Element | null {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const [isFabOpen, setIsFabOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [menuHeight, setMenuHeight] = React.useState<number | null>(null);
  const [clickedTabHref, setClickedTabHref] = React.useState<string | null>(null);
  const [hasMounted, setHasMounted] = React.useState(false);

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

  const roleId = session?.user ? (session.user as SessionUserWithRole).roleId : null;
  const roleName = roleId ? ROLE_ID_TO_NAME[roleId] : null;

  const { isLocked, projectId } = useProjectState();
  const isCurrentProjectLocked = React.useMemo(() => {
    return !!(isLocked && projectId && pathname.includes(projectId));
  }, [isLocked, projectId, pathname]);

  const filteredNavItems = React.useMemo(() => getRoleNavItems(roleName), [roleName]);
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
        roleName,
        pathname,
        isProjectDetail,
        isCurrentProjectLocked,
        withQuery,
      }),
    [isProjectDetail, pathname, roleName, withQuery, isCurrentProjectLocked],
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
      <div className="pointer-events-none fixed right-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 z-30 mx-auto flex h-14 w-[calc(100%-2rem)] max-w-md items-center gap-2 select-none">
        <BottomNavBackdrop isOpen={isFabOpen} onClose={() => setIsFabOpen(false)} />
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
            onOpen={() => setIsFabOpen(true)}
          />
        ) : null}
      </div>
    </>
  );
}
