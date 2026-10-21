"use client";

import React from "react";
import type { ActionResponse } from "@atria/core/types/action-response";

type PageResult<Data> = {
  readonly key: string;
  readonly data: Data | null;
  readonly error: string | null;
};

type QueryGeneration = object | string | number;

/** One exact query per finite slot, retained only by the mounted read owner. */
export function useRetainedQueryPages<Slot extends string, Data>({
  slots,
  slot,
  queryKey,
  generation,
  enabled,
  suspended = false,
  read,
  errorMessage,
}: {
  readonly slots: readonly Slot[];
  readonly slot: Slot;
  readonly queryKey: string;
  readonly generation: QueryGeneration;
  readonly enabled: boolean;
  readonly suspended?: boolean;
  /** Keep the read adapter stable; its normalized input is the query key. */
  readonly read: (key: string) => Promise<ActionResponse<Data>>;
  readonly errorMessage: string;
}): {
  readonly data: Data | null;
  /** Last accepted source for noninteractive loading chrome, never current rows. */
  readonly previousData: Data | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly accessDenied: boolean;
  readonly reload: () => void;
} {
  const [revision, setRevision] = React.useState(0);
  const [state, setState] = React.useState<{
    readonly generation: QueryGeneration;
    readonly revision: number;
    readonly pages: ReadonlyMap<Slot, PageResult<Data>>;
    readonly previousData: Data | null;
    readonly denied: string | null;
  } | null>(null);
  const knownSlot = slots.includes(slot);
  const currentGeneration = state?.generation === generation && state.revision === revision;
  const cachedPage = currentGeneration && knownSlot ? state.pages.get(slot) : undefined;
  const result = cachedPage?.key === queryKey ? cachedPage : undefined;
  const denied = currentGeneration ? state.denied : null;

  React.useEffect(() => {
    if (!enabled || suspended || !knownSlot || result || denied) return;
    let current = true;
    function complete(response: ActionResponse<Data>): void {
      if (!current) return;
      const accessDenied =
        !response.success &&
        (response.error.code === "UNAUTHORIZED" || response.error.code === "FORBIDDEN");
      const message = response.success ? null : response.error.message.trim() || errorMessage;
      setState((previous) => {
        const sameGeneration =
          previous?.generation === generation && previous.revision === revision;
        const pages = new Map<Slot, PageResult<Data>>(
          sameGeneration && !accessDenied ? previous.pages : [],
        );
        if (!accessDenied)
          pages.set(slot, {
            key: queryKey,
            data: response.success ? response.data : null,
            error: message,
          });
        return {
          generation,
          revision,
          pages,
          previousData: accessDenied
            ? null
            : response.success
              ? response.data
              : (previous?.previousData ?? null),
          denied: accessDenied ? message : null,
        };
      });
    }
    void Promise.resolve()
      .then(() => read(queryKey))
      .then(complete)
      .catch(() => {
        complete({
          success: false,
          error: { code: "INTERNAL_SERVER_ERROR", message: errorMessage },
        });
      });
    return (): void => {
      current = false;
    };
  }, [
    enabled,
    suspended,
    knownSlot,
    result,
    denied,
    slot,
    queryKey,
    generation,
    revision,
    read,
    errorMessage,
  ]);

  const reload = React.useCallback((): void => setRevision((value) => value + 1), []);
  return {
    data: result?.data ?? null,
    previousData: denied ? null : (result?.data ?? state?.previousData ?? null),
    loading: enabled && knownSlot && !result && !denied,
    error: !knownSlot ? errorMessage : (denied ?? result?.error ?? null),
    accessDenied: Boolean(denied),
    reload,
  };
}
