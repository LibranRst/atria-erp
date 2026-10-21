"use client";

import { AppIcon } from "@/components/ui";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import * as React from "react";

/**
 * Pertanyaan lanjutan yang diusulkan model, ditampilkan sebagai chip.
 *
 * Chip adalah kontrol berdiri sendiri, jadi bentuknya kapsul — berbeda dari
 * kartu data yang memakai skala radius kontainer.
 */

const followUpOutputSchema = z.object({
  questions: z.array(z.string().min(1)),
});

export function readFollowUps(output: unknown): readonly string[] {
  const parsed = followUpOutputSchema.safeParse(output);
  return parsed.success ? parsed.data.questions : [];
}

type FollowUpChipsProps = {
  readonly questions: readonly string[];
  readonly onSelect: (question: string) => void;
  readonly disabled: boolean;
};

export function FollowUpChips({
  questions,
  onSelect,
  disabled,
}: FollowUpChipsProps): React.JSX.Element | null {
  const reduceMotion = useReducedMotion();
  if (questions.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2 pt-1" aria-label="Pertanyaan lanjutan">
      {questions.map((question) => (
        <motion.li
          key={question}
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={transitionSpringSnappy}
        >
          <motion.button
            type="button"
            onClick={() => onSelect(question)}
            disabled={disabled}
            whileTap={reduceMotion || disabled ? undefined : { scale: buttonTapActiveScale }}
            transition={transitionSpringSnappy}
            className="group flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-3.5 py-2 text-left shadow-control ring-1 ring-ring-subtle transition-all duration-200 hover:bg-surface-container-low hover:ring-ring-control focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="text-support font-semibold text-on-surface">{question}</span>
            <span
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-low transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            >
              <AppIcon name="arrow_upward" className="icon-xs text-on-surface-variant" />
            </span>
          </motion.button>
        </motion.li>
      ))}
    </ul>
  );
}
