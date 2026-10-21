import type { TargetAndTransition, Transition, Variants } from "framer-motion";

import {
  collapseVariants as sharedCollapseVariants,
  fadeVariants as sharedFadeVariants,
  pulseAnimation as sharedPulseAnimation,
  riseInVariants as sharedRiseInVariants,
  slideUpDrawerVariants as sharedSlideUpDrawerVariants,
  spinAnimation as sharedSpinAnimation,
  thinkingDotAnimation as sharedThinkingDotAnimation,
  thinkingDotTransition as sharedThinkingDotTransition,
  transitionEaseSmooth as sharedTransitionEaseSmooth,
  transitionPulseSmooth as sharedTransitionPulseSmooth,
  transitionSpinLinear as sharedTransitionSpinLinear,
  transitionSpringBouncy as sharedTransitionSpringBouncy,
  transitionSpringSoftBouncy as sharedTransitionSpringSoftBouncy,
  transitionSpringDefault as sharedTransitionSpringDefault,
  transitionSpringSmooth as sharedTransitionSpringSmooth,
  transitionSpringSnappy as sharedTransitionSpringSnappy,
  buttonTapActiveScale as sharedButtonTapActiveScale,
} from "@atria/tokens/motion";

/** Skala pembesaran tombol saat ditekan/ditahan bergaya haptic iOS. */
export const buttonTapActiveScale: number = sharedButtonTapActiveScale;

/** Adapter bertipe Framer Motion untuk preset lintas-platform Paduna Build. */
export const transitionSpringSnappy: Transition = sharedTransitionSpringSnappy;
export const transitionSpringSmooth: Transition = sharedTransitionSpringSmooth;
export const transitionSpringBouncy: Transition = sharedTransitionSpringBouncy;
export const transitionSpringSoftBouncy: Transition = sharedTransitionSpringSoftBouncy;
export const transitionSpringDefault: Transition = sharedTransitionSpringDefault;
export const transitionEaseSmooth: Transition = sharedTransitionEaseSmooth;
export const transitionSpinLinear: Transition = sharedTransitionSpinLinear;
export const transitionPulseSmooth: Transition = sharedTransitionPulseSmooth;

/** Anchored panels share the Dashboard dropdown's compact travel and scale. */
export const anchoredPopoverClosed: Readonly<{ opacity: number; scale: number; y: number }> = {
  opacity: 0,
  scale: 0.96,
  y: 4,
};
export const anchoredPopoverOpen: Readonly<{ opacity: number; scale: number; y: number }> = {
  opacity: 1,
  scale: 1,
  y: 0,
};

export const spinAnimation: TargetAndTransition = sharedSpinAnimation;
export const pulseAnimation: TargetAndTransition = sharedPulseAnimation;
export const thinkingDotAnimation: TargetAndTransition = sharedThinkingDotAnimation;

export function thinkingDotTransition(index: number): Transition {
  return sharedThinkingDotTransition(index);
}

export const fadeVariants: Variants = sharedFadeVariants;
export const collapseVariants: Variants = sharedCollapseVariants;
export const riseInVariants: Variants = sharedRiseInVariants;
export const slideUpDrawerVariants: Variants = sharedSlideUpDrawerVariants;
