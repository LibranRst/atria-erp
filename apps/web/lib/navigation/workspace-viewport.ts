"use client";

import { useSyncExternalStore } from "react";
import { resolveWorkspacePresentation, type WorkspacePresentation } from "./workspace-routes";

function subscribeViewport(listener: () => void): () => void {
  window.addEventListener("resize", listener);
  return (): void => window.removeEventListener("resize", listener);
}

function desktopViewport(): boolean {
  return resolveWorkspacePresentation(window.innerWidth) === "desktop";
}

function serverViewport(): boolean {
  return false;
}

/** Viewport changes presentation only; there is no navigation or authorization side effect. */
export function useWorkspaceViewportPresentation(nativeBridge = false): WorkspacePresentation {
  const wide = useSyncExternalStore(subscribeViewport, desktopViewport, serverViewport);
  return wide && !nativeBridge ? "desktop" : "mobile";
}
