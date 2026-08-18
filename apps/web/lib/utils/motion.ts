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
  transitionSpringDefault as sharedTransitionSpringDefault,
  transitionSpringSmooth as sharedTransitionSpringSmooth,
  transitionSpringSnappy as sharedTransitionSpringSnappy,
} from "@atria/tokens/motion";

/** Adapter bertipe Framer Motion untuk preset lintas-platform Atria. */
export const transitionSpringSnappy: Transition = sharedTransitionSpringSnappy;
export const transitionSpringSmooth: Transition = sharedTransitionSpringSmooth;
export const transitionSpringBouncy: Transition = sharedTransitionSpringBouncy;
export const transitionSpringDefault: Transition = sharedTransitionSpringDefault;
export const transitionEaseSmooth: Transition = sharedTransitionEaseSmooth;
export const transitionSpinLinear: Transition = sharedTransitionSpinLinear;
export const transitionPulseSmooth: Transition = sharedTransitionPulseSmooth;

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
