"use client";

import * as React from "react";

import type { ReplyPhase } from "../utils/reply-phase";

/** Menahan flash untuk jawaban yang selesai hampir seketika. */
export const REPLY_STATUS_APPEAR_DELAY_MS = 180;

/** Menyaring fase transien yang tidak cukup lama untuk berguna. */
export const REPLY_STATUS_PHASE_STABILITY_MS = 400;

type ReplyStatusPresentation = {
  readonly displayedPhase: ReplyPhase;
  readonly visible: boolean;
};

export function resolvePresentedReplyPhase(
  sourcePhase: ReplyPhase | null,
  displayedPhase: ReplyPhase,
  visible: boolean,
): ReplyPhase {
  return visible && sourcePhase === "fetching" ? "fetching" : displayedPhase;
}

/**
 * Memisahkan state SDK yang cepat berubah dari presentasi status yang tenang.
 *
 * `replyCycle` mengidentifikasi satu request tanpa harus mereset state di dalam
 * effect. Indicator hanya terlihat bila siklus yang pernah melewati ambang tampil
 * sama dengan siklus aktif sekarang; completion maupun request baru karena itu
 * langsung menyembunyikannya pada render yang sama.
 */
export function useReplyStatus(
  sourcePhase: ReplyPhase | null,
  replyCycle: number,
): ReplyStatusPresentation {
  const active = sourcePhase !== null;
  const latestPhaseRef = React.useRef<ReplyPhase | null>(sourcePhase);
  const appearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [revealedCycle, setRevealedCycle] = React.useState<number | null>(null);
  const [displayedPhase, setDisplayedPhase] = React.useState<ReplyPhase>(
    sourcePhase ?? "analyzing",
  );

  React.useEffect(() => {
    latestPhaseRef.current = sourcePhase;
  }, [sourcePhase]);

  const clearAppearTimer = React.useCallback((): void => {
    if (appearTimerRef.current === null) return;
    clearTimeout(appearTimerRef.current);
    appearTimerRef.current = null;
  }, []);

  const clearPhaseTimer = React.useCallback((): void => {
    if (phaseTimerRef.current === null) return;
    clearTimeout(phaseTimerRef.current);
    phaseTimerRef.current = null;
  }, []);

  React.useEffect(() => {
    clearAppearTimer();
    clearPhaseTimer();
    if (!active) return undefined;

    appearTimerRef.current = setTimeout(() => {
      appearTimerRef.current = null;
      const latestPhase = latestPhaseRef.current;
      if (latestPhase === null) return;

      setDisplayedPhase(latestPhase);
      setRevealedCycle(replyCycle);
    }, REPLY_STATUS_APPEAR_DELAY_MS);

    return clearAppearTimer;
  }, [active, clearAppearTimer, clearPhaseTimer, replyCycle]);

  const visible = active && revealedCycle === replyCycle;
  const presentedPhase = resolvePresentedReplyPhase(sourcePhase, displayedPhase, visible);

  React.useEffect(() => {
    if (!visible || sourcePhase === null || sourcePhase === displayedPhase) {
      clearPhaseTimer();
      return undefined;
    }

    // Tool trace sengaja ditahan sebentar. Fase fetching harus berubah pada
    // render yang sama agar waktu itu benar-benar terbaca, bukan habis untuk
    // menunggu stabilisasi label terlebih dahulu.
    if (sourcePhase === "fetching") {
      clearPhaseTimer();
      return undefined;
    }

    const candidate = sourcePhase;
    clearPhaseTimer();
    phaseTimerRef.current = setTimeout(() => {
      phaseTimerRef.current = null;
      if (latestPhaseRef.current === candidate) setDisplayedPhase(candidate);
    }, REPLY_STATUS_PHASE_STABILITY_MS);

    return clearPhaseTimer;
  }, [clearPhaseTimer, displayedPhase, sourcePhase, visible]);

  React.useEffect(
    () => () => {
      clearAppearTimer();
      clearPhaseTimer();
    },
    [clearAppearTimer, clearPhaseTimer],
  );

  return { displayedPhase: presentedPhase, visible };
}
