import { TargetAndTransition, Transition } from "framer-motion";

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

/**
 * INDETERMINATE PROGRESS
 *
 * Untuk keadaan "sedang berjalan" yang durasinya tidak diketahui. Sengaja
 * memakai putaran linear dan denyut opasitas, bukan pantulan: gerak memantul
 * dan elastis terbaca murahan, dan pantulan vertikal juga menarik perhatian
 * lebih besar daripada bobot informasinya.
 *
 * Ketiganya berbasis transform dan opasitas saja, sehingga tidak pernah
 * menggeser tata letak di sekitarnya.
 */
export const transitionSpinLinear: Transition = {
  duration: 1.1,
  repeat: Infinity,
  ease: "linear",
};

export const spinAnimation: TargetAndTransition = { rotate: 360 };

/** Denyut lembut untuk ikon yang menandakan proses masih berlangsung. */
export const pulseAnimation: TargetAndTransition = { opacity: [0.45, 1, 0.45] };

export const transitionPulseSmooth: Transition = {
  duration: 1.6,
  repeat: Infinity,
  ease: [0.4, 0, 0.6, 1],
};

/**
 * Titik "sedang mengetik". Berdenyut di tempat dengan jeda berurutan, bukan
 * melompat naik-turun.
 */
export const thinkingDotAnimation: TargetAndTransition = {
  opacity: [0.25, 1, 0.25],
  scale: [0.8, 1, 0.8],
};

export function thinkingDotTransition(index: number): Transition {
  return {
    duration: 1.2,
    repeat: Infinity,
    ease: [0.4, 0, 0.6, 1],
    delay: index * 0.16,
  };
}

/**
 * COLLAPSE VARIANT: untuk isi yang muncul dan menghilang di dalam aliran.
 * Menganimasikan tinggi bersama opasitas supaya tetangganya bergeser mulus,
 * bukan tersentak saat elemen muncul atau hilang.
 */
export const collapseVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: "auto", transition: transitionSpringSmooth },
  exit: { opacity: 0, height: 0, transition: transitionSpringSmooth },
};

/**
 * ENTER VARIANT: kartu dan blok yang menyusul di dalam percakapan.
 * Naik sedikit sambil memudar masuk, jarak sengaja kecil agar tidak terbaca
 * sebagai animasi masuk halaman.
 */
export const riseInVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitionSpringSmooth },
  exit: { opacity: 0, transition: transitionEaseSmooth },
};

// SLIDE-UP DRAWER VARIANT: Preset for sheets / modal sliding up from bottom
export const slideUpDrawerVariants = {
  hidden: { y: "100%", opacity: 0.5 },
  visible: { y: 0, opacity: 1, transition: transitionSpringSmooth },
  exit: { y: "100%", opacity: 0.5, transition: transitionSpringSmooth },
};
