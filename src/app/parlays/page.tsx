import { Disclaimer } from "@/components/disclaimer";
import { LastUpdated } from "@/components/last-updated";
import { ParlayWorkspace } from "@/components/parlay-workspace";
import { getEdges, getLastSync, dataMode } from "@/lib/data/repository";
import { edgeToParlayPick, type ParlayProfile } from "@/lib/parlays";

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
  const [edges, sync] = await Promise.all([getEdges(), getLastSync()]);
  const picks = edges.filter((edge) => edge.qualifies).map(edgeToParlayPick);

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Combinadas pre-partido</h1>
          <p className="text-sm text-muted-foreground">
            Generadas con probabilidad anclada al mercado, EV ajustado y control de riesgo.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Análisis probabilístico, no garantiza resultados.</p>
        </div>
        <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
      </div>

      <Disclaimer compact />
      <ParlayWorkspace picks={picks} initialProfile={profile} initialDebug={debug} />
    </div>
  );
}
