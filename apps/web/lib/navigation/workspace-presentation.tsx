"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { workspaceHref, type WorkspacePresentation } from "@/lib/navigation/workspace-routes";
import { hasWorkspaceInteraction, subscribeWorkspaceInteraction } from "./workspace-interaction";

const WorkspaceContext = createContext<{
  readonly presentation: WorkspacePresentation;
  readonly controlPresentation: WorkspacePresentation;
  readonly nativeBridge: boolean;
}>({ presentation: "mobile", controlPresentation: "mobile", nativeBridge: false });

export function WorkspacePresentationProvider({
  presentation,
  nativeBridge = false,
  children,
}: {
  readonly presentation: WorkspacePresentation;
  readonly nativeBridge?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [controlPresentation, setControlPresentation] = useState(presentation);
  useEffect(() => {
    function syncControls(): void {
      if (!hasWorkspaceInteraction(document)) setControlPresentation(presentation);
    }
    syncControls();
    return subscribeWorkspaceInteraction(syncControls);
  }, [presentation]);

  return (
    <WorkspaceContext.Provider value={{ presentation, controlPresentation, nativeBridge }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspacePresentation(): WorkspacePresentation {
  return useContext(WorkspaceContext).presentation;
}

/** Controls keep their DOM and overlay owner while focused or open; layout remains responsive. */
export function useWorkspaceControlPresentation(): WorkspacePresentation {
  return useContext(WorkspaceContext).controlPresentation;
}

export function useWorkspaceHref(): (href: string) => string {
  const { presentation, nativeBridge } = useContext(WorkspaceContext);
  return useCallback(
    (href: string): string => workspaceHref(href, presentation, nativeBridge),
    [presentation, nativeBridge],
  );
}
