"use client";
import * as React from "react";
export function useReplyElapsed(active: boolean, cycle: number): number {
  const [clock, setClock] = React.useState({ cycle: -1, seconds: 0 });
  React.useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      if (!document.hidden)
        setClock({ cycle, seconds: Math.floor((performance.now() - start) / 1000) });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, cycle]);
  return active && clock.cycle === cycle ? clock.seconds : 0;
}
