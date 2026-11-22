import type { Transition } from 'framer-motion';

/**
 * Shared motion tokens aligned with `src/theme/motion.css`,
 * Emil Kowalski's animation decision framework, and transitions.dev.
 */
export const EASE_OUT_STRONG: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const EASE_SMOOTH_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT_STRONG: [number, number, number, number] = [0.77, 0, 0.175, 1];
export const EASE_DRAWER: [number, number, number, number] = [0.32, 0.72, 0, 1];

export const DURATION = {
  micro: 0.08,
  quick: 0.15,
  fast: 0.22,
  medium: 0.32,
  slow: 0.4,
} as const;

/**
 * Crisp, low-bounce spring for sliding tab/pill indicators (`layoutId`).
 * Keeps bounce minimal so professional dashboards feel immediate, not rubbery.
 */
export const SPRING_PILL: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

/**
 * Snappy spring for small interactive elements (checkmarks, badges, drawers).
 */
export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  duration: 0.35,
  bounce: 0.15,
};
