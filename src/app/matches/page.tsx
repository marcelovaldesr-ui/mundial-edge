import { getMatches, getEdges, getLastSync, dataMode } from "@/lib/data/repository";
import { MatchCard } from "@/components/match-card";
import { LastUpdated } from "@/components/last-updated";
import type { Edge } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const [matches, edges, sync] = await Promise.all([getMatches(), getEdges(), getLastSync()]);
  const best = new Map<string, Edge>();
  for (const e of edges) {
    const cur = best.get(e.match_id);
    if (!cur || e.expected_value > cur.expected_value) best.set(e.match_id, e);
  }
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Partidos</h1>
          <p className="text-sm text-muted-foreground">{matches.length} partidos en el sistema.</p>
        </div>
        <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((m) => <MatchCard key={m.id} match={m} best={best.get(m.id)} />)}
      </div>
    </div>
  );
}
