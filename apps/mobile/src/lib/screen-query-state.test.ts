import { describe, expect, test } from "bun:test";
import { onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import { acceptScreenData, screenLoadState, screenQueryKey } from "./screen-query-state";

describe("mobile screen lifecycle", () => {
  test("recoverable page failures are errors; explicit restricted responses stay authoritative", () => {
    expect(() => acceptScreenData({ status: "error", message: "Upstream unavailable" })).toThrow(
      "Upstream unavailable",
    );
    expect(acceptScreenData({ status: "restricted" })).toEqual({ status: "restricted" });
  });
  test("failed background refresh retains data, but revoked access hides it", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = screenQueryKey("owner-session", "projects");
    client.setQueryData(key, { projects: ["p1"] });
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: async (): Promise<{ projects: string[] }> => {
        throw new Error("offline");
      },
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    const result = await observer.refetch();
    expect(result.data).toEqual({ projects: ["p1"] });
    expect(result.isError).toBe(true);
    expect(screenLoadState(result, true)).toBe("ready");
    expect(screenLoadState({ ...result, error: { data: { code: "FORBIDDEN" } } }, true)).toBe(
      "restricted",
    );
    unsubscribe();
    client.clear();
  });

  test("first offline load is paused and offers recovery instead of a skeleton", () => {
    onlineManager.setOnline(false);
    const client = new QueryClient();
    let requests = 0;
    const observer = new QueryObserver(client, {
      queryKey: screenQueryKey("session", "expenses"),
      queryFn: async (): Promise<string[]> => {
        requests++;
        return [];
      },
    });
    const unsubscribe = observer.subscribe(() => undefined);
    try {
      const result = observer.getCurrentResult();
      expect(result.isPending).toBe(true);
      expect(result.fetchStatus).toBe("paused");
      expect(screenLoadState(result, false)).toBe("offline");
      expect(requests).toBe(0);
    } finally {
      unsubscribe();
      client.clear();
      onlineManager.setOnline(true);
    }
  });

  test("accounts, sessions and changed permissions cannot reuse another scope's data", () => {
    const client = new QueryClient();
    client.setQueryData(
      screenQueryKey("owner-session-1", "projectOverview", ["p1"]),
      "private-data",
    );
    for (const scope of ["pm-session", "owner-session-2", "owner-session-1-new-permissions"]) {
      expect(client.getQueryData(screenQueryKey(scope, "projectOverview", ["p1"]))).toBeUndefined();
    }
    client.clear();
  });

  test("unobserved request consumes cancellation without discarding the last successful data", async () => {
    const client = new QueryClient();
    const key = screenQueryKey("session", "ledger");
    client.setQueryData(key, "last-success");
    let aborted = false;
    const observer = new QueryObserver(client, {
      queryKey: key,
      staleTime: 0,
      queryFn: ({ signal }): Promise<string> =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    });
    const unsubscribe = observer.subscribe(() => undefined);
    unsubscribe();
    expect(aborted).toBe(true);
    expect(client.getQueryData<string>(key)).toBe("last-success");
    client.clear();
  });
});
