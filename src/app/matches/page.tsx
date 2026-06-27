import { getMatches, getEdges, getLastSync, dataMode } from "@/lib/data/repository";
import { MatchCard } from "@/components/match-card";
import { LastUpdated } from "@/components/last-updated";
import type { Edge } from "@/lib/types";
import {
  isFinishedMatch,
  isLiveMatch,
  isPreMatchEligible,
} from "@/lib/matches/pre-match-eligibility";
import { getWorldCupGroupContext, type WorldCupGroupContext } from "@/lib/world-cup";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function MatchesPage() {
  const [matches, edges, sync] = await Promise.all([getMatches(), getEdges(), getLastSync()]);
  const best = new Map<string, Edge>();
  for (const e of edges) {
    const cur = best.get(e.match_id);
    if (!cur || e.expected_value > cur.expected_value) best.set(e.match_id, e);
  }
  const upcoming = matches.filter((match) => isPreMatchEligible(match));
  const live = matches.filter((match) => isLiveMatch(match));
  const finished = matches.filter((match) => isFinishedMatch(match));
  const other = matches.filter(
    (match) =>
      !isPreMatchEligible(match) &&
      !isLiveMatch(match) &&
      !isFinishedMatch(match)
  );
  const contexts = new Map(matches.map((match) => [match.id, getWorldCupGroupContext(match, matches)]));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Partidos del Mundial 2026</h1>
          <p className="text-sm text-muted-foreground">
            Calendario, fase de grupos e historial: {upcoming.length} próximos, {live.length} en vivo, {finished.length} finalizados.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
          <Badge variant="outline">Oportunidades: modelo base persistido</Badge>
        </div>
      </div>
      <MatchSection title="Próximos del Mundial" description="Elegibles para análisis pre-partido si la hora de inicio sigue en el futuro." matches={upcoming} best={best} contexts={contexts} />
      <MatchSection title="En vivo" description="Partidos del Mundial en seguimiento; no elegibles para pre-partido." matches={live} best={best} contexts={contexts} />
      <MatchSection title="Finalizados" description="Historial mundialista con marcador final. No se muestran como oportunidades activas." matches={finished} best={best} contexts={contexts} />
      {other.length > 0 && (
        <MatchSection title="Otros / no elegibles" description="Partidos postergados, suspendidos o con fecha vencida sin estado final claro." matches={other} best={best} contexts={contexts} />
      )}
    </div>
  );
}

function MatchSection({
  title,
  description,
  matches,
  best,
  contexts,
}: {
  title: string;
  description: string;
  matches: Awaited<ReturnType<typeof getMatches>>;
  best: Map<string, Edge>;
  contexts: Map<string, WorldCupGroupContext>;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {matches.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => <MatchCard key={match.id} match={match} best={best.get(match.id)} groupContext={contexts.get(match.id)} />)}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          Sin partidos en esta sección.
        </div>
      )}
    </section>
  );
}
