"use client";

import React from "react";
import type { z } from "zod";

import {
  parseLocalFormRecovery,
  serializeLocalFormRecovery,
} from "@/lib/forms/local-form-recovery";

export function useLocalFormRecovery<TPayload>({
  storageKey,
  schema,
  schemaVersion = 1,
  initialPayload,
}: {
  readonly storageKey: string;
  readonly schema: z.ZodType<TPayload>;
  readonly schemaVersion?: number;
  readonly initialPayload: () => TPayload;
}): {
  readonly payload: TPayload;
  readonly isDirty: boolean;
  readonly recoveredAt: string | null;
  readonly setPayload: React.Dispatch<React.SetStateAction<TPayload>>;
  readonly clear: () => void;
  readonly reset: (next?: TPayload) => void;
} {
  const recovered = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    return parseLocalFormRecovery({
      raw: window.localStorage.getItem(storageKey),
      schema,
      schemaVersion,
    });
  }, [schema, schemaVersion, storageKey]);
  const [payload, setPayloadState] = React.useState<TPayload>(
    () => recovered?.payload ?? initialPayload(),
  );
  const [isDirty, setDirty] = React.useState(Boolean(recovered));

  const setPayload = React.useCallback<React.Dispatch<React.SetStateAction<TPayload>>>(
    (update) => {
      setPayloadState((current) => {
        const next =
          typeof update === "function"
            ? (update as (value: TPayload) => TPayload)(current)
            : update;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            storageKey,
            serializeLocalFormRecovery({ payload: next, schemaVersion }),
          );
        }
        setDirty(true);
        return next;
      });
    },
    [schemaVersion, storageKey],
  );

  const clear = React.useCallback((): void => {
    if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
    setDirty(false);
  }, [storageKey]);

  const reset = React.useCallback(
    (next?: TPayload): void => {
      const value = next ?? initialPayload();
      if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
      setPayloadState(value);
      setDirty(false);
    },
    [initialPayload, storageKey],
  );

  React.useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent): void {
      if (!isDirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  return {
    payload,
    isDirty,
    recoveredAt: recovered?.changedAt ?? null,
    setPayload,
    clear,
    reset,
  };
}
