import { getMatches, getEdges, getLastSync, dataMode, getTeamStats } from "@/lib/data/repository";
import { MatchCard } from "@/components/match-card";
import { EdgeTable } from "@/components/edge-table";
import { LastUpdated } from "@/components/last-updated";
import { Card, CardContent } from "@/components/ui/card";
import { Disclaimer } from "@/components/disclaimer";
import type { Edge } from "@/lib/types";
import { buildParlayStatModel, edgeToParlayPick, generateParlays } from "@/lib/parlays";
import { ParlayCard } from "@/components/parlay-card";
import { DashboardStats } from "@/components/dashboard-stats";
import { OpportunityCard } from "@/components/opportunity-card";
import { PickCard } from "@/components/pick-card";
import { Badge } from "@/components/ui/badge";
import { filterPreMatchMatches } from "@/lib/matches/pre-match-eligibility";
import { getWorldCupGroupContext } from "@/lib/world-cup";
import { decorateEdgesWithFinalProbability } from "@/lib/model/final-probability";
import Link from "next/link";
import { ModelMetadata } from "@/components/model-metadata";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function DashboardPage() {
  const [matches, edges, sync, teamStats] = await Promise.all([getMatches(), getEdges(), getLastSync(), getTeamStats()]);
  const statModel = buildParlayStatModel(matches, teamStats, "recommended");
  const calibratedEdges = decorateEdgesWithFinalProbability(edges, statModel.predictions);
  const confidenceByMatchId = new Map(statModel.predictions.map((prediction) => [prediction.matchId, prediction.confidence]));

  // Solo picks de calidad (filtros estilo tipster) para destacar.
  const quality = calibratedEdges.filter((e) => e.qualifies);

  const bestByMatch = new Map<string, Edge>();
  for (const e of quality) {
    const cur = bestByMatch.get(e.match_id);
    if (!cur || (e.final_expected_value ?? e.expected_value) > (cur.final_expected_value ?? cur.expected_value)) bestByMatch.set(e.match_id, e);
  }
  const upcoming = filterPreMatchMatches(matches).slice(0, 6);
  const topEdges = [...quality].sort((a, b) => (b.final_expected_value ?? b.expected_value) - (a.final_expected_value ?? a.expected_value)).slice(0, 8);
  const featuredEdges = topEdges.slice(0, 3);
  const secondaryPicks = topEdges.slice(3, 7);
  const topParlays = generateParlays(quality.map(edgeToParlayPick), {
    profile: "balanced",
    maxResults: 3,
    scoreMatricesByMatchId: statModel.scoreMatricesByMatchId,
    predictionMetadata: {
      modelVariantUsed: statModel.modelVariantUsed,
      calibrationUsed: statModel.calibrationUsed,
      configSource: statModel.configSource,
      warnings: statModel.warnings,
    },
  });

  const valueCount = quality.length;
  const lowConfidenceCount = featuredEdges.filter((edge) => confidenceByMatchId.get(edge.match_id) === "low").length;

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card/80 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Mundial Edge</Badge>
              <Badge variant="success">Modo tipster</Badge>
              <Badge variant="muted">Modelo Mundial Edge</Badge>
              {lowConfidenceCount > 0 && <Badge variant="warning">Muestra baja en destacados</Badge>}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Mesa pre-partido Mundial 2026</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Oportunidades del Mundial, picks y combinadas con probabilidad anclada al mercado,
                ratings base por selección, EV filtrado y avisos de riesgo.
              </p>
            </div>
          </div>
          <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
        </div>
      </section>

      <ModelMetadata
        modelVariantUsed={statModel.modelVariantUsed}
        calibrationUsed={statModel.calibrationUsed}
        configSource={statModel.configSource}
        warnings={statModel.warnings}
      />

      <DashboardStats
        items={[
          { label: "Partidos del Mundial", value: upcoming.length, helper: "pre-partido elegibles" },
          { label: "Edges analizados", value: calibratedEdges.length, helper: "mercados con cuota" },
          { label: "Picks de calidad", value: valueCount, helper: "pasan modo tipster", tone: "success" },
          { label: "Matrices de marcadores", value: statModel.coverage.withScoreMatrix, helper: "pre-partido cubiertos" },
        ]}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Oportunidades destacadas</h2>
            <p className="text-sm text-muted-foreground">
              Picks apostables del Mundial: tienen cuota real, probabilidad anclada y EV positivo dentro de rangos razonables.
            </p>
          </div>
          <Link href="/edges" className="text-sm text-primary hover:underline">Ver ranking completo</Link>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {featuredEdges.map((edge, index) => (
            <OpportunityCard
              key={edge.id}
              edge={edge}
              rank={index + 1}
              confidence={confidenceByMatchId.get(edge.match_id)}
            />
          ))}
          {featuredEdges.length === 0 && (
            <Card className="xl:col-span-3">
              <CardContent className="pt-5 text-sm text-muted-foreground">
                No hay oportunidades destacadas que pasen los filtros actuales. Es una salida sana cuando el mercado está eficiente.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">Picks individuales</h2>
            <p className="text-sm text-muted-foreground">Lectura rápida por selección: probabilidad, cuota, EV y confianza.</p>
          </div>
          <div className="grid gap-3">
            {secondaryPicks.map((edge) => (
              <PickCard
                key={edge.id}
                edge={edge}
                confidence={confidenceByMatchId.get(edge.match_id)}
                compact
              />
            ))}
            {secondaryPicks.length === 0 && (
              <Card>
                <CardContent className="pt-5 text-sm text-muted-foreground">
                  Aún no hay picks secundarios para mostrar.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Combinadas sugeridas</h2>
              <p className="text-sm text-muted-foreground">
                Preview balanceada con matriz de marcadores para correlaciones same-match cuando aplica.
              </p>
            </div>
            <Link href="/parlays" className="text-sm text-primary hover:underline">Abrir constructor</Link>
          </div>
          <div className="grid gap-4">
            {topParlays.map((parlay, index) => (
              <ParlayCard key={parlay.id} parlay={parlay} index={index} />
            ))}
            {topParlays.length === 0 && (
              <Card>
                <CardContent className="pt-5 text-sm text-muted-foreground">
                  No hay combinadas medias que pasen los filtros actuales.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Próximos partidos</h2>
          <p className="text-sm text-muted-foreground">Contexto de fase de grupos y mejor pick por partido cuando existe.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((m) => <MatchCard key={m.id} match={m} best={bestByMatch.get(m.id)} groupContext={getWorldCupGroupContext(m, matches)} />)}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Tabla auditora</h2>
          <p className="text-sm text-muted-foreground">Vista tabular para revisar mercados y ordenar por EV.</p>
        </div>
        <Disclaimer compact />
        <Card>
          <CardContent className="pt-5">
            <EdgeTable edges={topEdges} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
