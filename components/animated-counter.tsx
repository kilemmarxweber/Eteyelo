"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedCounterProps = {
  end: number;
  suffix?: string;
  duration?: number;
};

export function AnimatedCounter({
  end,
  suffix = "",
  duration = 1400,
}: AnimatedCounterProps) {
  const [value, setValue] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const startIfVisible = () => {
      const rect = node.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const visibleY = rect.top < viewportHeight * 0.85 && rect.bottom > 0;
      const visibleX = rect.left < viewportWidth && rect.right > 0;

      if (visibleY && visibleX && document.visibilityState === "visible") {
        setHasStarted(true);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    startIfVisible();

    window.addEventListener("scroll", startIfVisible, { passive: true });
    window.addEventListener("resize", startIfVisible);
    document.addEventListener("visibilitychange", startIfVisible);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", startIfVisible);
      window.removeEventListener("resize", startIfVisible);
      document.removeEventListener("visibilitychange", startIfVisible);
    };
  }, []);

  useEffect(() => {
    if (!hasStarted) {
      return;
    }

    let frameId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(Math.round(end * eased));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [duration, end, hasStarted]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}
