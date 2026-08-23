"use client";

import { useEffect, useRef, useState } from "react";

/** Types `text` out one character at a time with a blinking block cursor,
 *  restarting whenever `text` changes. Resolves immediately for
 *  reduced-motion users so the "terminal boot" feel never blocks anyone
 *  from reading the number.
 *
 *  `speed` is ms per character; `startDelay` staggers a row of these so
 *  four stat tiles don't all type in lockstep. */
export function useTypewriter(text: string, speed = 26, startDelay = 0): string {
  const [out, setOut] = useState("");
  const raf = useRef<number | undefined>(undefined);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(text);
      return;
    }
    setOut("");
    let i = 0;
    let cancelled = false;

    const step = () => {
      if (cancelled) return;
      i += 1;
      setOut(text.slice(0, i) + (i < text.length ? "\u2588" : ""));
      if (i < text.length) timeout.current = setTimeout(step, speed);
    };

    timeout.current = setTimeout(step, startDelay);
    return () => {
      cancelled = true;
      if (timeout.current) clearTimeout(timeout.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, startDelay]);

  return out;
}
