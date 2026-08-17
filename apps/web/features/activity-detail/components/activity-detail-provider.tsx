"use client";

import React from "react";

import { AppIcon } from "@/components/ui";
import type { ActivityDetailKind, ActivityDetailRequest } from "@/lib/activity-detail/types";
import {
  ActivityDetailSheet,
  type ActivityDetailFooterStatus,
  type ActivityDetailSheetActions,
} from "./activity-detail-sheet";

export type ActivityDetailOpenOptions = {
  readonly actions?: ActivityDetailSheetActions;
  readonly footerStatus?: ActivityDetailFooterStatus;
};

type ActivityDetailContextValue = {
  readonly activeId: string | null;
  readonly setActiveId: (id: string | null) => void;
  readonly openActivityDetail: (
    target: string | ActivityDetailRequest,
    options?: ActivityDetailOpenOptions,
  ) => void;
};

const ActivityDetailContext = React.createContext<ActivityDetailContextValue>({
  activeId: null,
  setActiveId: () => undefined,
  openActivityDetail: () => undefined,
});

export function useActivityDetail(): ActivityDetailContextValue {
  return React.useContext(ActivityDetailContext);
}

export function ActivityDetailChevron({
  className,
}: {
  readonly className?: string;
}): React.JSX.Element {
  return (
    <AppIcon
      name="chevron_right"
      className={`h-4 w-4 shrink-0 text-on-surface-variant/45 ${className ?? ""}`}
    />
  );
}

export function ActivityDetailProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const [state, setState] = React.useState<{
    readonly request: ActivityDetailRequest;
    readonly options?: ActivityDetailOpenOptions;
  } | null>(null);
  const pendingActionRef = React.useRef<(() => void) | null>(null);

  const openActivityDetail = React.useCallback(
    (target: string | ActivityDetailRequest, options?: ActivityDetailOpenOptions): void => {
      let normalized: ActivityDetailRequest;
      if (typeof target === "string") {
        try {
          const parsed = JSON.parse(target);
          if (parsed && typeof parsed === "object" && "kind" in parsed && "id" in parsed) {
            normalized = { kind: parsed.kind as ActivityDetailKind, id: String(parsed.id) };
          } else if (target.includes(":")) {
            const [kind, id] = target.split(":");
            normalized = { kind: kind as ActivityDetailKind, id };
          } else {
            normalized = { kind: "PROJECT_COST", id: target };
          }
        } catch {
          if (target.includes(":")) {
            const [kind, id] = target.split(":");
            normalized = { kind: kind as ActivityDetailKind, id };
          } else {
            normalized = { kind: "PROJECT_COST", id: target };
          }
        }
      } else {
        normalized = target;
      }
      setState(options ? { request: normalized, options } : { request: normalized });
    },
    [],
  );

  const setActiveId = React.useCallback(
    (id: string | null): void => {
      if (!id) {
        setState(null);
      } else {
        openActivityDetail({ kind: "PROJECT_COST", id });
      }
    },
    [openActivityDetail],
  );

  const activeId = state?.request.id ?? null;

  const deferredActions = React.useMemo((): ActivityDetailSheetActions | undefined => {
    const actions = state?.options?.actions;
    if (!actions) return undefined;
    const secondary = actions.secondary;
    const defer = (action: () => void): void => {
      pendingActionRef.current = action;
      setState(null);
    };
    return {
      primary: {
        label: actions.primary.label,
        onClick: () => defer(actions.primary.onClick),
      },
      secondary: secondary
        ? {
            label: secondary.label,
            onClick: () => defer(secondary.onClick),
          }
        : undefined,
    };
  }, [state]);

  const finishSheetExit = React.useCallback((): void => {
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    pendingAction?.();
  }, []);

  const context = React.useMemo(
    () => ({ activeId, setActiveId, openActivityDetail }),
    [activeId, setActiveId, openActivityDetail],
  );

  return (
    <ActivityDetailContext.Provider value={context}>
      {children}
      <ActivityDetailSheet
        target={state?.request ?? null}
        actions={deferredActions}
        footerStatus={state?.options?.footerStatus}
        onClose={() => setState(null)}
        onExitComplete={finishSheetExit}
      />
    </ActivityDetailContext.Provider>
  );
}

export { ActivityDetailSheet };
