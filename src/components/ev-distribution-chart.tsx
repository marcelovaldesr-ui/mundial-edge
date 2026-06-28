"use client";

import type { Edge } from "@/lib/types";

const BUCKETS = [
  { key: "neg",   label: "< 0%",    min: -Infinity, max: 0,    color: "bg-danger/60" },
  { key: "low",   label: "0–3%",    min: 0,         max: 0.03, color: "bg-muted-foreground/40" },
  { key: "med",   label: "3–8%",    min: 0.03,      max: 0.08, color: "bg-warning/70" },
  { key: "high",  label: "8–15%",   min: 0.08,      max: 0.15, color: "bg-primary/70" },
  { key: "vhigh", label: "> 15%",   min: 0.15,      max: Infinity, color: "bg-success/70" },
];

export function EvDistributionChart({ edges }: { edges: Edge[] }) {
  const counts = BUCKETS.map((b) => ({
    ...b,
    count: edges.filter((e) => e.expected_value >= b.min && e.expected_value < b.max).length,
  }));
  const total = edges.length;
  if (!total) return null;
  const max = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Distribución de Valor Esperado · {total} oportunidades
      </p>
      <div className="flex items-end gap-2 h-20">
        {counts.map((b) => (
          <div key={b.key} className="flex flex-1 flex-col items-center gap-1">
            <span className="font-mono text-[10px] text-muted-foreground">{b.count}</span>
            <div
              className={`w-full rounded-t ${b.color}`}
              style={{ height: `${Math.max(4, (b.count / max) * 56)}px` }}
              title={`${b.label}: ${b.count} edges`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {counts.map((b) => (
          <div key={b.key} className="flex-1 text-center font-mono text-[9px] text-muted-foreground">
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
