"use client";

import React from "react";

/** Release the menu focus owner before an action navigates or opens a modal. */
export function useMenuActionQueue(close: () => void): {
  readonly queueAction: (action: () => void) => void;
  readonly flushPendingAction: () => void;
  readonly cancelPendingAction: () => void;
} {
  const pendingAction = React.useRef<(() => void) | null>(null);
  const frame = React.useRef<number | null>(null);
  const flushPendingAction = React.useCallback((): void => {
    const action = pendingAction.current;
    pendingAction.current = null;
    // React Aria restores focus in the removal frame. The destination mounts
    // in the next frame so its initial focus is the last focus operation.
    if (action)
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        action();
      });
  }, []);
  const cancelPendingAction = React.useCallback((): void => {
    pendingAction.current = null;
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  React.useEffect(() => cancelPendingAction, [cancelPendingAction]);
  return {
    queueAction: (action: () => void): void => {
      pendingAction.current = action;
      close();
    },
    flushPendingAction,
    cancelPendingAction,
  };
}
