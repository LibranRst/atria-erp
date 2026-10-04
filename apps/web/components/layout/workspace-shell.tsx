"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useCurrentUserProfile, usePermission } from "@/components/auth/permissions-provider";
import { DesktopUIProvider } from "@/components/ui";
import { resolveWorkspaceEntry } from "@/lib/navigation/workspace-routes";
import { MobileShell } from "./mobile-shell";
import { AdminShell } from "./admin-shell";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { WorkspaceWorkflows } from "./workspace-workflows";
import { readWorkspacePreference } from "./workspace-preference";

/** Defaults to automatic entry; an explicit false is the rollout/rollback override. */
const AUTOMATIC_DESKTOP_ENABLED = process.env.NEXT_PUBLIC_DESKTOP_ADMIN_AUTO !== "false";

function WorkspaceShellContent({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const allowed = usePermission("use:desktop_admin");
  const user = useCurrentUserProfile();
  const entered = useRef(false);
  const nativeBridge = params.get("surface") === "mobile";
  const desktop =
    (pathname === "/admin" || pathname.startsWith("/admin/")) && allowed && !nativeBridge;
  const publicPage =
    pathname === "/login" || pathname === "/setup" || pathname === "/profile/password";
  useEffect(() => {
    if (entered.current || !user?.id || publicPage) return;
    entered.current = true;
    const href = `${pathname}${params.size ? `?${params.toString()}` : ""}${window.location.hash}`;
    const target = resolveWorkspaceEntry({
      href,
      canUseDesktop: allowed,
      viewportWidth: window.innerWidth,
      preference: readWorkspacePreference(user.id),
      nativeBridge,
      automaticEnabled: AUTOMATIC_DESKTOP_ENABLED,
    });
    if (target !== href) router.replace(target);
  }, [allowed, nativeBridge, params, pathname, publicPage, router, user?.id]);
  const content = (
    <WorkspaceWorkflows drawersEnabled={!publicPage}>
      {desktop ? <AdminShell>{children}</AdminShell> : <MobileShell>{children}</MobileShell>}
    </WorkspaceWorkflows>
  );
  return (
    <WorkspacePresentationProvider
      presentation={desktop ? "desktop" : "mobile"}
      nativeBridge={nativeBridge}
    >
      {desktop ? <DesktopUIProvider>{content}</DesktopUIProvider> : content}
    </WorkspacePresentationProvider>
  );
}

export function WorkspaceShell({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <WorkspaceShellContent>{children}</WorkspaceShellContent>
    </Suspense>
  );
}
