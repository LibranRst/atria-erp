"use client";

import React from "react";
import { listManagedRoles } from "@/app/actions/administration-roles";
import { useCurrentUserProfile, usePermissions } from "@/components/auth/permissions-provider";
import { useRetainedQueryPages } from "@/lib/utils/use-retained-query-pages";
import type { ManagedRole } from "@/server/usecases/administration/roles";

const slots: readonly "roles"[] = ["roles"];
type RoleQuery = ReturnType<typeof useRetainedQueryPages<"roles", readonly ManagedRole[]>>;
type Source = RoleQuery & {
  readonly scopeKey: string;
  readonly activate: () => () => void;
  readonly refresh: () => Promise<void>;
};
type Waiter = {
  readonly generation: object;
  readonly afterRead: number;
  readonly resolve: () => void;
};
export const ManagedRolesReadContext = React.createContext<Source | null>(null);

/** The Settings owner retains reads; role editors continue to own their own drafts. */
export function ManagedRolesReadProvider({
  generation,
  children,
}: {
  readonly generation: unknown;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const user = useCurrentUserProfile();
  const permissions = usePermissions();
  const scopeKey = JSON.stringify([
    user?.id,
    user?.sessionId,
    user?.roleId,
    user?.dataScope,
    permissions,
  ]);
  const sourceGeneration = React.useMemo(() => ({ generation, scopeKey }), [generation, scopeKey]);
  const [consumers, setConsumers] = React.useState(0);
  const sequence = React.useRef(0);
  const waiters = React.useRef<readonly Waiter[]>([]);
  const activate = React.useCallback((): (() => void) => {
    setConsumers((count) => count + 1);
    return (): void => setConsumers((count) => Math.max(0, count - 1));
  }, []);
  const settle = React.useCallback((scope: object, read?: number): void => {
    const settled = waiters.current.filter(
      (waiter) => waiter.generation === scope && (read === undefined || waiter.afterRead <= read),
    );
    waiters.current = waiters.current.filter((waiter) => !settled.includes(waiter));
    settled.forEach((waiter) => waiter.resolve());
  }, []);
  const read = React.useCallback(async (): ReturnType<typeof listManagedRoles> => {
    const request = ++sequence.current;
    try {
      return await listManagedRoles();
    } finally {
      settle(sourceGeneration, request);
    }
  }, [settle, sourceGeneration]);
  const query = useRetainedQueryPages({
    slots,
    slot: "roles",
    queryKey: "roles",
    generation: sourceGeneration,
    enabled: consumers > 0,
    read,
    errorMessage: "Daftar peran belum dapat dimuat. Coba lagi.",
  });
  const reload = query.reload;
  const refresh = React.useCallback(async (): Promise<void> => {
    if (consumers === 0) {
      reload();
      return;
    }
    await new Promise<void>((resolve) => {
      waiters.current = [
        ...waiters.current,
        { generation: sourceGeneration, afterRead: sequence.current + 1, resolve },
      ];
      reload();
    });
  }, [consumers, reload, sourceGeneration]);
  React.useEffect(() => (): void => settle(sourceGeneration), [settle, sourceGeneration]);
  React.useEffect(() => {
    if (consumers === 0) settle(sourceGeneration);
  }, [consumers, settle, sourceGeneration]);
  return (
    <ManagedRolesReadContext.Provider value={{ ...query, scopeKey, activate, refresh }}>
      {children}
    </ManagedRolesReadContext.Provider>
  );
}
