import { Badge } from "@/components/ui/badge";

export function StakeRecommendation({
  units,
  percent,
  amount,
  reason,
}: {
  units: number;
  percent?: number | null;
  amount?: number | null;
  reason?: string;
}) {
  const label = units > 0 ? `${units.toFixed(2).replace(/\.00$/, "")}u` : "No recomendado";
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Stake sugerido</span>
        <Badge variant={units <= 0.5 ? "warning" : "default"}>{label}</Badge>
      </div>
      {percent != null && amount != null && (
        <p className="mt-1 text-sm font-medium tabular-nums">{(percent * 100).toFixed(2)}% / {formatMoney(amount)}</p>
      )}
      {reason && <p className="mt-1 text-xs text-muted-foreground">{reason}</p>}
    </div>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}
