import { TIER_META } from "@/lib/model/edge";
import type { ValueTier } from "@/lib/types";

const STYLE: Record<ValueTier, { bar: string; text: string; bars: number }> = {
  no_bet:   { bar: "bg-danger/60",              text: "text-danger-foreground",    bars: 0 },
  no_value: { bar: "bg-muted-foreground/40",    text: "text-muted-foreground",     bars: 1 },
  low:      { bar: "bg-accent-foreground/50",   text: "text-accent-foreground",    bars: 2 },
  medium:   { bar: "bg-warning/60",             text: "text-warning",              bars: 3 },
  high:     { bar: "bg-success-foreground/60",  text: "text-success-foreground",   bars: 4 },
};

export function RiskBadge({ tier }: { tier: ValueTier }) {
  const meta = TIER_META[tier];
  const style = STYLE[tier];
  return (
    <span className="inline-flex items-center gap-1.5">
      {/* 4 barras de nivel */}
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={["rounded-[1px] w-[3px]", i < style.bars ? style.bar : "bg-muted-foreground/20"].join(" ")}
            style={{ height: `${6 + i * 2}px` }}
          />
        ))}
      </span>
      <span className={["font-mono text-[10px] font-medium tracking-wide", style.text].join(" ")}>
        {meta.label.toUpperCase()}
      </span>
    </span>
  );
}
