"use client";

import { ReactNode, useEffect, useRef } from "react";

type ScrollRiseScopeProps = {
  children: ReactNode;
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(Math.max(value, min), max);

const easeOut = (value: number) => 1 - Math.pow(1 - value, 3);

/**
 * Applies a continuous, reversible rise effect to the direct content blocks
 * inside whichever screen is rendered by the terminal. It is deliberately
 * based on getBoundingClientRect rather than an animation timer, so fast and
 * slow scrolling both control the motion directly.
 */
export default function ScrollRiseScope({ children }: ScrollRiseScopeProps) {
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const transitionRoot = scope.firstElementChild as HTMLElement | null;
    if (!transitionRoot) return;

    // Terminal pages are rendered inside a route-transition <section className="fade">.
    // Animate the screen’s actual content blocks beneath it, not the whole screen
    // as one object. This keeps every long screen readable while scrolling.
    const screen = transitionRoot.classList.contains("fade")
      ? (transitionRoot.firstElementChild as HTMLElement | null)
      : transitionRoot;
    if (!screen) return;

    const targets = Array.from(screen.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );

    if (!targets.length) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let frame = 0;

    const update = () => {
      const viewportHeight = window.innerHeight;

      targets.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const start = viewportHeight * 0.98;
        const end = viewportHeight * 0.54;
        const rawProgress = clamp((start - rect.top) / (start - end));
        const progress = reducedMotion
          ? 1
          : rawProgress > 0.84
            ? 0.84 + easeOut((rawProgress - 0.84) / 0.16) * 0.16
            : rawProgress;

        const translateY = reducedMotion ? 0 : (1 - progress) * 58;
        const scale = reducedMotion ? 1 : 0.985 + progress * 0.015;
        const opacity = reducedMotion ? 1 : clamp(0.28 + progress * 0.72);
        const blur = reducedMotion ? 0 : (1 - progress) * 2.5;

        element.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
        element.style.opacity = opacity.toFixed(3);
        element.style.filter = reducedMotion ? "none" : `blur(${blur.toFixed(2)}px)`;
        element.style.willChange = reducedMotion
          ? "auto"
          : "transform, opacity, filter";
      });
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        update();
        frame = 0;
      });
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
      targets.forEach((element) => {
        element.style.transform = "";
        element.style.opacity = "";
        element.style.filter = "";
        element.style.willChange = "";
      });
    };
  }, []);

  return (
    <div ref={scopeRef} className="scroll-rise-scope">
      {children}
    </div>
  );
}
