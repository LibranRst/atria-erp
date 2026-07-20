import { Transition } from "framer-motion";

/**
 * Premium iOS-like motion presets.
 * Designed to feel incredibly fluid, highly responsive, and subtle.
 */

// SNAPPY: Perfect for scale taps, micro-interactions, or quick popovers
export const transitionSpringSnappy: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

// SMOOTH: For slide-up drawers, sheets, modals, and meaningful local layout changes
export const transitionSpringSmooth: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 32,
  mass: 1,
};

// BOUNCY: Subtle bouncy physics for celebratory actions, alert popups, or toggle switches
export const transitionSpringBouncy: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 26,
  mass: 1,
};

// DEFAULT: The everyday iOS spring for general transitions
export const transitionSpringDefault: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 32,
  mass: 1,
};

// EASE SMOOTH: Standard cubic-bezier curve for non-spring transitions (like opacities/fades)
export const transitionEaseSmooth: Transition = {
  type: "tween",
  ease: [0.32, 0.94, 0.6, 1], // iOS-like ease out
  duration: 0.35,
};

// FADE VARIANT: Simple preset for overlays / backdrop fades
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitionEaseSmooth },
  exit: { opacity: 0, transition: transitionEaseSmooth },
};

// SLIDE-UP DRAWER VARIANT: Preset for sheets / modal sliding up from bottom
export const slideUpDrawerVariants = {
  hidden: { y: "100%", opacity: 0.5 },
  visible: { y: 0, opacity: 1, transition: transitionSpringSmooth },
  exit: { y: "100%", opacity: 0.5, transition: transitionSpringSmooth },
};
