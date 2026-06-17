import { notFound } from "next/navigation";
import { getMatch, getEdgesForMatch, getOddsForMatch, getLastSync, dataMode, getTeamStats } from "@/lib/data/repository";
import { EdgeTable } from "@/components/edge-table";
import { ProbabilityChart } from "@/components/probability-chart";
import { LastUpdated } from "@/components/last-updated";
import { Disclaimer } from "@/components/disclaimer";
import { PoissonModelCard } from "@/components/poisson-model-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtKickoff } from "@/lib/utils";
import { buildScoreMatrixForMatch } from "@/lib/stat-model";
import { TeamMark } from "@/components/team-mark";

export const dynamic = "force-dynamic";

export default async function MatchDetail({ params }: { params: { id: string } }) {
  const match = await getMatch(params.id);
  if (!match) notFound();
  const [edges, odds, sync, teamStats] = await Promise.all([
    getEdgesForMatch(params.id), getOddsForMatch(params.id), getLastSync(), getTeamStats(),
  ]);
  const statMap = new Map(teamStats.map((stats) => [stats.team_id, stats]));
  const modelResult = buildScoreMatrixForMatch(
    match,
    statMap.get(match.home_team_id),
    statMap.get(match.away_team_id)
  );
  const modelPrediction = "scoreMatrix" in modelResult ? modelResult : null;

  // Datos del gráfico: 1X2 (modelo vs implícita)
  const x12 = edges.filter((e) => e.market === "1x2");
  const chartData = x12.map((e) => ({
    label: e.outcome === "home" ? (match.home_team?.code ?? "Local")
      : e.outcome === "away" ? (match.away_team?.code ?? "Visita") : "Empate",
    modelo: e.model_probability,
    implícita: e.implied_probability,
  }));

  const bookmakers = Array.from(new Set(odds.map((o) => o.bookmaker)));

  return (
    <div className="space-y-6">
      <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline">{match.stage}</Badge>
            <span className="text-sm text-muted-foreground">{fmtKickoff(match.kickoff)}</span>
          </div>
          <CardTitle className="text-2xl">
            <span className="mr-2 inline-flex align-middle"><TeamMark team={match.home_team} className="h-6 w-6" /></span>{match.home_team?.name}
            <span className="mx-3 text-muted-foreground">vs</span>
            {match.away_team?.name}<span className="ml-2 inline-flex align-middle"><TeamMark team={match.away_team} className="h-6 w-6" /></span>
          </CardTitle>
          <CardDescription>
            {match.venue ?? "Sede por confirmar"} · Casas: {bookmakers.join(", ") || "—"}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Probabilidad: modelo vs. mercado (1X2)</CardTitle></CardHeader>
          <CardContent><ProbabilityChart data={chartData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Cómo leer esto</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Prob. implícita</strong>: lo que la cuota da por probable (1/cuota), ajustada por el margen de la casa.</p>
            <p><strong className="text-foreground">Prob. modelo</strong>: estimación final anclada al mercado, con señal Poisson a partir de goles, forma y rival.</p>
            <p><strong className="text-foreground">Edge</strong> = modelo − implícita. <strong className="text-foreground">EV</strong> = modelo × cuota − 1.</p>
            <Disclaimer compact className="mt-3" />
          </CardContent>
        </Card>
      </div>

      {modelPrediction && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Contexto Poisson del partido</h2>
            <p className="text-sm text-muted-foreground">
              Matriz de marcadores para leer xG, 1X2, goles y doble oportunidad. Es modelo estadístico,
              no edge apostable sin cuota.
            </p>
          </div>
          <PoissonModelCard prediction={modelPrediction} compact />
        </section>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Análisis por selección</CardTitle></CardHeader>
        <CardContent><EdgeTable edges={edges} showMatch={false} /></CardContent>
      </Card>
    </div>
  );
}
