export type SpringMotionPreset = {
  readonly type: "spring";
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
};

export type TweenMotionPreset = {
  readonly type: "tween";
  readonly ease: [number, number, number, number];
  readonly duration: number;
};

export type RepeatingMotionPreset = {
  readonly duration: number;
  readonly repeat: number;
  readonly ease: "linear" | [number, number, number, number];
  readonly delay?: number;
};

export const transitionSpringSnappy: SpringMotionPreset = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

/**
 * Nilai pembesaran (scale up) saat tombol ditekan atau ditahan bergaya haptic iOS.
 */
export const buttonTapActiveScale = 1.05;

export const transitionSpringSmooth: SpringMotionPreset = {
  type: "spring",
  stiffness: 300,
  damping: 32,
  mass: 1,
};

export const transitionSpringBouncy: SpringMotionPreset = {
  type: "spring",
  stiffness: 300,
  damping: 26,
  mass: 1,
};

export const transitionSpringSoftBouncy: SpringMotionPreset = {
  type: "spring",
  stiffness: 290,
  damping: 28,
  mass: 0.95,
};

export const transitionSpringDefault: SpringMotionPreset = {
  type: "spring",
  stiffness: 320,
  damping: 32,
  mass: 1,
};

export const transitionEaseSmooth: TweenMotionPreset = {
  type: "tween",
  ease: [0.32, 0.94, 0.6, 1],
  duration: 0.35,
};

export const transitionSpinLinear: RepeatingMotionPreset = {
  duration: 1.1,
  repeat: Infinity,
  ease: "linear",
};

export const transitionPulseSmooth: RepeatingMotionPreset = {
  duration: 1.6,
  repeat: Infinity,
  ease: [0.4, 0, 0.6, 1],
};

export function thinkingDotTransition(index: number): RepeatingMotionPreset {
  return {
    duration: 1.2,
    repeat: Infinity,
    ease: [0.4, 0, 0.6, 1],
    delay: index * 0.16,
  };
}

export const spinAnimation = { rotate: 360 };
export const pulseAnimation = { opacity: [0.45, 1, 0.45] };
export const thinkingDotAnimation = {
  opacity: [0.25, 1, 0.25],
};

export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitionEaseSmooth },
  exit: { opacity: 0, transition: transitionEaseSmooth },
};

export const collapseVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: "auto", transition: transitionSpringSmooth },
  exit: { opacity: 0, height: 0, transition: transitionSpringSmooth },
};

export const riseInVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitionSpringSmooth },
  exit: { opacity: 0, transition: transitionEaseSmooth },
};

export const slideUpDrawerVariants = {
  hidden: { y: "100%", opacity: 0.5 },
  visible: { y: 0, opacity: 1, transition: transitionSpringSmooth },
  exit: { y: "100%", opacity: 0.5, transition: transitionSpringSmooth },
};
