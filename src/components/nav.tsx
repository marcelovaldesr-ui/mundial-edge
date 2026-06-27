"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp } from "lucide-react";

const links = [
  { href: "/",         label: "Dashboard" },
  { href: "/matches",  label: "Partidos" },
  { href: "/edges",    label: "Edges" },
  { href: "/parlays",  label: "Combinadas" },
  { href: "/admin",    label: "Admin" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-4 px-4">
        {/* Marca: amber line + texto monospace */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" strokeWidth={2.5} aria-hidden="true" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            MUNDIAL<span className="text-primary">EDGE</span>
          </span>
          <span className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground sm:inline">
            WC2026
          </span>
        </Link>

        {/* Separador vertical */}
        <div className="h-4 w-px bg-border" />

        {/* Links con active indicator */}
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={[
                  "relative shrink-0 px-3 py-2 font-mono tracking-wide transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {l.label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-px bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status indicator */}
        <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground">LIVE</span>
        </div>
      </div>
    </header>
  );
}
