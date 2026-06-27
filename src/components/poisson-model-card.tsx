import { ConfidenceBadge } from "@/components/confidence-badge";
import { ExplanationBox } from "@/components/explanation-box";
import { ProbabilityBar } from "@/components/probability-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTopScorelines, type MatchStatModelPrediction, type StatSelectionKey } from "@/lib/stat-model";
import { pct } from "@/lib/utils";
import { ModelMetadata } from "@/components/model-metadata";
import { PredictionExplainability } from "@/components/prediction-explainability";

export function PoissonModelCard({
  prediction,
  compact = false,
}: {
  prediction: MatchStatModelPrediction;
  compact?: boolean;
}) {
  const topScorelines = getTopScorelines(prediction.scoreMatrix, 5);
  const technicalTie = topScorelines.some((scoreline, index) =>
    index > 0 && Math.abs(topScorelines[index - 1].probability - scoreline.probability) <= 0.0025
  );
  // Alta varianza: si ni el marcador más probable supera ~10%, la distribución
  // es casi plana y el marcador exacto es ruido estadístico, no un pick.
  const topScorelineProbability = topScorelines[0]?.probability ?? 0;
  const highVarianceScoreline = topScorelineProbability < 0.1;

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {prediction.homeTeam.code} vs {prediction.awayTeam.code}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Matriz de marcadores</Badge>
            <Badge variant="muted">{sourceLabel(prediction.expectedGoalsSource)}</Badge>
            <ConfidenceBadge confidence={prediction.confidence} />
            <Badge variant="muted">No apostable sin cuota</Badge>
            {highVarianceScoreline && <Badge variant="warning">Alta varianza</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ModelMetadata
          modelVariantUsed={prediction.modelVariantUsed}
          calibrationUsed={prediction.calibrationUsed}
          configSource={prediction.configSource}
          warnings={prediction.warnings}
          compact
        />
        <div className="grid grid-cols-2 gap-3">
          <Metric label={`xG ${prediction.homeTeam.code}`} value={prediction.homeExpectedGoals.toFixed(2)} />
          <Metric label={`xG ${prediction.awayTeam.code}`} value={prediction.awayExpectedGoals.toFixed(2)} />
          <div className="col-span-2 rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Distribución de marcadores · modelo, no es un pick</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-semibold tabular-nums">
              {topScorelines.map((scoreline) => (
                <span key={`${scoreline.homeGoals}-${scoreline.awayGoals}`}>
                  {scoreline.homeGoals}-{scoreline.awayGoals} <span className="font-normal text-muted-foreground">{pct(scoreline.probability)}</span>
                </span>
              ))}
            </div>
            {highVarianceScoreline && (
              <p className="mt-1 text-xs text-warning">
                Alta varianza: ningún marcador supera el 10%. Es la forma de la distribución, no un marcador recomendado.
              </p>
            )}
            {technicalTie && <p className="mt-1 text-xs text-muted-foreground">Las primeras alternativas están en empate técnico.</p>}
          </div>
          <Metric label={`Rating ${prediction.homeTeam.code}`} value={ratingValue(prediction.homeRating)} />
          <Metric label={`Rating ${prediction.awayTeam.code}`} value={ratingValue(prediction.awayRating)} />
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

        <PredictionExplainability prediction={prediction} compact={compact} />

        <ExplanationBox warning={prediction.confidence === "low"}>
          <p>Probabilidad modelo, no edge apostable todavía.</p>
          <p>
            Blend xG: {prediction.homeTeam.code} usa {(prediction.expectedGoalsBlend.homeRatingWeight * 100).toFixed(0)}% rating /
            {(prediction.expectedGoalsBlend.homeStatsWeight * 100).toFixed(0)}% stats; {prediction.awayTeam.code} usa{" "}
            {(prediction.expectedGoalsBlend.awayRatingWeight * 100).toFixed(0)}% rating /
            {(prediction.expectedGoalsBlend.awayStatsWeight * 100).toFixed(0)}% stats.
          </p>
          {prediction.groupContext && <p>{prediction.groupContext.summary}</p>}
          <p>
            Distribución de matriz (no apostable): {topScorelines.map((scoreline) => `${scoreline.homeGoals}-${scoreline.awayGoals} (${pct(scoreline.probability)})`).join(", ")}.
          </p>
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

function sourceLabel(source: string): string {
  if (source === "rating_stats_blend_v1") return "Rating + stats";
  return "Stats torneo";
}

function ratingValue(rating: MatchStatModelPrediction["homeRating"]): string {
  if (!rating) return "—";
  return `${rating.overallRating} (${rating.source === "manual_seed" ? "seed" : "neutral"})`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
