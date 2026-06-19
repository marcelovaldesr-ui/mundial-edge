import Link from "next/link";
import { Activity } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/matches", label: "Partidos" },
  { href: "/edges", label: "Ranking de Edges" },
  { href: "/parlays", label: "Combinadas" },
  { href: "/stat-model", label: "Modelo" },
  { href: "/transparencia", label: "Transparencia" },
  { href: "/metodologia", label: "Metodología" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <Activity className="h-5 w-5 text-primary" />
          <span>Mundial<span className="text-primary">Edge</span></span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className="shrink-0 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
