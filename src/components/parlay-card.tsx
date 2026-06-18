import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CorrelationWarning } from "@/components/correlation-warning";
import { ExplanationBox } from "@/components/explanation-box";
import { ParlayBreakdown } from "@/components/parlay-breakdown";
import { StakeRecommendation } from "@/components/stake-recommendation";
import type { Parlay, ParlayProfile, ParlayRiskLevel } from "@/lib/parlays";
import { fmtEv, pct } from "@/lib/utils";

const profileLabel: Record<ParlayProfile, string> = {
  conservative: "Conservadora",
  balanced: "Balanceada",
  aggressive: "Agresiva",
};

const riskLabel: Record<ParlayRiskLevel, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  very_high: "Muy alto",
};

const riskVariant: Record<ParlayRiskLevel, "muted" | "default" | "warning" | "danger"> = {
  low: "muted",
  medium: "default",
  high: "warning",
  very_high: "danger",
};

export function ParlayCard({ parlay, index }: { parlay: Parlay; index: number }) {
  const stake = parlay.suggestedStakeUnits > 0
    ? `${parlay.suggestedStakeUnits.toFixed(2).replace(/\.00$/, "")}u`
    : "No recomendado";
  const potentialReturnUnits = parlay.suggestedStakeUnits > 0
    ? parlay.suggestedStakeUnits * parlay.totalOdds
    : 0;
  const potentialReturnAmount = parlay.suggestedStakeAmount != null
    ? parlay.suggestedStakeAmount * parlay.totalOdds
    : null;
  const sameMatch = new Set(parlay.picks.map((pick) => pick.matchId)).size < parlay.picks.length;

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">
              Combinada {profileLabel[parlay.profile]} #{index + 1}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{profileLabel[parlay.profile]}</Badge>
              <Badge variant="outline">{parlay.correlationMethod === "score_matrix" ? "Modelo Mundial Edge disponible" : "Fallback heurístico"}</Badge>
              {sameMatch && <Badge variant="warning">Same-match</Badge>}
              <Badge variant={riskVariant[parlay.riskLevel]}>Riesgo {riskLabel[parlay.riskLevel]}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Score {parlay.score.toFixed(1)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ParlayBreakdown picks={parlay.picks} />

        <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">
          <Metric label="Cuota total" value={parlay.totalOdds.toFixed(2)} />
          <Metric label="Prob. ajustada" value={pct(parlay.jointProbabilityAdjusted)} />
          <Metric label="EV estimado" value={fmtEv(parlay.ev)} accent={parlay.ev > 0} />
          <Metric label="Stake sugerido" value={stake} />
          <Metric
            label="Retorno potencial"
            value={potentialReturnAmount != null ? formatMoney(potentialReturnAmount) : `${potentialReturnUnits.toFixed(2)}u`}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <StakeRecommendation
            units={parlay.suggestedStakeUnits}
            percent={parlay.suggestedStakePercent}
            amount={parlay.suggestedStakeAmount}
            reason={parlay.stakeReason}
          />
          <CorrelationWarning
            level={parlay.correlationLevel}
            method={parlay.correlationMethod}
            reasons={parlay.correlationReasons}
          />
        </div>

        <ExplanationBox warning={parlay.riskLevel === "high" || parlay.riskLevel === "very_high"}>
          <p>{parlay.explanation}</p>
          <p>Supuesto: cada pick usa probabilidad final anclada al mercado; el modelo Mundial Edge informa la señal, pero no crea edges sin cuota real.</p>
          {parlay.warnings.slice(0, 3).map((warning) => (
            <p key={warning}>Advertencia: {warning}</p>
          ))}
        </ExplanationBox>

        <details className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Detalles técnicos</summary>
          <div className="mt-3 grid grid-cols-2 gap-3 text-muted-foreground sm:grid-cols-4">
            <Tech label="Prob. raw" value={pct(parlay.jointProbabilityRaw)} />
            <Tech label="Prob. ajustada" value={pct(parlay.jointProbabilityAdjusted)} />
            <Tech label="Penalty" value={(parlay.jointProbabilityAdjusted / parlay.jointProbabilityRaw).toFixed(2)} />
            <Tech label="Método corr." value={parlay.correlationMethod === "score_matrix" ? "Matriz" : "Heurística"} />
            {parlay.correlationRatio != null && <Tech label="Ratio corr." value={parlay.correlationRatio.toFixed(2)} />}
            {parlay.sameMatchJointProbability != null && <Tech label="Joint same-match" value={pct(parlay.sameMatchJointProbability)} />}
            <Tech label="Risk score" value={String(parlay.riskScore)} />
            <Tech label="Score" value={parlay.score.toFixed(2)} />
            <Tech label="EV" value={fmtEv(parlay.ev)} />
            <Tech label="Cuota" value={parlay.totalOdds.toFixed(2)} />
            <Tech label="Legs" value={String(parlay.picks.length)} />
            {parlay.modelVariantUsed && <Tech label="Modelo" value={parlay.modelVariantUsed} />}
            {parlay.calibrationUsed && <Tech label="Calibración" value={parlay.calibrationUsed} />}
            {parlay.configSource && <Tech label="Config" value={parlay.configSource} />}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"font-semibold tabular-nums " + (accent ? "text-success" : "")}>{value}</p>
    </div>
  );
}

function Tech({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs">{label}</p>
      <p className="font-medium tabular-nums text-foreground">{value}</p>
    </div>
  );
}
