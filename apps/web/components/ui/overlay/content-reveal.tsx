"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion, type AnimationDefinition } from "framer-motion";
import { transitionEaseSmooth } from "@/lib/utils/motion";
import { useContentSizeMotion } from "./content-size-motion";

/** Shared intrinsic-height reveal; retained editors keep their input identity while collapsed. */
export function ContentReveal({
  expanded,
  id,
  keepMounted = false,
  className,
  children,
}: {
  readonly expanded: boolean;
  readonly id: string;
  readonly keepMounted?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion(),
    detailsRef = React.useRef<HTMLDivElement>(null),
    coordinator = useContentSizeMotion();
  React.useEffect(() => () => coordinator?.finish(id), [coordinator, id]);
  const content = (
    <motion.div
      ref={detailsRef}
      id={id}
      inert={!expanded}
      aria-hidden={!expanded}
      initial={reduceMotion || keepMounted ? false : { opacity: 0, height: 0, overflow: "hidden" }}
      animate={{
        opacity: expanded ? 1 : 0,
        height: expanded ? "auto" : 0,
        overflow: expanded ? undefined : "hidden",
        transitionEnd: { overflow: expanded ? "visible" : "hidden" },
      }}
      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
      transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
      onAnimationStart={(definition: AnimationDefinition): void => {
        if (detailsRef.current)
          coordinator?.begin(id, {
            element: detailsRef.current,
            targetHeight:
              typeof definition === "object" && "height" in definition && definition.height === 0
                ? 0
                : "auto",
          });
      }}
      onAnimationComplete={() => coordinator?.finish(id)}
      className="min-w-0"
    >
      <div className={className}>{children}</div>
    </motion.div>
  );
  return keepMounted ? (
    content
  ) : (
    <AnimatePresence initial={false}>{expanded ? content : null}</AnimatePresence>
  );
}
