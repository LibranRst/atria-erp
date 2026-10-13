export interface UnsavedDraft {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly label: string;
}

export interface UnsavedSnapshot {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly label: string;
}

const EMPTY: UnsavedSnapshot = { dirty: false, pending: false, label: "perubahan" };

export function createUnsavedChangesStore(): {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => UnsavedSnapshot;
  readonly getServerSnapshot: () => UnsavedSnapshot;
  readonly register: (id: string, draft: UnsavedDraft) => void;
  readonly remove: (id: string) => void;
} {
  const drafts = new Map<string, UnsavedDraft>();
  const listeners = new Set<() => void>();
  let snapshot = EMPTY;
  function publish(): void {
    const active = [...drafts.values()].filter((draft) => draft.dirty || draft.pending);
    const next: UnsavedSnapshot = {
      dirty: active.some((draft) => draft.dirty),
      pending: active.some((draft) => draft.pending),
      label: active[0]?.label ?? EMPTY.label,
    };
    if (
      next.dirty === snapshot.dirty &&
      next.pending === snapshot.pending &&
      next.label === snapshot.label
    )
      return;
    snapshot = next;
    for (const listener of listeners) listener();
  }
  return {
    subscribe: (listener): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: (): UnsavedSnapshot => snapshot,
    getServerSnapshot: (): UnsavedSnapshot => EMPTY,
    register: (id, draft): void => {
      drafts.set(id, draft);
      publish();
    },
    remove: (id): void => {
      drafts.delete(id);
      publish();
    },
  };
}

export interface LeaveDestination {
  readonly href: string;
  readonly external: boolean;
  readonly leavesPage: boolean;
}

export function leaveDestination(href: string, currentHref: string): LeaveDestination | null {
  let target: URL;
  let current: URL;
  try {
    current = new URL(currentHref);
    target = new URL(href, current);
  } catch {
    return null;
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return null;
  const external = target.origin !== current.origin;
  return {
    href: external ? target.href : `${target.pathname}${target.search}${target.hash}`,
    external,
    leavesPage:
      external || target.pathname !== current.pathname || target.search !== current.search,
  };
}

export function leaveDecision(
  snapshot: UnsavedSnapshot,
  leavesPage = true,
): "allow" | "confirm" | "pending" {
  if (!leavesPage) return "allow";
  if (snapshot.pending) return "pending";
  return snapshot.dirty ? "confirm" : "allow";
}
