"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { isRoleGuideWorkspaceRoute, type OwnRoleGuide } from "@atria/core/onboarding/role-guide";
import { getOwnRoleGuide, acknowledgeOwnRoleGuide } from "@/app/actions/profile/role-guide";
import { useCurrentUserProfile, usePermissions } from "@/components/auth/permissions-provider";
import { useSheetPresenceValue } from "@/components/ui";
import {
  hasWorkspaceInteraction,
  subscribeWorkspaceInteraction,
} from "@/lib/navigation/workspace-interaction";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { RoleGuideSheet } from "./role-guide-sheet";

type RoleGuideContextValue = {
  readonly openGuide: () => void;
  readonly loading: boolean;
  readonly error: string | null;
};
type GuideState = {
  readonly key: string;
  readonly selected: OwnRoleGuide | null;
  readonly candidate: OwnRoleGuide | null;
  readonly loading: boolean;
  readonly error: string | null;
};
const RoleGuideContext = React.createContext<RoleGuideContextValue | null>(null);

export function useRoleGuide(): RoleGuideContextValue | null {
  return React.useContext(RoleGuideContext);
}

export function RoleGuideProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const user = useCurrentUserProfile();
  const permissions = usePermissions();
  const pathname = usePathname();
  const router = useRouter();
  const identity = user?.id ? `${user.id}:${user.sessionId ?? "visit"}` : null;
  const accessKey = JSON.stringify([user?.roleId, user?.dataScope, permissions.toSorted()]);
  const eligible = identity !== null && isRoleGuideWorkspaceRoute(pathname);
  const requestKey = JSON.stringify([identity, accessKey, pathname]);
  const [state, setState] = React.useState<GuideState>({
    key: requestKey,
    selected: null,
    candidate: null,
    loading: false,
    error: null,
  });
  // Reset dependent state during render without remounting the provider or its workflow children.
  if (state.key !== requestKey) {
    setState({ key: requestKey, selected: null, candidate: null, loading: false, error: null });
  }
  const { selected, candidate, loading, error } = state;
  const updateState = React.useCallback(
    (patch: Partial<Omit<GuideState, "key">>): void => {
      setState((current) => (current.key === requestKey ? { ...current, ...patch } : current));
    },
    [requestKey],
  );
  const dismissed = React.useRef(new Set<string>());
  const requestEpoch = React.useRef(0);
  const requestMode = React.useRef<{ readonly key: string; readonly manual: boolean } | null>(null);
  const nextHref = React.useRef<string | null>(null);
  const { presentedValue, open, handleExitComplete } = useSheetPresenceValue(
    eligible ? selected : null,
    eligible ? selected?.contextKey : null,
  );
  const storageKey = React.useCallback(
    (contextKey: string): string => `atria:role-guide:v1:${identity}:${contextKey}`,
    [identity],
  );
  const wasDismissed = React.useCallback(
    (contextKey: string): boolean => {
      const key = storageKey(contextKey);
      if (dismissed.current.has(key)) return true;
      try {
        return sessionStorage.getItem(key) === "seen";
      } catch {
        return false;
      }
    },
    [storageKey],
  );

  const loadGuide = React.useCallback(
    async (manual: boolean): Promise<void> => {
      if (!eligible) return;
      // A delayed first-run request must never supersede a user's explicit replay.
      if (!manual && requestMode.current?.key === requestKey && requestMode.current.manual) return;
      requestMode.current = { key: requestKey, manual };
      const epoch = ++requestEpoch.current;
      if (manual) updateState({ loading: true, error: null, candidate: null });
      try {
        const result = await getOwnRoleGuide();
        if (epoch !== requestEpoch.current) return;
        if (!result.success) {
          if (manual) updateState({ error: "Panduan belum dapat dimuat. Coba lagi." });
          return;
        }
        if (manual) {
          updateState({ candidate: null, selected: result.data });
        } else if (result.data.shouldAutoShow && !wasDismissed(result.data.contextKey)) {
          updateState({ candidate: result.data });
        }
      } catch {
        if (manual && epoch === requestEpoch.current)
          updateState({ error: "Panduan belum dapat dimuat. Coba lagi." });
      } finally {
        if (manual && epoch === requestEpoch.current) updateState({ loading: false });
      }
    },
    [eligible, wasDismissed, updateState, requestKey],
  );

  React.useEffect(() => {
    // Invalidate late responses on account, route, or permission changes.
    nextHref.current = null;
    const frame = requestAnimationFrame((): void => {
      void loadGuide(false);
    });
    return (): void => {
      cancelAnimationFrame(frame);
      requestEpoch.current += 1;
    };
  }, [identity, accessKey, pathname, loadGuide]);

  React.useEffect(() => {
    if (!eligible || !candidate || selected) return;
    function showWhenIdle(): void {
      if (!candidate || hasWorkspaceInteraction(document) || wasDismissed(candidate.contextKey))
        return;
      updateState({ selected: candidate, candidate: null });
    }
    // Let route drawers and autofocus register before attempting a first presentation.
    const frame = requestAnimationFrame(showWhenIdle);
    const unsubscribe = subscribeWorkspaceInteraction(showWhenIdle);
    return (): void => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [candidate, eligible, selected, wasDismissed, updateState]);

  const closeGuide = React.useCallback((): void => {
    if (selected) {
      const key = storageKey(selected.contextKey);
      dismissed.current.add(key);
      try {
        sessionStorage.setItem(key, "seen");
      } catch {
        /* In-memory suppression still works. */
      }
      if (selected.canAcknowledge) {
        // Saving is best-effort. A failed receipt must never trap the user in this panel.
        void acknowledgeOwnRoleGuide({ contextKey: selected.contextKey }).catch(
          (): void => undefined,
        );
      }
    }
    updateState({ selected: null, candidate: null });
  }, [selected, storageKey, updateState]);
  const start = React.useCallback((): void => {
    if (!selected) return;
    nextHref.current = selected.primaryAction.href;
    closeGuide();
  }, [selected, closeGuide]);
  const finishExit = React.useCallback((): void => {
    handleExitComplete();
    const href = nextHref.current;
    nextHref.current = null;
    if (href) router.push(href);
  }, [handleExitComplete, router]);
  const openGuide = React.useCallback((): void => {
    void loadGuide(true);
  }, [loadGuide]);
  const value = React.useMemo(() => ({ openGuide, loading, error }), [openGuide, loading, error]);

  return (
    <RoleGuideContext.Provider value={value}>
      {children}
      <RoleGuideSheet
        guide={presentedValue}
        open={open}
        onClose={closeGuide}
        onStart={start}
        onExitComplete={finishExit}
      />
    </RoleGuideContext.Provider>
  );
}
