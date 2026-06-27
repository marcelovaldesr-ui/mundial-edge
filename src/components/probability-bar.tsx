import { cn, pct } from "@/lib/utils";

type ProbabilityBarProps =
  | { label: string; modelValue: number; marketValue: number; value?: never; tone?: never }
  | { label: string; value: number; tone?: "primary" | "success" | "warning" | "danger" | "muted"; modelValue?: never; marketValue?: never };

export function ProbabilityBar(props: ProbabilityBarProps) {
  /* Modo comparativo (modelo vs mercado) */
  if (props.modelValue !== undefined) {
    const mw = `${Math.max(0, Math.min(100, props.marketValue * 100)).toFixed(1)}%`;
    const modw = `${Math.max(0, Math.min(100, props.modelValue * 100)).toFixed(1)}%`;
    const edge = props.modelValue - props.marketValue;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="section-label">{props.label}</span>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-muted-foreground">{pct(props.marketValue)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold text-accent-foreground">{pct(props.modelValue)}</span>
            <span className={cn(
              "font-semibold",
              edge > 0 ? "text-success-foreground" : "text-danger-foreground"
            )}>
              ({edge > 0 ? "+" : ""}{pct(edge)})
            </span>
          </div>
        </div>
        {/* Track doble */}
        <div className="relative h-3 overflow-hidden rounded-[2px] bg-muted">
          {/* Barra mercado (fondo) */}
          <div
            className="absolute inset-y-0 left-0 bg-muted-foreground/30"
            style={{ width: mw }}
          />
          {/* Barra modelo (superpuesta) */}
          <div
            className="absolute inset-y-0 left-0 bg-accent-foreground/70"
            style={{ width: modw }}
          />
        </div>
        <div className="flex items-center gap-4 font-mono text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-[1px] bg-muted-foreground/30" /> MERCADO
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-[1px] bg-accent-foreground/70" /> MODELO
          </span>
        </div>
      </div>
    );
  }

  /* Modo simple (backwards compatible) */
  const width = `${Math.max(0, Math.min(100, props.value! * 100)).toFixed(1)}%`;
  const color =
    props.tone === "success" ? "bg-success-foreground/70"
      : props.tone === "warning" ? "bg-warning/70"
        : props.tone === "danger" ? "bg-danger-foreground/70"
          : props.tone === "muted" ? "bg-muted-foreground/50"
            : "bg-accent-foreground/70";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="section-label">{props.label}</span>
        <span className="font-mono text-xs font-semibold tabular-nums">{pct(props.value!)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-[2px] bg-muted">
        <div className={cn("h-full rounded-[2px]", color)} style={{ width }} />
      </div>
    </div>
  );
}
