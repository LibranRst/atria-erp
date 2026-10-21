"use client";

import React from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { createPortal } from "react-dom";
import { I18nProvider, RouterProvider } from "@heroui/react";
import { UNSAFE_PortalProvider } from "@react-aria/overlays";
import { PortalContainerProvider, usePortalContainer } from "../overlay/portal-container-context";
import {
  useWorkspaceControlPresentation,
  useWorkspacePresentation,
} from "@/lib/navigation/workspace-presentation";
import "./heroui-scoped.css";

export type DesktopUIProviderProps = {
  readonly children: React.ReactNode;
  readonly className?: string;
  /** Standalone stories may keep the desktop scope; the app derives scope from presentation. */
  readonly responsive?: boolean;
};

/** Theme and portal destination only; shared overlays continue to own modal behavior. */
export function DesktopUIProvider({
  children,
  className,
  responsive = false,
}: DesktopUIProviderProps): React.JSX.Element {
  const router = useRouter();
  const body = usePortalContainer();
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const desktop = useWorkspacePresentation() === "desktop";
  const desktopControls = useWorkspaceControlPresentation() === "desktop";
  const scopeContent = !responsive || desktop || desktopControls;
  // A resized review may contain a desktop table while its focused controls
  // retain their mobile presenter. Both still need the shared theme scope.
  const scopePortal = !responsive || desktop || desktopControls;
  const getContainer = React.useCallback(
    (): HTMLElement | null => container ?? body,
    [container, body],
  );

  return (
    <RouterProvider navigate={(href: string): void => router.push(href)}>
      <I18nProvider locale="id-ID">
        <UNSAFE_PortalProvider getContainer={getContainer}>
          <PortalContainerProvider container={container}>
            <div data-atria-admin={scopeContent ? "" : undefined} className={className}>
              {children}
            </div>
            {body
              ? createPortal(
                  <div
                    data-atria-admin={scopePortal ? "" : undefined}
                    data-atria-admin-portal=""
                    ref={setContainer}
                  />,
                  body,
                )
              : null}
          </PortalContainerProvider>
        </UNSAFE_PortalProvider>
      </I18nProvider>
    </RouterProvider>
  );
}
