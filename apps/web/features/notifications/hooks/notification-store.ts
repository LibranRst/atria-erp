import type {
  NotificationCategory,
  NotificationPage,
  NotificationSummary,
  NotificationListInput,
} from "@atria/core/notifications/types";
import type { ActionResponse } from "@atria/core/types/action-response";
export type NotificationTransport = {
  open?: (input: { id: string }) => Promise<ActionResponse<{ url: string }>>;
  summary: () => Promise<ActionResponse<NotificationSummary>>;
  list: (input: NotificationListInput) => Promise<ActionResponse<NotificationPage>>;
  mark: (input: { id: string }) => Promise<ActionResponse<{ success: boolean }>>;
  markAll: (input: {
    category?: NotificationCategory;
  }) => Promise<ActionResponse<{ success: boolean }>>;
};
export type NotificationEnvironment = {
  available: () => boolean;
  streamHealthy?: () => boolean;
  scheduleRefresh?: (callback: () => void, delay: number) => () => void;
  subscribe: (resume: () => void) => () => void;
  reportError: (message: string) => void;
};
export type NotificationStoreState = {
  summary: NotificationSummary;
  pages: Record<NotificationCategory, NotificationPage>;
  isLoading: boolean;
  error: string | null;
  pending: boolean;
};
export const NOTIFICATION_FALLBACK_REFRESH_MS = 120_000;
const NOTIFICATION_MAX_BACKOFF_MS = 300_000;
function empty(): NotificationStoreState {
  return {
    summary: { unreadCount: 0, actionRequiredCount: 0, informationalUnreadCount: 0, items: [] },
    pages: {
      ACTION_REQUIRED: { items: [], hasMore: false, nextCursor: null },
      INFORMATIONAL: { items: [], hasMore: false, nextCursor: null },
    },
    isLoading: true,
    error: null,
    pending: false,
  };
}
export function createNotificationStore(
  api: NotificationTransport,
  environment: NotificationEnvironment,
): {
  subscribe: (listener: () => void) => () => void;
  snapshot: () => NotificationStoreState;
  refresh: () => Promise<void>;
  loadMore: (category: NotificationCategory) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: (category?: NotificationCategory) => Promise<void>;
  openNotification: (id: string) => Promise<ActionResponse<{ url: string }>>;
  start: () => () => void;
} {
  let state = empty();
  const listeners = new Set<() => void>();
  let generation = 0;
  let fetchingGeneration: number | null = null;
  let failures = 0;
  let active = false;
  let cancelRefresh: (() => void) | undefined;
  const scheduleRefresh =
    environment.scheduleRefresh ??
    ((callback: () => void, delay: number): (() => void) => {
      const timer = setTimeout(callback, delay);
      return () => clearTimeout(timer);
    });
  const emit = (next: NotificationStoreState): void => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const available = (): boolean => active && environment.available();
  async function refresh(): Promise<void> {
    if (!available() || fetchingGeneration === generation || state.pending) return;
    const version = generation;
    fetchingGeneration = version;
    try {
      const [summary, action, info] = await Promise.all([
        api.summary(),
        api.list({ category: "ACTION_REQUIRED" }),
        api.list({ category: "INFORMATIONAL" }),
      ]);
      if (!active || version !== generation) return;
      if (!summary.success && summary.error.code === "UNAUTHORIZED") {
        emit({ ...empty(), isLoading: false, error: summary.error.message });
        return;
      }
      if (
        !summary.success ||
        !summary.data ||
        !action.success ||
        !action.data ||
        !info.success ||
        !info.data
      )
        throw new Error("Notifikasi belum tersinkron. Coba lagi.");
      failures = 0;
      // Refresh loaded pages without retaining records whose authorization may have changed.
      const refreshed: Record<NotificationCategory, NotificationPage> = {
        ACTION_REQUIRED: action.data,
        INFORMATIONAL: info.data,
      };
      for (const category of ["ACTION_REQUIRED", "INFORMATIONAL"] as const) {
        const wanted = state.pages[category].items.length;
        while (refreshed[category].hasMore && refreshed[category].items.length < wanted) {
          const next = await api.list({
            category,
            cursor: refreshed[category].nextCursor ?? undefined,
          });
          if (!next.success || !next.data)
            throw new Error("Notifikasi belum tersinkron. Coba lagi.");
          refreshed[category] = {
            ...next.data,
            items: [...refreshed[category].items, ...next.data.items],
          };
        }
      }
      if (active && version === generation)
        emit({ ...state, summary: summary.data, pages: refreshed, error: null, isLoading: false });
    } catch (error) {
      failures += 1;
      if (active && version === generation)
        emit({
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : "Gagal memuat notifikasi.",
        });
    } finally {
      if (fetchingGeneration === version) fetchingGeneration = null;
    }
  }
  async function loadMore(category: NotificationCategory): Promise<void> {
    if (fetchingGeneration === generation || state.pending || !state.pages[category].nextCursor)
      return;
    const version = generation;
    fetchingGeneration = version;
    try {
      const res = await api.list({
        category,
        cursor: state.pages[category].nextCursor ?? undefined,
      });
      if (!res.success || !res.data) throw new Error("Daftar belum berhasil dimuat.");
      if (active && version === generation)
        emit({
          ...state,
          pages: {
            ...state.pages,
            [category]: {
              ...res.data,
              items: [
                ...new Map(
                  [...state.pages[category].items, ...res.data.items].map((item) => [
                    item.id,
                    item,
                  ]),
                ).values(),
              ],
            },
          },
          error: null,
        });
    } catch {
      if (active && version === generation)
        emit({ ...state, error: "Daftar belum berhasil dimuat. Coba lagi." });
    } finally {
      if (fetchingGeneration === version) fetchingGeneration = null;
    }
  }
  async function mark(id?: string, category?: NotificationCategory): Promise<void> {
    if (state.pending) return;
    generation += 1;
    const before = state;
    const matches = (item: NotificationPage["items"][number]): boolean =>
      id ? item.id === id : !category || item.category === category;
    const pages = { ...state.pages };
    let changed = 0;
    for (const key of ["ACTION_REQUIRED", "INFORMATIONAL"] as const) {
      pages[key] = {
        ...pages[key],
        items: pages[key].items.map((item) => {
          if (!item.read && matches(item)) {
            changed += 1;
            return { ...item, read: true };
          }
          return item;
        }),
      };
    }
    const informationRead = id
      ? before.pages.INFORMATIONAL.items.filter((item) => item.id === id && !item.read).length
      : category === "ACTION_REQUIRED"
        ? 0
        : before.summary.informationalUnreadCount;
    const unreadCount = id
      ? Math.max(0, before.summary.unreadCount - changed)
      : category === "INFORMATIONAL"
        ? before.summary.unreadCount - before.summary.informationalUnreadCount
        : category === "ACTION_REQUIRED"
          ? before.summary.informationalUnreadCount
          : 0;
    emit({
      ...state,
      pages,
      pending: true,
      summary: {
        ...state.summary,
        unreadCount,
        informationalUnreadCount: Math.max(
          0,
          before.summary.informationalUnreadCount - informationRead,
        ),
      },
    });
    try {
      const res = id ? await api.mark({ id }) : await api.markAll({ category });
      if (!res.success) throw new Error(res.error?.message ?? "Status baca belum tersimpan.");
      if (active) emit({ ...state, pending: false });
    } catch (error) {
      if (active) {
        emit({ ...before, pending: false });
        environment.reportError(
          error instanceof Error ? error.message : "Status baca belum tersimpan.",
        );
      }
    }
    // A previous poll may still be in flight; the next scheduled refresh also reconciles.
    await refresh();
  }
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => state,
    refresh,
    loadMore,
    openNotification: (id) =>
      api.open
        ? api.open({ id })
        : Promise.resolve({
            success: false,
            error: { code: "NOT_FOUND", message: "Tujuan tidak tersedia." },
          }),
    markAsRead: (id) => mark(id),
    markAllAsRead: (category) => mark(undefined, category),
    start: () => {
      active = true;
      const tick = async (force = false): Promise<void> => {
        if (force || failures > 0 || state.isLoading || !environment.streamHealthy?.()) {
          await refresh();
        }
        if (active) {
          cancelRefresh?.();
          cancelRefresh = scheduleRefresh(
            () => {
              void tick();
            },
            Math.min(
              NOTIFICATION_MAX_BACKOFF_MS,
              NOTIFICATION_FALLBACK_REFRESH_MS * 2 ** Math.max(0, failures - 1),
            ),
          );
        }
      };
      const resume = (): void => {
        if (available()) {
          cancelRefresh?.();
          void tick(true);
        }
      };
      void tick(true);
      const unsubscribe = environment.subscribe(resume);
      return () => {
        active = false;
        generation += 1;
        cancelRefresh?.();
        unsubscribe();
      };
    },
  };
}
