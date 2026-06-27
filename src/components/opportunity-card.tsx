import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { ExpectedValueIndicator } from "@/components/expected-value-indicator";
import { marketLabel, outcomeLabel } from "@/components/outcome-label";
import { ProbabilityBar } from "@/components/probability-bar";
import { RiskBadge } from "@/components/risk-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { StatModelConfidence } from "@/lib/stat-model";
import type { Edge } from "@/lib/types";
import { pct } from "@/lib/utils";

export function OpportunityCard({
  edge,
  confidence,
  rank,
}: {
  edge: Edge;
  confidence?: StatModelConfidence;
  rank: number;
}) {
  const match = edge.match;
  const matchLabel = match
    ? `${match.home_team?.code ?? "LOC"} vs ${match.away_team?.code ?? "VIS"}`
    : "Partido";
  const finalProbability = edge.final_probability ?? edge.model_probability;
  const finalEv = edge.final_expected_value ?? edge.expected_value;
  const finalEdge = edge.final_edge ?? edge.edge;

  return (
    <Card className="overflow-hidden border-border bg-card">
      {/* Header: partido + cuota */}
      <div className="border-b border-border bg-background/40 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            {/* Rank + match identifier */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">#{String(rank).padStart(2, "0")}</span>
              <span className="section-label">{matchLabel}</span>
              <RiskBadge tier={edge.final_tier ?? edge.tier} />
              {confidence && <ConfidenceBadge confidence={confidence} />}
            </div>
            {/* Outcome */}
            <h3 className="text-base font-semibold leading-tight">
              {outcomeLabel(edge.market, edge.outcome, match)}
            </h3>
            <p className="font-mono text-[10px] text-muted-foreground">
              {marketLabel(edge.market)} · {edge.bookmaker}
            </p>
          </div>
          {/* Odds — dato más importante, máxima jerarquía */}
          <div className="text-right">
            <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {edge.decimal_odds.toFixed(2)}
            </p>
            <p className="section-label mt-0.5">CUOTA</p>
          </div>
        </div>
      </div>

      {/* Body: probabilidades + EV */}
      <CardContent className="p-4 space-y-4">
        {/* Barra de probabilidad comparativa */}
        <ProbabilityBar
          label="Prob. modelo vs. mercado"
          modelValue={finalProbability}
          marketValue={edge.implied_probability}
        />

        {/* Grid métricas secundarias */}
        <div className="grid grid-cols-3 gap-2">
          <Metric label="MODELO BASE" value={pct(edge.model_probability)} />
          <Metric label="PROB. FINAL" value={pct(finalProbability)} accent />
          <Metric label="DEVIG" value={pct(edge.implied_probability)} muted />
        </div>

        {/* EV + link */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <ExpectedValueIndicator ev={finalEv} edge={finalEdge} />
          {match && (
            <Link
              href={`/matches/${match.id}`}
              className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary"
            >
              DETALLE <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* Explicación del modelo */}
        {edge.final_probability_explanation && (
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            {edge.final_probability_explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="rounded border border-border bg-background/30 p-2.5">
      <p className="section-label">{label}</p>
      <p className={[
        "mt-1.5 font-mono text-sm font-semibold tabular-nums",
        accent ? "text-accent-foreground" : muted ? "text-muted-foreground" : "text-foreground",
      ].join(" ")}>
        {value}
      </p>
    </div>
  );
}
