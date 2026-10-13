"use client";

import React from "react";

/** Keep the last selected entity mounted until a sheet finishes exiting. */
export function useSheetPresenceValue<T>(
  value: T | null | undefined,
  identity: string | number | null | undefined,
): {
  readonly presentedValue: T | null;
  readonly open: boolean;
  readonly handleExitComplete: () => void;
} {
  const normalizedValue = value ?? null;
  const normalizedIdentity = identity ?? null;
  const [presence, setPresence] = React.useState<{
    readonly identity: string | number | null;
    readonly value: T | null;
    readonly requestedIdentity: string | number | null;
    readonly epoch: number;
  }>({
    identity: normalizedIdentity,
    value: normalizedValue,
    requestedIdentity: normalizedIdentity,
    epoch: 0,
  });

  if (
    normalizedIdentity !== presence.requestedIdentity ||
    (normalizedIdentity !== null &&
      (normalizedIdentity !== presence.identity || normalizedValue !== presence.value))
  ) {
    setPresence({
      identity: normalizedIdentity ?? presence.identity,
      value: normalizedIdentity === null ? presence.value : normalizedValue,
      requestedIdentity: normalizedIdentity,
      epoch: presence.epoch + 1,
    });
  }

  const handleExitComplete = React.useCallback((): void => {
    setPresence((current) => {
      // Interrupted/reopened sheets have a new epoch. A late completion from
      // an older exit must never clear their selected entity or draft.
      if (current.requestedIdentity !== null || current.epoch !== presence.epoch) return current;
      return { ...current, identity: null, value: null };
    });
  }, [presence.epoch]);

  return {
    presentedValue: presence.value,
    open: normalizedValue !== null,
    handleExitComplete,
  };
}
