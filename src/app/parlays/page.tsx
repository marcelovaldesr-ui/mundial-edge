import { Disclaimer } from "@/components/disclaimer";
import { LastUpdated } from "@/components/last-updated";
import { ParlayWorkspace } from "@/components/parlay-workspace";
import { Badge } from "@/components/ui/badge";
import { getAllEdges, getEdges, getLastSync, dataMode, getMatches, getTeamStats } from "@/lib/data/repository";
import { buildParlayStatModel, buildCandidatePicks, type ParlayProfile } from "@/lib/parlays";
import { decorateEdgesWithFinalProbability } from "@/lib/model/final-probability";
import { ModelMetadata } from "@/components/model-metadata";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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
  const [edges, allEdges, sync, matches, teamStats] = await Promise.all([getEdges(), getAllEdges(), getLastSync(), getMatches(), getTeamStats()]);
  const statModel = buildParlayStatModel(matches, teamStats, "recommended");
  const calibratedEdges = decorateEdgesWithFinalProbability(edges, statModel.predictions);
  // El motor aplica edge/confianza según el nivel elegido; no descartamos aquí los picks low.
  const picks = buildCandidatePicks(calibratedEdges, statModel.predictions, matches);
  const excludedNonPreMatch = Math.max(0, allEdges.length - edges.length);

  return (
    <div className="space-y-7">
      <div className="rounded-lg border border-border bg-card/80 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Perfil {profileLabel(profile)}</Badge>
              <Badge variant="success">Probabilidad anclada</Badge>
              <Badge variant="muted">Matriz de marcadores same-match</Badge>
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

      <ModelMetadata
        modelVariantUsed={statModel.modelVariantUsed}
        calibrationUsed={statModel.calibrationUsed}
        configSource={statModel.configSource}
        warnings={statModel.warnings}
      />

      <Disclaimer compact />
      <ParlayWorkspace
        picks={picks}
        initialProfile={profile}
        initialDebug={debug}
        scoreMatricesByMatchId={statModel.scoreMatricesByMatchId}
        predictionMetadata={{
          modelVariantUsed: statModel.modelVariantUsed,
          calibrationUsed: statModel.calibrationUsed,
          configSource: statModel.configSource,
          warnings: statModel.warnings,
        }}
        coverage={statModel.coverage}
        excludedNonPreMatchEdges={excludedNonPreMatch}
      />
    </div>
  );
}

function profileLabel(profile: ParlayProfile): string {
  if (profile === "conservative") return "conservador";
  if (profile === "aggressive") return "agresivo";
  return "medio";
}
