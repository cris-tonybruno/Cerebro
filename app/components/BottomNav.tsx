"use client";

import Link from "next/link";

// A barra da casa: CONVERSAS · O · MEMÓRIAS (mockup do Cris)
export default function BottomNav({ active }: { active?: "arquivo" | "home" | "memorias" }) {
  return (
    <nav className="flex items-center justify-between px-8 py-3 border-t border-line bg-background">
      <Link
        href="/arquivo"
        className={`etiqueta ${active === "arquivo" ? "text-gold" : "text-muted"}`}
      >
        Conversas
      </Link>
      <Link href="/" aria-label="Oliver">
        <span
          className={`anel w-11 h-11 text-lg ${active === "home" ? "" : "opacity-70"}`}
        >
          O
        </span>
      </Link>
      <Link
        href="/memory"
        className={`etiqueta ${active === "memorias" ? "text-gold" : "text-muted"}`}
      >
        Memórias
      </Link>
    </nav>
  );
}
