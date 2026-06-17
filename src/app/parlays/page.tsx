import { Disclaimer } from "@/components/disclaimer";
import { LastUpdated } from "@/components/last-updated";
import { ParlayWorkspace } from "@/components/parlay-workspace";
import { Badge } from "@/components/ui/badge";
import { getEdges, getLastSync, dataMode, getMatches, getTeamStats } from "@/lib/data/repository";
import { edgeToParlayPick, type ParlayProfile } from "@/lib/parlays";
import { buildScoreMatricesByMatchId } from "@/lib/stat-model";

export const dynamic = "force-dynamic";

function parseProfile(value: string | string[] | undefined): ParlayProfile {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "conservative" || raw === "aggressive" || raw === "balanced" ? raw : "balanced";
}

function parseDebug(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw === "true";
}

export default async function ParlaysPage({
  searchParams,
}: {
  searchParams: { profile?: string | string[]; debug?: string | string[] };
}) {
  const profile = parseProfile(searchParams.profile);
  const debug = parseDebug(searchParams.debug);
  const [edges, sync, matches, teamStats] = await Promise.all([getEdges(), getLastSync(), getMatches(), getTeamStats()]);
  const picks = edges.filter((edge) => edge.qualifies).map(edgeToParlayPick);
  const statModel = buildScoreMatricesByMatchId(matches, teamStats);

  return (
    <div className="space-y-7">
      <div className="rounded-lg border border-border bg-card/80 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Perfil {profileLabel(profile)}</Badge>
              <Badge variant="success">Probabilidad anclada</Badge>
              <Badge variant="muted">Poisson same-match</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Combinadas pre-partido</h1>
              <p className="text-sm text-muted-foreground">
                Generadas con probabilidad anclada al mercado, EV ajustado, correlación explícita y control de stake.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Análisis probabilístico, no garantiza resultados.</p>
            </div>
          </div>
          <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
        </div>
      </div>

      <Disclaimer compact />
      <ParlayWorkspace
        picks={picks}
        initialProfile={profile}
        initialDebug={debug}
        scoreMatricesByMatchId={statModel.scoreMatricesByMatchId}
        coverage={statModel.coverage}
      />
    </div>
  );
}

function profileLabel(profile: ParlayProfile): string {
  if (profile === "conservative") return "conservador";
  if (profile === "aggressive") return "agresivo";
  return "medio";
}
