import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Cycles through words, cross-fading between them.
 *
 * Returns the word plus an `isFading` flag rather than animating internally, so
 * the caller decides how the transition looks and only opacity and transform are
 * ever touched.
 *
 * Under reduced motion the word is held still on the first entry: a headline
 * that changes what it says every few seconds is motion, not decoration, and
 * someone who asked for none should not have to read a moving target.
 */
export function useRotatingWord(words, { interval = 2600, fade = 420 } = {}) {
    const reduced = prefersReducedMotion();
    const [index, setIndex] = useState(0);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        if (reduced || words.length < 2) return undefined;

        const tick = setInterval(() => {
            setIsFading(true);
            // Swap at the midpoint of the fade so the change is never visible.
            setTimeout(() => {
                setIndex(i => (i + 1) % words.length);
                setIsFading(false);
            }, fade);
        }, interval);

        return () => clearInterval(tick);
    }, [words.length, interval, fade, reduced]);

    return {
        word: words[index],
        isFading,
        fadeSx: {
            display: 'inline-block',
            opacity: isFading ? 0 : 1,
            transform: isFading ? 'translateY(-0.18em)' : 'translateY(0)',
            transition: reduced ? 'none' : `opacity ${fade}ms ease, transform ${fade}ms cubic-bezier(0.16,1,0.3,1)`
        }
    };
}

/**
 * Moves an element against the scroll, at a fraction of the page's own speed.
 *
 * Reads scroll position inside requestAnimationFrame rather than in the scroll
 * handler itself. A scroll event can fire many times per frame, and reading
 * getBoundingClientRect in each one forces a synchronous layout every time —
 * which is how parallax becomes the thing that makes a page feel slow.
 *
 * `speed` is a multiplier: 0.15 drifts gently, negative moves with the scroll.
 */
export function useParallax(speed = 0.18) {
    const ref = useRef(null);
    const [offset, setOffset] = useState(0);
    const reduced = prefersReducedMotion();

    useEffect(() => {
        if (reduced) return undefined;

        const node = ref.current;
        if (!node) return undefined;

        let frame = null;

        const update = () => {
            frame = null;
            const rect = node.getBoundingClientRect();
            // Distance of the element's centre from the viewport's centre.
            const fromCentre = (rect.top + rect.height / 2) - window.innerHeight / 2;
            setOffset(fromCentre * -speed);
        };

        const onScroll = () => {
            // Coalesce every event fired before the next paint into one read.
            if (frame === null) frame = window.requestAnimationFrame(update);
        };

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (frame !== null) window.cancelAnimationFrame(frame);
        };
    }, [speed, reduced]);

    return {
        ref,
        // translate3d keeps the element on its own compositor layer, so the drift
        // never triggers layout or paint on the rest of the page.
        parallaxSx: { transform: `translate3d(0, ${offset}px, 0)`, willChange: reduced ? 'auto' : 'transform' }
    };
}
