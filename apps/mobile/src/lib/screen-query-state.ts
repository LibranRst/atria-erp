import { isAccessRevoked } from "./access-error";

export type ScreenLoadState = "ready" | "loading" | "offline" | "error" | "restricted";
export type ScreenQuerySnapshot = {
  readonly data: unknown;
  readonly error: unknown;
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly dataUpdatedAt?: number;
};

export function screenQueryKey(
  scope: string,
  name: string,
  params: readonly unknown[] = [],
): readonly unknown[] {
  // Preserve existing domain invalidation prefixes, isolate the actual data.
  return ["screen", name, ...params, scope];
}

/** A recoverable server page error must not replace last successful content. */
export function acceptScreenData<T>(data: T): T {
  if (typeof data === "object" && data !== null && "status" in data && data.status === "error") {
    throw new Error(
      "message" in data && typeof data.message === "string"
        ? data.message
        : "Data belum dapat dimuat.",
    );
  }
  return data;
}

export function screenLoadState(query: ScreenQuerySnapshot, online: boolean): ScreenLoadState {
  if (isAccessRevoked(query.error)) return "restricted";
  if (query.data !== undefined) return "ready";
  if (!online || query.fetchStatus === "paused") return "offline";
  if (query.error) return "error";
  return "loading";
}
