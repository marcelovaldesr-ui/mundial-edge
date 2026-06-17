import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

export const fmtEv = (ev: number) =>
  `${ev >= 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`;

export function fmtKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export const DISCLAIMER =
  "El análisis es probabilístico. No garantiza resultados.";
