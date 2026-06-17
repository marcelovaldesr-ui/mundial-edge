import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { marketLabel, outcomeLabel } from "@/components/outcome-label";
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
  const stake =
    parlay.suggestedStakeUnits > 0
      ? `${parlay.suggestedStakeUnits.toFixed(2).replace(/\.00$/, "")}u`
      : "No recomendado";
  const stakeDetail =
    parlay.suggestedStakePercent != null && parlay.suggestedStakeAmount != null
      ? `${(parlay.suggestedStakePercent * 100).toFixed(2)}% bankroll / ${formatMoney(parlay.suggestedStakeAmount)}`
      : "Referencia en unidades";

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
              <Badge variant="outline">Correlación {parlay.correlationLevel}</Badge>
              <Badge variant={riskVariant[parlay.riskLevel]}>Riesgo {riskLabel[parlay.riskLevel]}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Score {parlay.score.toFixed(1)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          {parlay.picks.map((pick) => (
            <div key={pick.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">
                  {pick.match?.home_team?.code ?? "LOC"}-{pick.match?.away_team?.code ?? "VIS"}:{" "}
                  {outcomeLabel(pick.market, pick.selection, pick.match)}
                </p>
                <p className="text-xs text-muted-foreground">{marketLabel(pick.market)} · {pick.bookmaker ?? "Mercado"}</p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-semibold">{pick.odds.toFixed(2)}</p>
                <p className="text-xs text-success">{fmtEv(pick.ev)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Metric label="Cuota total" value={parlay.totalOdds.toFixed(2)} />
          <Metric label="Prob. ajustada" value={pct(parlay.jointProbabilityAdjusted)} />
          <Metric label="EV estimado" value={fmtEv(parlay.ev)} accent={parlay.ev > 0} />
          <Metric label="Stake sugerido" value={stake} />
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{parlay.explanation}</p>
          <p>Stake: {stakeDetail}. {parlay.stakeReason}</p>
          <p>Supuesto: cada pick usa probabilidad anclada al mercado, no probabilidad Poisson cruda.</p>
          {parlay.correlationReasons.map((reason) => (
            <p key={reason}>Correlación: {reason}</p>
          ))}
          {parlay.warnings.map((warning) => (
            <p key={warning}>Advertencia: {warning}</p>
          ))}
        </div>

        <details className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Detalles técnicos</summary>
          <div className="mt-3 grid grid-cols-2 gap-3 text-muted-foreground sm:grid-cols-4">
            <Tech label="Prob. raw" value={pct(parlay.jointProbabilityRaw)} />
            <Tech label="Prob. ajustada" value={pct(parlay.jointProbabilityAdjusted)} />
            <Tech label="Penalty" value={(parlay.jointProbabilityAdjusted / parlay.jointProbabilityRaw).toFixed(2)} />
            <Tech label="Risk score" value={String(parlay.riskScore)} />
            <Tech label="Score" value={parlay.score.toFixed(2)} />
            <Tech label="EV" value={fmtEv(parlay.ev)} />
            <Tech label="Cuota" value={parlay.totalOdds.toFixed(2)} />
            <Tech label="Legs" value={String(parlay.picks.length)} />
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
