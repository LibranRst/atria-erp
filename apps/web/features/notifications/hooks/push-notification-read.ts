import { z } from "zod";

import { markNotificationReadSchema, safeNotificationUrl } from "@atria/core/notifications/types";
import type { ActionResponse } from "@atria/core/types/action-response";
import { subscribeToUrl, updateUrlSearchParam } from "@/lib/utils/use-url-search-param";

const STORAGE_KEY = "atria:push-notification-read";
const MAX_STORED_LENGTH = 512;
const pendingSchema = z.object({
  id: markNotificationReadSchema.shape.id,
  userId: z.string().min(1).max(128).nullable(),
});
type PendingRead = z.infer<typeof pendingSchema>;

export type PushNotificationReadOptions = {
  readonly userId: string | null;
  readonly markRead: (input: {
    readonly id: string;
  }) => Promise<ActionResponse<{ success: boolean }>>;
  readonly onRead: () => Promise<void>;
};

export type PushNotificationReadRuntime = {
  readonly marker: () => string | null;
  readonly clearMarker: (id: string) => void;
  readonly readPending: () => string | null;
  readonly writePending: (value: string) => void;
  readonly removePending: () => void;
  readonly available: () => boolean;
  readonly subscribe: (resume: () => void) => () => void;
};

function validId(value: string | null): string | null {
  const parsed = markNotificationReadSchema.safeParse({ id: value });
  return parsed.success ? parsed.data.id : null;
}

function loginReturnUrl(): URL | null {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  const safe = safeNotificationUrl(value);
  return safe ? new URL(safe, window.location.origin) : null;
}

const browser: PushNotificationReadRuntime = {
  marker: (): string | null => {
    if (typeof window === "undefined") return null;
    return (
      new URLSearchParams(window.location.search).get("notificationId") ??
      loginReturnUrl()?.searchParams.get("notificationId") ??
      null
    );
  },
  clearMarker: (id: string): void => {
    if (new URLSearchParams(window.location.search).get("notificationId") === id)
      updateUrlSearchParam("notificationId", null, "replace");
    const returnUrl = loginReturnUrl();
    if (returnUrl?.searchParams.get("notificationId") === id) {
      returnUrl.searchParams.delete("notificationId");
      updateUrlSearchParam(
        "returnTo",
        `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`,
        "replace",
      );
    }
  },
  readPending: (): string | null => window.sessionStorage.getItem(STORAGE_KEY),
  writePending: (value: string): void => window.sessionStorage.setItem(STORAGE_KEY, value),
  removePending: (): void => window.sessionStorage.removeItem(STORAGE_KEY),
  available: (): boolean =>
    typeof window !== "undefined" && navigator.onLine && document.visibilityState !== "hidden",
  subscribe: (resume: () => void): (() => void) => {
    if (typeof window === "undefined") return (): void => undefined;
    const stopUrl = subscribeToUrl(resume);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return (): void => {
      stopUrl();
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  },
};

/** Tray clicks navigate first; this session-scoped controller acknowledges them afterward. */
export function startPushNotificationRead(
  options: PushNotificationReadOptions,
  runtime: PushNotificationReadRuntime = browser,
): () => void {
  let pending: PendingRead | null = null;
  let completedId: string | null = null;
  let inFlight = false;
  let disposed = false;

  function persist(): void {
    try {
      if (pending) runtime.writePending(JSON.stringify(pending));
      else runtime.removePending();
    } catch {
      // Storage can be denied. Keep the live intent and URL until the server acknowledges it.
    }
  }

  function clearMarker(id: string): void {
    try {
      runtime.clearMarker(id);
    } catch {
      // A history/storage restriction must not interrupt navigation or acknowledgment.
    }
  }

  try {
    const stored = runtime.readPending();
    if (stored && stored.length <= MAX_STORED_LENGTH) {
      const value: unknown = JSON.parse(stored);
      const parsed = pendingSchema.safeParse(value);
      if (parsed.success) pending = parsed.data;
      else persist();
    } else if (stored) persist();
  } catch {
    // A malformed or inaccessible saved intent must not prevent a new tray click.
  }

  async function submit(): Promise<void> {
    if (disposed || inFlight || !pending || !options.userId) return;
    try {
      if (!runtime.available()) return;
    } catch {
      return;
    }
    const intent = pending;
    inFlight = true;
    try {
      const result = await options.markRead({ id: intent.id });
      if (disposed || !result.success || !result.data.success) return;
      completedId = intent.id;
      if (pending === intent) {
        pending = null;
        persist();
      }
      clearMarker(intent.id);
      await options.onRead();
    } catch {
      // Retry on the next online/focus/URL/session event, never in a polling loop.
    } finally {
      inFlight = false;
      // A second click may have replaced the one-entry intent while this request ran.
      if (!disposed && pending && pending !== intent) void submit();
    }
  }

  function resume(): void {
    if (disposed) return;
    let marker: string | null = null;
    try {
      marker = validId(runtime.marker());
    } catch {
      // The stored intent can still be retried if reading the current URL fails.
    }
    if (marker === completedId && marker) clearMarker(marker);
    else if (marker && marker !== pending?.id) {
      pending = { id: marker, userId: options.userId };
      persist();
    }
    if (pending?.userId && options.userId && pending.userId !== options.userId) {
      const id = pending.id;
      pending = null;
      persist();
      clearMarker(id);
      return;
    }
    if (pending && options.userId && pending.userId === null) {
      pending = { ...pending, userId: options.userId };
      persist();
    }
    void submit();
  }

  let stop: () => void = (): void => undefined;
  try {
    stop = runtime.subscribe(resume);
  } catch {
    // Initial capture still works when browser event registration is unavailable.
  }
  resume();
  return (): void => {
    disposed = true;
    stop();
  };
}
