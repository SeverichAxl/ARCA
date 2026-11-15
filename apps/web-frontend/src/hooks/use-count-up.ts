'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Anima un número hasta su valor final. Respeta `prefers-reduced-motion` y
 * reinicia suavemente cuando el objetivo cambia.
 */
export function useCountUp(
  target: number,
  { duration = 900, enabled = true }: { duration?: number; enabled?: boolean } = {},
): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const currentRef = useRef(0);

  useEffect(() => {
    if (!enabled || !Number.isFinite(target)) {
      currentRef.current = target;
      setValue(target);
      return;
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      currentRef.current = target;
      setValue(target);
      return;
    }

    const from = currentRef.current;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (target - from) * eased;
      currentRef.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, enabled, target]);

  return value;
}
