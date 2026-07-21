"use client";

import React from "react";

export function useAnimatedSheetClose(
  open: boolean,
  onClosed: () => void,
): {
  readonly visible: boolean;
  readonly close: () => void;
  readonly handleExitComplete: () => void;
} {
  const [closing, setClosing] = React.useState(false);
  const closePendingRef = React.useRef(false);
  const onClosedRef = React.useRef(onClosed);
  const resetTimerRef = React.useRef<number | null>(null);
  const visible = open && !closing;

  React.useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  React.useEffect(
    () => () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const close = React.useCallback((): void => {
    if (!visible) return;
    closePendingRef.current = true;
    setClosing(true);
  }, [visible]);

  const handleExitComplete = React.useCallback((): void => {
    if (!closePendingRef.current) return;
    closePendingRef.current = false;
    onClosedRef.current();
    resetTimerRef.current = window.setTimeout(() => {
      setClosing(false);
      resetTimerRef.current = null;
    }, 0);
  }, []);

  return { visible, close, handleExitComplete };
}
