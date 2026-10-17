"use client";

import React from "react";
import { listExpenseDrafts, type ExpenseDraftSummary } from "@/app/actions/finance/expense-drafts";
import { useCurrentUserProfile, usePermissions } from "@/components/auth/permissions-provider";
import { useRetainedQueryPages } from "@/lib/utils/use-retained-query-pages";

const slots: readonly "drafts"[] = ["drafts"];
type DraftQuery = ReturnType<
  typeof useRetainedQueryPages<"drafts", readonly ExpenseDraftSummary[]>
>;
type Source = DraftQuery & {
  readonly scopeKey: string;
  readonly activate: () => () => void;
};
export const ExpenseDraftsReadContext = React.createContext<Source | null>(null);
const read = (): ReturnType<typeof listExpenseDrafts> => listExpenseDrafts();

/** Retains the private draft list while conditional project tabs unmount their presenters. */
export function ExpenseDraftsReadProvider({
  generation,
  projectId,
  children,
}: {
  readonly generation: unknown;
  readonly projectId?: string;
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
    projectId,
  ]);
  const sourceGeneration = React.useMemo(() => ({ generation, scopeKey }), [generation, scopeKey]);
  const [consumers, setConsumers] = React.useState(0);
  const activate = React.useCallback((): (() => void) => {
    setConsumers((count) => count + 1);
    return (): void => setConsumers((count) => Math.max(0, count - 1));
  }, []);
  const query = useRetainedQueryPages({
    slots,
    slot: "drafts",
    queryKey: projectId ?? "all-projects",
    generation: sourceGeneration,
    enabled: consumers > 0,
    read,
    errorMessage: "Daftar draft belum dapat dimuat. Periksa koneksi lalu coba lagi.",
  });
  React.useEffect(() => {
    window.addEventListener("atria:expense-drafts-changed", query.reload);
    return (): void => window.removeEventListener("atria:expense-drafts-changed", query.reload);
  }, [query.reload]);
  return (
    <ExpenseDraftsReadContext.Provider value={{ ...query, scopeKey, activate }}>
      {children}
    </ExpenseDraftsReadContext.Provider>
  );
}
