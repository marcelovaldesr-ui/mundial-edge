import { getTopEdges, getLastSync, dataMode, getMatches, getTeamStats } from "@/lib/data/repository";
import { LastUpdated } from "@/components/last-updated";
import { Disclaimer } from "@/components/disclaimer";
import { Card, CardContent } from "@/components/ui/card";
import { EvDistributionChart } from "@/components/ev-distribution-chart";
import { EdgesClient } from "@/components/edges-client";
import { buildScoreMatricesByMatchId } from "@/lib/stat-model";
import { decorateEdgesWithFinalProbability } from "@/lib/model/final-probability";
import { ModelMetadata } from "@/components/model-metadata";
import { getRecommendedPredictionConfig } from "@/lib/stat-model";
import { getTopRecommendations } from "@/lib/model/recommendations";
import { TopRecommendations } from "@/components/top-recommendations";
import { getMatchEnvironmentMap } from "@/lib/context/match-environment";
import { computeEnvironmentModifier } from "@/lib/context/environment-modifiers";
import { filterPreMatchMatches } from "@/lib/matches/pre-match-eligibility";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function EdgesPage() {
  const [edges, sync, matches, teamStats] = await Promise.all([getTopEdges(), getLastSync(), getMatches(), getTeamStats()]);
  const config = getRecommendedPredictionConfig();

  // Pilar 3: fatiga, altitud, clima → modificadores de lambda por partido
  const preMatchEdges = filterPreMatchMatches(matches);
  const envDataMap = await getMatchEnvironmentMap(preMatchEdges, matches).catch(() => new Map());
  const environmentModifiersByMatchId = new Map(
    [...envDataMap.entries()].map(([id, env]) => [id, computeEnvironmentModifier(env)])
  );

  const statModel = buildScoreMatricesByMatchId(matches, teamStats, {
    predictionConfig: config,
    environmentModifiersByMatchId,
  });
  const calibratedEdges = decorateEdgesWithFinalProbability(edges, statModel.predictions);
  const recommendations = getTopRecommendations(calibratedEdges);
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ranking de Edges</h1>
          <p className="text-sm text-muted-foreground">
            Solo oportunidades pre-partido elegibles, ordenables por valor esperado.
          </p>
        </div>
        <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
      </div>
      <TopRecommendations recommendations={recommendations} />
      <ModelMetadata
        modelVariantUsed={config.modelVariant}
        calibrationUsed={config.calibration}
        configSource={config.configSource}
        warnings={statModel.coverage.issues.map((issue) => `${issue.matchId}: ${issue.reason}`)}
      />
      <Disclaimer compact />
      {calibratedEdges.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <p className="font-semibold text-foreground">No hay oportunidades que pasen los filtros de calidad en este momento.</p>
            <p className="text-sm text-muted-foreground">Esto es correcto: un sistema riguroso muestra pocos picks, no muchos.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {calibratedEdges.length < 3 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
              Solo {calibratedEdges.length} oportunidad{calibratedEdges.length === 1 ? "" : "es"} pasan el filtro de calidad hoy. Menos picks, más rigor.
            </div>
          )}
          <EvDistributionChart edges={calibratedEdges} />
          <EdgesClient edges={calibratedEdges} />
        </>
      )}
    </div>
  );
}
