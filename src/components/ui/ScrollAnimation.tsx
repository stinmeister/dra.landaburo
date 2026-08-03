'use client';

import { useEffect, useRef } from 'react';

interface ScrollAnimationProps {
  children: React.ReactNode;
  className?: string;
  /** Animation variant */
  variant?: 'fade-up' | 'zoom-in' | 'fade-left' | 'fade-right' | 'fade-in';
  /** Alias for variant (backward compat) */
  animation?: string;
  /** Delay in ms or seconds (auto-detected: < 10 = seconds, >= 10 = ms) */
  delay?: number;
  threshold?: number;
}

export default function ScrollAnimation({
  children,
  className = '',
  variant,
  animation,
  delay = 0,
  threshold = 0.15,
}: ScrollAnimationProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Support both 'variant' and 'animation' props
  const effectiveVariant = variant || animation || 'fade-up';

  // Auto-detect delay unit: if < 10, assume seconds and convert to ms
  const delayMs = delay < 10 && delay > 0 ? delay * 1000 : delay;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            element.classList.add('is-visible');
          }, delayMs);
          observer.unobserve(element);
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [delayMs, threshold]);

  const variantClass =
    effectiveVariant === 'zoom-in'
      ? 'zoom-in'
      : effectiveVariant === 'fade-left'
        ? 'fade-left'
        : effectiveVariant === 'fade-right'
          ? 'fade-right'
          : '';

  return (
    <div
      ref={ref}
      className={`animate-on-scroll ${variantClass} ${className}`}
    >
      {children}
    </div>
  );
}
