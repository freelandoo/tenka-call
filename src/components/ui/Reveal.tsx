"use client";

import { useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

interface RevealProps {
  children: ReactNode;
  /** atraso em escada para itens da mesma sequência */
  delay?: number;
  /** deslocamento vertical inicial, em px */
  y?: number;
  className?: string;
}

/**
 * Entrada discreta em GSAP. O `matchMedia` é o que faz a preferência de menos
 * movimento ser respeitada de verdade: com ela ativa o callback nem roda, e o
 * elemento nasce no estado final em vez de animar rápido.
 */
export function Reveal({ children, delay = 0, y = 18, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ref.current, { opacity: 0, y, duration: 0.6, delay, ease: "power3.out" });
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [delay, y] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
