"use client";

import React from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { createPortal } from "react-dom";
import { I18nProvider, RouterProvider } from "@heroui/react";
import { UNSAFE_PortalProvider } from "@react-aria/overlays";
import { PortalContainerProvider, usePortalContainer } from "../overlay/portal-container-context";
import "./heroui-scoped.css";

export type DesktopUIProviderProps = {
  readonly children: React.ReactNode;
  readonly className?: string;
};

/** Theme and portal destination only; shared overlays continue to own modal behavior. */
export function DesktopUIProvider({
  children,
  className,
}: DesktopUIProviderProps): React.JSX.Element {
  const router = useRouter();
  const body = usePortalContainer();
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const getContainer = React.useCallback(
    (): HTMLElement | null => container ?? body,
    [container, body],
  );

  return (
    <RouterProvider navigate={(href: string): void => router.push(href)}>
      <I18nProvider locale="id-ID">
        <UNSAFE_PortalProvider getContainer={getContainer}>
          <PortalContainerProvider container={container}>
            <div data-atria-admin="" className={className}>
              {children}
            </div>
            {body
              ? createPortal(
                  <div data-atria-admin="" data-atria-admin-portal="" ref={setContainer} />,
                  body,
                )
              : null}
          </PortalContainerProvider>
        </UNSAFE_PortalProvider>
      </I18nProvider>
    </RouterProvider>
  );
}
