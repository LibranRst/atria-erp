"use client";

import * as React from "react";

export type ContentSizeMotion = {
  readonly element: {
    readonly isConnected: boolean;
    readonly style: { height: string };
  };
  readonly targetHeight: "auto" | 0;
};
export type ContentSizeMotionController = {
  readonly begin: (key: string, motion: ContentSizeMotion) => void;
  readonly finish: (key: string) => void;
};

const ContentSizeMotionContext = React.createContext<ContentSizeMotionController | null>(null);
export const ContentSizeMotionProvider = ContentSizeMotionContext.Provider;
export function useContentSizeMotion(): ContentSizeMotionController | null {
  return React.useContext(ContentSizeMotionContext);
}

/** Measure the final flow before paint, then restore Framer's current animation styles. */
export function measureContentSizeTarget<Result>(
  motions: Iterable<ContentSizeMotion>,
  measure: () => Result,
): Result {
  const changed: { readonly element: ContentSizeMotion["element"]; readonly height: string }[] = [];
  try {
    for (const motion of motions) {
      if (!motion.element.isConnected) continue;
      changed.push({ element: motion.element, height: motion.element.style.height });
      motion.element.style.height = motion.targetHeight === "auto" ? "auto" : "0px";
    }
    return measure();
  } finally {
    for (const original of changed.reverse()) original.element.style.height = original.height;
  }
}
