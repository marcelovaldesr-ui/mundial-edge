import { cn, pct } from "@/lib/utils";

export function ProbabilityBar({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: number;
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
}) {
  const width = `${Math.max(0, Math.min(100, value * 100)).toFixed(1)}%`;
  const color =
    tone === "success" ? "bg-success"
      : tone === "warning" ? "bg-warning"
        : tone === "danger" ? "bg-danger"
          : tone === "muted" ? "bg-muted-foreground"
            : "bg-primary";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{pct(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width }} />
      </div>
    </div>
  );
}
