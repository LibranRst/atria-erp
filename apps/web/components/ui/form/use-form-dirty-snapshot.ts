"use client";

import React from "react";

/**
 * Membandingkan nilai form dengan snapshot saat sheet dibuka.
 * Caller memberikan fingerprint serializable agar hook tidak menebak domain.
 */
export function useFormDirtySnapshot(
  open: boolean,
  identity: string | number | null,
  fingerprint: string,
): boolean {
  const [snapshot, setSnapshot] = React.useState<{
    readonly open: boolean;
    readonly identity: string | number | null;
    readonly baseline: string;
  }>({ open: false, identity: null, baseline: fingerprint });

  if (open !== snapshot.open || (open && snapshot.identity !== identity)) {
    setSnapshot({ open, identity: open ? identity : null, baseline: fingerprint });
    return false;
  }

  return open && fingerprint !== snapshot.baseline;
}
