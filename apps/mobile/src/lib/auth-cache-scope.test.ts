import { describe, expect, test } from "bun:test";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
import { onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";

import { createAuthCacheScope, type AuthCacheIdentity } from "./auth-cache-scope";
import { screenLoadState, screenQueryKey } from "./screen-query-state";

const identity: AuthCacheIdentity = {
  userId: "finance-user",
  sessionId: "unchanged-session",
  roleId: "custom-finance-role",
  permissions: ["view:ledger", "view:project"],
  dataScope: "GLOBAL",
};

type CachedCashDetail = {
  readonly status: "ready";
  readonly transactionId: string;
  readonly amount: number;
};

describe("authorization cache scope", () => {
  const downgradedScopes: readonly RoleDataScope[] = ["ASSIGNED", "NONE"];

  test.each([...downgradedScopes])(
    "a known downgrade to %s hides cached global cash detail while offline",
    (dataScope: RoleDataScope): void => {
      const wasOnline = onlineManager.isOnline();
      onlineManager.setOnline(false);
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const globalKey = screenQueryKey(createAuthCacheScope(identity), "activityDetail", [
        "cash-1",
      ]);
      const cachedDetail: CachedCashDetail = {
        status: "ready",
        transactionId: "cash-1",
        amount: 85_000_000,
      };
      client.setQueryData(globalKey, cachedDetail);
      let requests = 0;
      const load = async (): Promise<CachedCashDetail> => {
        requests++;
        return cachedDetail;
      };
      const observer = new QueryObserver(client, {
        queryKey: globalKey,
        queryFn: load,
        retry: false,
      });
      const unsubscribe = observer.subscribe((): void => undefined);

      try {
        expect(observer.getCurrentResult().data).toEqual(cachedDetail);
        // Role, credentials, transaction and permissions remain unchanged.
        // Only the freshly returned capability's data scope is downgraded.
        observer.setOptions({
          queryKey: screenQueryKey(
            createAuthCacheScope({ ...identity, dataScope }),
            "activityDetail",
            ["cash-1"],
          ),
          queryFn: load,
          retry: false,
        });
        const result = observer.getCurrentResult();
        expect(result.data).toBeUndefined();
        expect(result.fetchStatus).toBe("paused");
        expect(screenLoadState(result, false)).toBe("offline");
        expect(requests).toBe(0);
      } finally {
        unsubscribe();
        client.clear();
        onlineManager.setOnline(wasOnline);
      }
    },
  );

  test("equivalent permissions keep authorized cached reads without mutating their order", (): void => {
    const permissions: readonly PermissionKey[] = Object.freeze(["view:project", "view:ledger"]);
    const client = new QueryClient();
    const key = screenQueryKey(createAuthCacheScope(identity), "activityDetail", ["cash-1"]);
    client.setQueryData(key, "authorized-detail");

    try {
      const equivalentKey = screenQueryKey(
        createAuthCacheScope({ ...identity, permissions }),
        "activityDetail",
        ["cash-1"],
      );
      expect(client.getQueryData<string>(equivalentKey)).toBe("authorized-detail");
      expect(permissions).toEqual(["view:project", "view:ledger"]);
    } finally {
      client.clear();
    }
  });
});
