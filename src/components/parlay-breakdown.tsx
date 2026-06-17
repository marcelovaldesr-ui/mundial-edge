import { marketLabel, outcomeLabel } from "@/components/outcome-label";
import { ProbabilityBar } from "@/components/probability-bar";
import { Badge } from "@/components/ui/badge";
import type { ParlayPick } from "@/lib/parlays";
import { fmtEv } from "@/lib/utils";

export function ParlayBreakdown({ picks }: { picks: ParlayPick[] }) {
  return (
    <div className="grid gap-2">
      {picks.map((pick, index) => (
        <div key={pick.id} className="rounded-md border border-border bg-background/30 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Leg {index + 1}</Badge>
                <Badge variant="muted">{pick.match?.home_team?.code ?? "LOC"}-{pick.match?.away_team?.code ?? "VIS"}</Badge>
                <Badge variant="outline">{marketLabel(pick.market)}</Badge>
              </div>
              <p className="font-medium">{outcomeLabel(pick.market, pick.selection, pick.match)}</p>
              <p className="text-xs text-muted-foreground">
                {pick.bookmaker ?? "Mercado"} · {pick.probabilitySource === "edge.final_probability_ensemble" ? "probabilidad final calibrada" : "probabilidad anclada"}
              </p>
            </div>
            <div className="text-right tabular-nums">
              <p className="font-semibold">{pick.odds.toFixed(2)}</p>
              <p className="text-xs text-success">EV {fmtEv(pick.ev)}</p>
            </div>
          </div>
          <div className="mt-3">
            <ProbabilityBar label="Probabilidad estimada" value={pick.anchoredProb} tone="success" />
          </div>
          {pick.finalProbabilityBreakdown && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ensemble: mercado {pctWeight(pick.finalProbabilityBreakdown.weights.market)}, Poisson {pctWeight(pick.finalProbabilityBreakdown.weights.poisson)}, ratings {pctWeight(pick.finalProbabilityBreakdown.weights.ratings)}, stats {pctWeight(pick.finalProbabilityBreakdown.weights.realStats)}, contexto {pctWeight(pick.finalProbabilityBreakdown.weights.worldCupContext)}.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function pctWeight(value: number): string {
  return `${Math.round(value * 100)}%`;
}
