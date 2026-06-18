import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { ExpectedValueIndicator } from "@/components/expected-value-indicator";
import { marketLabel, outcomeLabel } from "@/components/outcome-label";
import { ProbabilityBar } from "@/components/probability-bar";
import { RiskBadge } from "@/components/risk-badge";
import { Badge } from "@/components/ui/badge";
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
    ? `${match.home_team?.code ?? "LOC"}-${match.away_team?.code ?? "VIS"}`
    : "Partido";
  const finalProbability = edge.final_probability ?? edge.model_probability;
  const finalEv = edge.final_expected_value ?? edge.expected_value;
  const finalEdge = edge.final_edge ?? edge.edge;
  const potential = edge.decimal_odds * finalProbability;

  return (
    <Card className="overflow-hidden bg-card/90">
      <CardContent className="p-0">
        <div className="border-b border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">#{rank}</Badge>
                <Badge variant="outline">{matchLabel}</Badge>
                <RiskBadge tier={edge.tier} />
                {confidence && <ConfidenceBadge confidence={confidence} />}
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {outcomeLabel(edge.market, edge.outcome, match)}
                </h3>
                <p className="text-sm text-muted-foreground">{marketLabel(edge.market)} · {edge.bookmaker}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums">{edge.decimal_odds.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">cuota mercado</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <ProbabilityBar label="Probabilidad final calibrada" value={finalProbability} tone="success" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Mercado devig" value={pct(edge.implied_probability)} />
              <Metric label="Modelo base persistido" value={pct(edge.model_probability)} />
              <Metric label="Retorno estimado" value={`${potential.toFixed(2)}x`} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ExpectedValueIndicator ev={finalEv} edge={finalEdge} />
            {match && (
              <Link
                href={`/matches/${match.id}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Ver partido <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {edge.final_probability_explanation ??
              "Aparece destacada porque supera filtros de calidad: EV razonable, cuota utilizable y probabilidad final calibrada."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
