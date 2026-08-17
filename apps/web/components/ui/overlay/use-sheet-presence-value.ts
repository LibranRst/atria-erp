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
  }>({ identity: normalizedIdentity, value: normalizedValue });

  if (normalizedIdentity !== null && normalizedIdentity !== presence.identity) {
    setPresence({ identity: normalizedIdentity, value: normalizedValue });
  }

  const handleExitComplete = React.useCallback((): void => {
    if (normalizedIdentity === null) {
      setPresence({ identity: null, value: null });
    }
  }, [normalizedIdentity]);

  return {
    presentedValue: presence.value,
    open: normalizedValue !== null,
    handleExitComplete,
  };
}
