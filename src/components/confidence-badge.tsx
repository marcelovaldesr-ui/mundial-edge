import type { StatModelConfidence } from "@/lib/stat-model";

const CONFIG: Record<StatModelConfidence, { dots: number; label: string; colorClass: string }> = {
  none:   { dots: 1, label: "Sin datos",       colorClass: "text-muted-foreground" },
  low:    { dots: 2, label: "Conf. baja",      colorClass: "text-muted-foreground" },
  medium: { dots: 3, label: "Conf. media",     colorClass: "text-warning" },
  high:   { dots: 4, label: "Conf. alta",      colorClass: "text-success-foreground" },
};

export function ConfidenceBadge({ confidence }: { confidence: StatModelConfidence }) {
  const cfg = CONFIG[confidence];
  return (
    <span className={["inline-flex items-center gap-1 font-mono text-[10px] tracking-wide", cfg.colorClass].join(" ")}>
      <span aria-hidden="true" className="contents">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={[
              "inline-block h-1.5 w-1.5 rounded-[1px]",
              i < cfg.dots ? "bg-current" : "bg-current opacity-20",
            ].join(" ")}
          />
        ))}
      </span>
      <span className="ml-0.5">{cfg.label}</span>
    </span>
  );
}
