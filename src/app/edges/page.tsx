import { getEdges, getLastSync, dataMode, getMatches, getTeamStats } from "@/lib/data/repository";
import { EdgeTable } from "@/components/edge-table";
import { LastUpdated } from "@/components/last-updated";
import { Disclaimer } from "@/components/disclaimer";
import { Card, CardContent } from "@/components/ui/card";
import { buildScoreMatricesByMatchId } from "@/lib/stat-model";
import { decorateEdgesWithFinalProbability } from "@/lib/model/final-probability";

export const dynamic = "force-dynamic";

export default async function EdgesPage() {
  const [edges, sync, matches, teamStats] = await Promise.all([getEdges(), getLastSync(), getMatches(), getTeamStats()]);
  const statModel = buildScoreMatricesByMatchId(matches, teamStats);
  const calibratedEdges = decorateEdgesWithFinalProbability(edges, statModel.predictions);
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
      <Disclaimer compact />
      <Card><CardContent className="pt-5"><EdgeTable edges={calibratedEdges} /></CardContent></Card>
    </div>
  );
}
