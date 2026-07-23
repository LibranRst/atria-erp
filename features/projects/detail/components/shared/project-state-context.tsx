"use client";

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

interface ProjectState {
  projectId: string | null;
  isLocked: boolean;
}

interface ProjectStateContextValue extends ProjectState {
  setProjectState: (state: ProjectState) => void;
}

const ProjectStateContext = createContext<ProjectStateContextValue | undefined>(undefined);

export function ProjectStateProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [state, setState] = useState<ProjectState>({
    projectId: null,
    isLocked: false,
  });

  const setProjectState = useCallback((newState: ProjectState) => {
    setState((prev) => {
      if (prev.projectId === newState.projectId && prev.isLocked === newState.isLocked) {
        return prev;
      }
      return newState;
    });
  }, []);

  const value = useMemo(
    () => ({
      projectId: state.projectId,
      isLocked: state.isLocked,
      setProjectState,
    }),
    [state.projectId, state.isLocked, setProjectState],
  );

  return <ProjectStateContext.Provider value={value}>{children}</ProjectStateContext.Provider>;
}

export function useProjectState(): ProjectStateContextValue {
  const context = useContext(ProjectStateContext);
  if (context === undefined) {
    throw new Error("useProjectState must be used within a ProjectStateProvider");
  }
  return context;
}
