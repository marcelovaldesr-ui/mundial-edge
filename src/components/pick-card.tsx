import { ExpectedValueIndicator } from "@/components/expected-value-indicator";
import { marketLabel, outcomeLabel } from "@/components/outcome-label";
import { ProbabilityBar } from "@/components/probability-bar";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
import type { Edge } from "@/lib/types";
import { fmtEv, pct } from "@/lib/utils";

export function PickCard({
  edge,
  confidence,
  compact = false,
}: {
  edge: Edge;
  confidence?: "none" | "low" | "medium" | "high";
  compact?: boolean;
}) {
  const match = edge.match;
  const pickLabel = outcomeLabel(edge.market, edge.outcome, match);
  const matchLabel = match
    ? `${match.home_team?.code ?? "LOC"}-${match.away_team?.code ?? "VIS"}`
    : "Partido";
  const finalProbability = edge.final_probability ?? edge.model_probability;
  const finalEv = edge.final_expected_value ?? edge.expected_value;
  const finalEdge = edge.final_edge ?? edge.edge;
  const estimatedReturn = edge.decimal_odds * finalProbability;

  return (
    <div className="rounded-lg border border-border bg-card/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{matchLabel}</Badge>
            <RiskBadge tier={edge.tier} />
            {confidence === "low" && <Badge variant="warning">Confianza baja</Badge>}
          </div>
          <h3 className="text-base font-semibold">{pickLabel}</h3>
          <p className="text-xs text-muted-foreground">
            {marketLabel(edge.market)} · {edge.bookmaker}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{edge.decimal_odds.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">cuota</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ProbabilityBar label="Probabilidad final" value={finalProbability} tone="success" />
        <div className="rounded-md bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Retorno estimado</p>
          <p className="font-semibold tabular-nums">{estimatedReturn.toFixed(2)}x</p>
          <p className="text-xs text-muted-foreground">EV {fmtEv(finalEv)} · mercado {pct(edge.implied_probability)} · modelo base {pct(edge.model_probability)}</p>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 space-y-2">
          <ExpectedValueIndicator ev={finalEv} edge={finalEdge} />
          <p className="text-sm text-muted-foreground">
            {edge.final_probability_explanation ??
              "Recomendado porque pasa filtros de calidad: cuota dentro de rango, EV positivo razonable y probabilidad anclada al mercado."}
          </p>
        </div>
      )}
    </div>
  );
}
