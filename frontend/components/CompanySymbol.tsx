"use client";

import type { CSSProperties, ReactNode } from "react";

interface CompanySymbolProps {
  /** Stable backend company id. The symbol never changes for the same id. */
  seed: number;
  size?: number;
}

type Glyph = (accent: string) => ReactNode;

const GLYPHS: Glyph[] = [
  (a) => <><path d="M8 17 24 8l16 9-16 9z" /><path d="M8 27 24 36l16-9" /><path d="M24 8v18" /></>,
  (a) => <><circle cx="24" cy="24" r="15" /><circle cx="24" cy="24" r="7" /><path d="M24 5v7M24 36v7M5 24h7M36 24h7" /></>,
  (a) => <><path d="m24 5 4.8 12.2L41 22l-12.2 4.8L24 39l-4.8-12.2L7 22l12.2-4.8z" /><circle cx="24" cy="22" r="3" fill={a} stroke="none" /></>,
  (a) => <><rect x="10" y="10" width="28" height="28" rx="3" /><path d="M10 19h28M10 29h28M19 10v28M29 10v28" /></>,
  (a) => <><path d="M7 31 17 21l7 7 10-14 7 7" /><path d="M34 14h7v7" /><circle cx="17" cy="21" r="2.5" fill={a} stroke="none" /><circle cx="34" cy="14" r="2.5" fill={a} stroke="none" /></>,
  (a) => <><path d="M6 24h8l4-11 6 22 5-15 4 4h7" /><circle cx="24" cy="35" r="2.5" fill={a} stroke="none" /></>,
  (a) => <><path d="M24 6v36M6 24h36" /><circle cx="24" cy="24" r="13" /><circle cx="24" cy="24" r="4" fill={a} stroke="none" /></>,
  (a) => <><path d="m24 6 14 8v16l-14 8-14-8V14z" /><path d="m10 14 14 8 14-8M24 22v16" /></>,
  (a) => <><path d="M8 14h32M8 24h32M8 34h32" /><circle cx="14" cy="14" r="3" fill={a} stroke="none" /><circle cx="30" cy="24" r="3" fill={a} stroke="none" /><circle cx="20" cy="34" r="3" fill={a} stroke="none" /></>,
  (a) => <><path d="M24 7a17 17 0 1 0 17 17" /><path d="M24 14a10 10 0 1 0 10 10" /><path d="M24 21a3 3 0 1 0 3 3" /><path d="M35 7h6v6" /></>,
  (a) => <><path d="M9 30c5-12 11-18 17-18 5 0 8 4 8 9 0 8-6 15-15 15-4 0-7-2-10-6z" /><path d="M15 29c4-5 8-7 12-7 3 0 5 1 7 3" /><circle cx="24" cy="22" r="2.5" fill={a} stroke="none" /></>,
  (a) => <><circle cx="24" cy="24" r="16" /><path d="M24 8v32M8 24h32M13 13l22 22M35 13 13 35" /><circle cx="24" cy="24" r="5" fill={a} stroke="none" /></>,
  (a) => <><path d="M8 34h32M12 28h24M16 22h16M20 16h8M24 10v24" /><circle cx="24" cy="34" r="2.5" fill={a} stroke="none" /></>,
  (a) => <><path d="M12 36 12 21l12-9 12 9v15" /><path d="M18 36V24h12v12M12 21h24" /><circle cx="24" cy="18" r="2.5" fill={a} stroke="none" /></>,
  (a) => <><path d="M24 6v12M24 30v12M6 24h12M30 24h12" /><path d="m12 12 8 8M28 28l8 8M36 12l-8 8M20 28l-8 8" /><circle cx="24" cy="24" r="6" fill={a} stroke="none" /></>,
  (a) => <><path d="M10 15h28v18H10z" /><path d="M16 15v-4h16v4M16 23h16M20 23v10M28 23v10" /><circle cx="24" cy="19" r="2.5" fill={a} stroke="none" /></>,
];

export default function CompanySymbol({ seed, size = 74 }: CompanySymbolProps) {
  const safeSeed = Math.abs(Math.trunc(seed));
  const glyph = GLYPHS[safeSeed % GLYPHS.length];
  const rotation = (safeSeed * 17) % 17 - 8;
  const scale = 0.92 + ((safeSeed * 7) % 9) / 100;
  const variant = safeSeed % 3;
  const style: CSSProperties = {
    width: size,
    height: size,
    transform: `rotate(${rotation}deg) scale(${scale})`,
  };

  return (
    <svg
      className="dc-symbol"
      viewBox="0 0 48 48"
      style={style}
      role="img"
      aria-label={`Company symbol ${safeSeed}`}
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        {glyph("var(--teal-soft)")}
      </g>
      {variant > 0 && <circle className="dc-symbol-orbit" cx="24" cy="24" r={19 + variant} />}
      {variant === 2 && <circle className="dc-symbol-dot" cx="39" cy="12" r="1.5" />}
    </svg>
  );
}
