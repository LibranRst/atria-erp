"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCurrentUserProfile } from "@/components/auth/permissions-provider";
import { DesktopUIProvider } from "@/components/ui";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { MobileShell } from "./mobile-shell";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { WorkspaceWorkflows } from "./workspace-workflows";
import { RoleGuideProvider } from "@/features/role-guide/components/role-guide-provider";

function WorkspaceShellContent({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  const params = useSearchParams();
  const user = useCurrentUserProfile();
  const nativeBridge = params.get("surface") === "mobile";
  const presentation = useWorkspaceViewportPresentation(nativeBridge);
  const publicPage =
    pathname === "/login" || pathname === "/setup" || pathname === "/profile/password";
  const desktop = Boolean(user?.id) && presentation === "desktop" && !publicPage;

  // This provider/shell/main chain never changes type or key on resize. Domain
  // drafts, selections and global overlay owners retain their mounted state.
  return (
    <WorkspacePresentationProvider
      presentation={desktop ? "desktop" : "mobile"}
      nativeBridge={nativeBridge}
    >
      <DesktopUIProvider responsive>
        <WorkspaceWorkflows drawersEnabled={!publicPage}>
          <RoleGuideProvider>
            <MobileShell>{children}</MobileShell>
          </RoleGuideProvider>
        </WorkspaceWorkflows>
      </DesktopUIProvider>
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
