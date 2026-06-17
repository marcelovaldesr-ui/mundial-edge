import { getMatches, getEdges, getLastSync, dataMode } from "@/lib/data/repository";
import { MatchCard } from "@/components/match-card";
import { EdgeTable } from "@/components/edge-table";
import { LastUpdated } from "@/components/last-updated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclaimer } from "@/components/disclaimer";
import type { Edge } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [matches, edges, sync] = await Promise.all([getMatches(), getEdges(), getLastSync()]);

  const bestByMatch = new Map<string, Edge>();
  for (const e of edges) {
    const cur = bestByMatch.get(e.match_id);
    if (!cur || e.expected_value > cur.expected_value) bestByMatch.set(e.match_id, e);
  }
  const upcoming = matches.filter((m) => m.status === "scheduled").slice(0, 6);
  const topEdges = edges.filter((e) => e.expected_value >= 0.03).slice(0, 8);

  const valueCount = edges.filter((e) => e.expected_value >= 0.03).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Probabilidades del modelo frente a las cuotas del mercado.
          </p>
        </div>
        <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Partidos próximos" value={upcoming.length} />
        <Stat label="Selecciones analizadas" value={edges.length} />
        <Stat label="Con valor (EV ≥ 3%)" value={valueCount} accent />
        <Stat label="Modelo" value="Poisson v1" small />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Próximos partidos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((m) => <MatchCard key={m.id} match={m} best={bestByMatch.get(m.id)} />)}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mejores oportunidades</h2>
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

function Stat({ label, value, accent, small }: { label: string; value: string | number; accent?: boolean; small?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={(small ? "text-lg" : "text-2xl") + " font-bold tabular-nums " + (accent ? "text-success" : "")}>{value}</p>
      </CardContent>
    </Card>
  );
}
