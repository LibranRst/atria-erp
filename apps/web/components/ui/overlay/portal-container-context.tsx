"use client";

import React from "react";

const PortalContainerContext = React.createContext<HTMLElement | null>(null);

function subscribeToBody(): () => void {
  return (): void => undefined;
}

function getBody(): HTMLElement {
  return document.body;
}

function getServerBody(): null {
  return null;
}

/** One destination for shared overlays; existing routes retain document.body. */
export function PortalContainerProvider({
  container,
  children,
}: {
  readonly container: HTMLElement | null;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
  );
}

export function usePortalContainer(): HTMLElement | null {
  const container = React.useContext(PortalContainerContext);
  const body = React.useSyncExternalStore(subscribeToBody, getBody, getServerBody);
  return container ?? body;
}
