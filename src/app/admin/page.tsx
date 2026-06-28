import { getSyncLogs, getLastSync, dataMode, getModelStatus } from "@/lib/data/repository";
import { SyncPanel } from "@/components/sync-panel";
import { LastUpdated } from "@/components/last-updated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminPage() {
  const [logs, sync, modelStatus] = await Promise.all([getSyncLogs(), getLastSync(), getModelStatus()]);
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel Admin</h1>
          <p className="text-sm text-muted-foreground">Sincronización manual y registro de jobs.</p>
        </div>
        <LastUpdated at={sync.at} source={sync.source} mode={dataMode()} />
      </div>

      <SyncPanel />

      {/* Estado del modelo */}
      <Card>
        <CardHeader><CardTitle className="text-base">Estado del modelo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatusMetric label="MARKET_WEIGHT" value={pct(modelStatus.marketWeight)} hint="Peso del mercado en prob. final" />
            <StatusMetric label="Partidos" value={String(modelStatus.tableCounts.matches)} />
            <StatusMetric label="Edges" value={String(modelStatus.tableCounts.edges)} />
            <StatusMetric label="Cuotas (odds)" value={String(modelStatus.tableCounts.odds)} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Último sync por job</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["fixtures", "results", "odds", "predictions"] as const).map((job) => {
                const s = modelStatus.lastSyncByJob[job];
                return (
                  <div key={job} className="rounded-md border border-border bg-muted/20 p-2">
                    <p className="text-xs font-medium capitalize">{job}</p>
                    {s ? (
                      <>
                        <p className="text-xs text-muted-foreground">{timeAgo(s.at ?? "")}</p>
                        <p className="text-xs text-muted-foreground">{s.records} reg.</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {modelStatus.edgesByMarket.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Distribución de edges por mercado</p>
              <div className="space-y-1">
                {modelStatus.edgesByMarket.map(({ market, count, qualifiedCount }) => (
                  <div key={market} className="flex items-center gap-2 text-xs">
                    <span className="w-32 font-mono text-muted-foreground">{market}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (qualifiedCount / Math.max(count, 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="w-16 text-right tabular-nums">{qualifiedCount}/{count} calid.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historial de sincronización</CardTitle></CardHeader>
        <CardContent>
          {dataMode() === "mock" ? (
            <p className="text-sm text-muted-foreground">
              En modo <strong>mock</strong> no se persisten logs. Conecta Supabase y activa
              <code className="mx-1 rounded bg-muted px-1">DATA_MODE=live</code> para ver el historial real.
            </p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros aún.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                  <span className="capitalize">{l.job}</span>
                  <span className="text-muted-foreground">{l.source} · {l.records_affected} reg.</span>
                  <Badge variant={l.status === "success" ? "success" : l.status === "error" ? "danger" : "muted"}>{l.status}</Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(l.finished_at ?? l.started_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3" title={hint}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
