import { ConfidenceBadge } from "@/components/confidence-badge";
import { ExplanationBox } from "@/components/explanation-box";
import { ProbabilityBar } from "@/components/probability-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MatchStatModelPrediction, StatSelectionKey } from "@/lib/stat-model";
import { pct } from "@/lib/utils";

export function PoissonModelCard({
  prediction,
  compact = false,
}: {
  prediction: MatchStatModelPrediction;
  compact?: boolean;
}) {
  const likelyScore = mostLikelyScore(prediction);

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {prediction.homeTeam.code} vs {prediction.awayTeam.code}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Modelo Poisson</Badge>
            <ConfidenceBadge confidence={prediction.confidence} />
            <Badge variant="muted">No apostable sin cuota</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric label={`xG ${prediction.homeTeam.code}`} value={prediction.homeExpectedGoals.toFixed(2)} />
          <Metric label={`xG ${prediction.awayTeam.code}`} value={prediction.awayExpectedGoals.toFixed(2)} />
          <Metric label="Score probable" value={`${likelyScore.home}-${likelyScore.away}`} />
          <Metric label="Prob. score" value={pct(likelyScore.probability)} />
        </div>

        <div className="grid gap-3">
          <ProbabilityBar label={`${prediction.homeTeam.code} gana`} value={probValue(prediction, "home_win")} tone="success" />
          <ProbabilityBar label="Empate" value={probValue(prediction, "draw")} tone="muted" />
          <ProbabilityBar label={`${prediction.awayTeam.code} gana`} value={probValue(prediction, "away_win")} tone="primary" />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Más de 2.5 goles" value={prob(prediction, "over_2_5")} />
          <Metric label="Menos de 2.5 goles" value={prob(prediction, "under_2_5")} />
          <Metric label="BTTS sí" value={prob(prediction, "btts_yes")} />
          <Metric label="BTTS no" value={prob(prediction, "btts_no")} />
          {!compact && <Metric label="1X" value={prob(prediction, "double_chance_1x")} />}
          {!compact && <Metric label="X2" value={prob(prediction, "double_chance_x2")} />}
        </div>

        <ExplanationBox warning={prediction.confidence === "low"}>
          <p>Probabilidad modelo, no edge apostable todavía.</p>
          <p>Score más probable por celda de matriz: {likelyScore.home}-{likelyScore.away} ({pct(likelyScore.probability)}).</p>
          {prediction.warnings.slice(0, compact ? 1 : 3).map((warning) => (
            <p key={warning}>Aviso: {warning}</p>
          ))}
        </ExplanationBox>
      </CardContent>
    </Card>
  );
}

function prob(prediction: MatchStatModelPrediction, selection: StatSelectionKey): string {
  return pct(probValue(prediction, selection));
}

function probValue(prediction: MatchStatModelPrediction, selection: StatSelectionKey): number {
  return prediction.marketProbabilities.find((market) => market.selection === selection)?.probability ?? 0;
}

function mostLikelyScore(prediction: MatchStatModelPrediction) {
  const best = prediction.scoreMatrix.entries.reduce(
    (current, entry) => (entry.probability > current.probability ? entry : current),
    prediction.scoreMatrix.entries[0]
  );
  return { home: best.homeGoals, away: best.awayGoals, probability: best.probability };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
