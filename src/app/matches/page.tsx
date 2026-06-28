import { getMatches, getEdges, getLastSync, dataMode, getTeamStats } from "@/lib/data/repository";
import { MatchCard, type DataConfidence } from "@/components/match-card";
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

function confidenceLevel(matchesPlayed: number): DataConfidence {
  if (matchesPlayed >= 4) return "complete";
  if (matchesPlayed >= 2) return "partial";
  return "minimal";
}

export default async function MatchesPage() {
  const [matches, edges, sync, teamStats] = await Promise.all([getMatches(), getEdges(), getLastSync(), getTeamStats()]);
  const best = new Map<string, Edge>();
  for (const e of edges) {
    const cur = best.get(e.match_id);
    if (!cur || e.expected_value > cur.expected_value) best.set(e.match_id, e);
  }

  const statsMap = new Map(teamStats.map((s) => [s.team_id, s.matches_played]));
  const confidenceMap = new Map(
    matches.map((m) => {
      const home = statsMap.get(m.home_team_id) ?? 0;
      const away = statsMap.get(m.away_team_id) ?? 0;
      return [m.id, confidenceLevel(Math.min(home, away))];
    })
  );

  const now = Date.now();
  const upcoming = matches.filter((match) => isPreMatchEligible(match));
  const nextMatch = upcoming
    .filter((m) => new Date(m.kickoff).getTime() > now)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  const nextMatchId = nextMatch?.id;

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
      <MatchSection title="Próximos del Mundial" description="Elegibles para análisis pre-partido si la hora de inicio sigue en el futuro." matches={upcoming} best={best} contexts={contexts} nextMatchId={nextMatchId} confidenceMap={confidenceMap} />
      <MatchSection title="En vivo" description="Partidos del Mundial en seguimiento; no elegibles para pre-partido." matches={live} best={best} contexts={contexts} confidenceMap={confidenceMap} />
      <MatchSection title="Finalizados" description="Historial mundialista con marcador final. No se muestran como oportunidades activas." matches={finished} best={best} contexts={contexts} confidenceMap={confidenceMap} />
      {other.length > 0 && (
        <MatchSection title="Otros / no elegibles" description="Partidos postergados, suspendidos o con fecha vencida sin estado final claro." matches={other} best={best} contexts={contexts} confidenceMap={confidenceMap} />
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
  nextMatchId,
  confidenceMap,
}: {
  title: string;
  description: string;
  matches: Awaited<ReturnType<typeof getMatches>>;
  best: Map<string, Edge>;
  contexts: Map<string, WorldCupGroupContext>;
  nextMatchId?: string;
  confidenceMap?: Map<string, DataConfidence>;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {matches.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              best={best.get(match.id)}
              groupContext={contexts.get(match.id)}
              isNext={match.id === nextMatchId}
              confidence={confidenceMap?.get(match.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          Sin partidos en esta sección.
        </div>
      )}
    </section>
  );
}
