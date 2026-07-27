import { useEffect, useRef, useState } from 'react';

/**
 * Reveals an element the first time it scrolls into view.
 *
 * IntersectionObserver rather than a scroll handler: a scroll listener fires on
 * every frame of every scroll for every element using it, which is exactly the
 * churn a landing page cannot afford.
 *
 * Unobserves after the first reveal — re-animating on the way back up reads as a
 * glitch, not a flourish.
 *
 * Honours prefers-reduced-motion by starting revealed, so the content is simply
 * there rather than fading for someone who asked for no motion.
 */
export function useRevealOnScroll({ threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = {}) {
    const ref = useRef(null);
    const prefersReduced = typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const [isRevealed, setIsRevealed] = useState(prefersReduced);

    useEffect(() => {
        if (prefersReduced) return undefined;

        const node = ref.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            // No observer support: show the content rather than hide it forever.
            setIsRevealed(true);
            return undefined;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                setIsRevealed(true);
                observer.unobserve(entry.target);
            },
            { threshold, rootMargin }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [threshold, rootMargin, prefersReduced]);

    // Only transform and opacity: both composite on the GPU, so the reveal cannot
    // trigger layout while the user is mid-scroll.
    const revealSx = {
        opacity: isRevealed ? 1 : 0,
        transform: isRevealed ? 'translateY(0)' : 'translateY(24px)',
        transition: prefersReduced
            ? 'none'
            : 'opacity 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1)'
    };

    return { ref, isRevealed, revealSx };
}
