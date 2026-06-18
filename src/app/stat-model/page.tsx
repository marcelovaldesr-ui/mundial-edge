import { LastUpdated } from "@/components/last-updated";
import { ExplanationBox } from "@/components/explanation-box";
import { PoissonModelCard } from "@/components/poisson-model-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { dataMode, getLastSync, getMatches, getTeamStats } from "@/lib/data/repository";
import { buildScoreMatricesByMatchId } from "@/lib/stat-model";
import { filterPreMatchMatches } from "@/lib/matches/pre-match-eligibility";
import { GroupSimulationCard } from "@/components/group-simulation-card";
import { createGroupSimulationPreview } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function StatModelPage() {
  const [matches, teamStats, sync] = await Promise.all([getMatches(), getTeamStats(), getLastSync()]);
  const model = buildScoreMatricesByMatchId(matches, teamStats, { predictionConfig: "recommended" });
  const predictions = model.predictions.slice(0, 12);
  const lowConfidence = model.predictions.filter((prediction) => prediction.confidence === "low").length;
  const eligibleMatches = filterPreMatchMatches(matches);
  const nonEligibleMatches = matches.length - eligibleMatches.length;
  const groupSimulationPreview = createGroupSimulationPreview();

  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-border bg-card/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Motor Mundial 2026</Badge>
              <Badge variant="muted">Poisson score matrix v1</Badge>
              {lowConfidence > 0 && <Badge variant="warning">Muestra baja en {lowConfidence} partidos</Badge>}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Modelo Mundial Edge</h1>
            <p className="text-sm text-muted-foreground">
              Probabilidades para partidos pre-partido del Mundial 2026 derivadas de matriz Poisson,
              rating base por selección, stats reales del torneo y contexto de grupos. Esta vista explica el modelo:
              no convierte una probabilidad en edge apostable si no hay cuota real comparable.
            </p>
          </div>
          <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Partidos pre-partido" value={model.coverage.totalPreMatch} helper="universo evaluado" />
        <Metric label="Con matriz" value={model.coverage.withScoreMatrix} helper="cobertura técnica" tone="success" />
        <Metric label="Rating + stats" value={model.predictions.filter((prediction) => prediction.expectedGoalsSource === "rating_stats_blend_v1").length} helper="blend Mundial Edge" />
        <Metric label="No elegibles" value={nonEligibleMatches} helper="live/finalizados/vencidos" tone="warning" />
      </div>

      <ExplanationBox warning={lowConfidence > 0}>
        <p>
          El rating base ayuda a diferenciar selecciones desde el partido 0, pero sigue siendo un seed prudente:
          cuando haya más resultados reales del Mundial, `team_stats` ganará peso. Esta pantalla separa modelo estadístico de edge apostable.
        </p>
      </ExplanationBox>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Simulación de fase de grupos</h2>
          <p className="text-sm text-muted-foreground">
            Primera integración visual del motor Monte Carlo. Esta sección usa un fixture aislado de demostración.
          </p>
        </div>
        <GroupSimulationCard result={groupSimulationPreview} preview />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {predictions.map((prediction) => (
          <PoissonModelCard key={prediction.matchId} prediction={prediction} />
        ))}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={"mt-1 text-2xl font-bold tabular-nums " + (tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "")}>
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}
