import { LastUpdated } from "@/components/last-updated";
import { ExplanationBox } from "@/components/explanation-box";
import { PoissonModelCard } from "@/components/poisson-model-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { dataMode, getLastSync, getMatches, getTeamStats } from "@/lib/data/repository";
import { buildScoreMatricesByMatchId } from "@/lib/stat-model";

export const dynamic = "force-dynamic";

export default async function StatModelPage() {
  const [matches, teamStats, sync] = await Promise.all([getMatches(), getTeamStats(), getLastSync()]);
  const model = buildScoreMatricesByMatchId(matches, teamStats);
  const predictions = model.predictions.slice(0, 12);
  const lowConfidence = model.predictions.filter((prediction) => prediction.confidence === "low").length;

  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-border bg-card/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Motor estadístico</Badge>
              <Badge variant="muted">Poisson score matrix v1</Badge>
              {lowConfidence > 0 && <Badge variant="warning">Muestra baja en {lowConfidence} partidos</Badge>}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Modelo Poisson</h1>
            <p className="text-sm text-muted-foreground">
              Probabilidades pre-partido derivadas de una matriz de marcadores. Esta vista explica el modelo:
              no convierte una probabilidad en edge apostable si no hay cuota real comparable.
            </p>
          </div>
          <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Partidos pre-partido" value={model.coverage.totalPreMatch} helper="universo evaluado" />
        <Metric label="Con matriz" value={model.coverage.withScoreMatrix} helper="cobertura técnica" tone="success" />
        <Metric label="Stats suficientes" value={model.coverage.withSufficientTeamStats} helper="confianza media/alta" />
        <Metric label="Sin matriz" value={model.coverage.withoutScoreMatrix} helper="fallback pendiente" tone="warning" />
      </div>

      <ExplanationBox warning={lowConfidence > 0}>
        <p>
          La cobertura técnica es amplia, pero la confianza puede ser baja porque muchos equipos todavía no tienen
          partidos finalizados en `team_stats`. Por eso esta pantalla separa modelo estadístico de edge apostable.
        </p>
      </ExplanationBox>

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
