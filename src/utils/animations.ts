import type { Variants, Transition } from 'framer-motion';

// Custom easing curves for the Keshi aesthetic
export const easings = {
    smooth: [0.43, 0.13, 0.23, 0.96] as const,
    bounce: [0.68, -0.55, 0.265, 1.55] as const,
    elastic: [0.175, 0.885, 0.32, 1.275] as const,
};

// Base transition settings
export const baseTransition: Transition = {
    duration: 0.6,
    ease: easings.smooth,
};

// ============================================
// ENTRANCE ANIMATION VARIANTS
// ============================================

// Fade up - for main content blocks
export const fadeUp: Variants = {
    initial: {
        opacity: 0,
        y: 30
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: baseTransition
    },
};

// Fade down - for navigation elements
export const fadeDown: Variants = {
    initial: {
        opacity: 0,
        y: -20
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: baseTransition
    },
};

// Scale in - for timer display
export const scaleIn: Variants = {
    initial: {
        opacity: 0,
        scale: 0.8
    },
    animate: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.8,
            ease: easings.elastic,
        }
    },
};

// Pop in - for badges and small elements
export const popIn: Variants = {
    initial: {
        opacity: 0,
        scale: 0,
        rotate: -10,
    },
    animate: {
        opacity: 1,
        scale: 1,
        rotate: -2,
        transition: {
            duration: 0.5,
            ease: easings.bounce,
        }
    },
};

// Slide in from right - for widgets
export const slideInRight: Variants = {
    initial: {
        opacity: 0,
        x: 100
    },
    animate: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.7,
            ease: easings.smooth,
        }
    },
};

// Slide up - for footer elements
export const slideUp: Variants = {
    initial: {
        opacity: 0,
        y: 50
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: baseTransition
    },
};

// Expand from center - for progress bar
export const expandCenter: Variants = {
    initial: {
        opacity: 0,
        scaleX: 0,
    },
    animate: {
        opacity: 1,
        scaleX: 1,
        transition: {
            duration: 0.8,
            ease: easings.smooth,
        }
    },
};

// ============================================
// RANSOM LETTER ANIMATION
// ============================================

export const letterContainer: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.06,
            delayChildren: 0.4,
        }
    },
};

export const letterItem: Variants = {
    initial: {
        opacity: 0,
        y: -40,
        scale: 0,
        rotate: 0,
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.5,
            ease: easings.bounce,
        }
    },
};

// ============================================
// COLLAGE / TOSS-IN ANIMATIONS
// ============================================

export const tossInLeft: Variants = {
    initial: {
        opacity: 0,
        scale: 0.5,
        x: -150,
        rotate: -25,
    },
    animate: {
        opacity: 1,
        scale: 1,
        x: 0,
        rotate: -3,
        transition: {
            duration: 1,
            ease: easings.elastic,
        }
    },
};

export const tossInRight: Variants = {
    initial: {
        opacity: 0,
        scale: 0.5,
        x: 150,
        rotate: 25,
    },
    animate: {
        opacity: 1,
        scale: 1,
        x: 0,
        rotate: 6,
        transition: {
            duration: 1,
            ease: easings.elastic,
        }
    },
};

// Star pop animation
export const starPop: Variants = {
    initial: {
        opacity: 0,
        scale: 0,
        rotate: -180,
    },
    animate: {
        opacity: 1,
        scale: 1,
        rotate: 12,
        transition: {
            duration: 0.8,
            ease: easings.bounce,
        }
    },
};

// Text fragment slide
export const fragmentSlide: Variants = {
    initial: {
        opacity: 0,
        x: -30,
        rotate: 0,
    },
    animate: {
        opacity: 0.5,
        x: 0,
        rotate: -3,
        transition: {
            duration: 0.6,
            ease: easings.smooth,
        }
    },
};

// ============================================
// STAGGER CONTAINER VARIANTS
// ============================================

export const staggerContainer: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.8,
        }
    },
};

export const staggerItem: Variants = {
    initial: {
        opacity: 0,
        y: 20
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: easings.smooth,
        }
    },
};

// ============================================
// PAGE ORCHESTRATION
// ============================================

// Delays for orchestrated entrance sequence (in seconds)
export const entranceDelays = {
    background: 0,
    logo: 0.1,
    menu: 0.2,
    badge: 0.3,
    ransomLetters: 0.4,
    timer: 0.6,
    progressBar: 0.7,
    controls: 0.8,
    quote: 0.9,
    collageLeft: 1.0,
    collageRight: 1.1,
    radioWidget: 1.2,
    ticker: 1.3,
    decorativeElements: 1.4,
};

// Helper function to create delayed variants
export const withDelay = (variants: Variants, delay: number): Variants => ({
    ...variants,
    animate: {
        ...variants.animate,
        transition: {
            ...(typeof variants.animate === 'object' && 'transition' in variants.animate
                ? variants.animate.transition
                : {}),
            delay,
        }
    },
});
