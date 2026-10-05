"use client";

import { createContext, useCallback, useContext } from "react";
import { workspaceHref, type WorkspacePresentation } from "@/lib/navigation/workspace-routes";

const WorkspaceContext = createContext<{
  readonly presentation: WorkspacePresentation;
  readonly nativeBridge: boolean;
}>({ presentation: "mobile", nativeBridge: false });

export function WorkspacePresentationProvider({
  presentation,
  nativeBridge = false,
  children,
}: {
  readonly presentation: WorkspacePresentation;
  readonly nativeBridge?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <WorkspaceContext.Provider value={{ presentation, nativeBridge }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspacePresentation(): WorkspacePresentation {
  return useContext(WorkspaceContext).presentation;
}

export function useWorkspaceHref(): (href: string) => string {
  const { presentation, nativeBridge } = useContext(WorkspaceContext);
  return useCallback(
    (href: string): string => workspaceHref(href, presentation, nativeBridge),
    [presentation, nativeBridge],
  );
}
