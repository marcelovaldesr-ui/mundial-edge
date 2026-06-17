import { getSyncLogs, getLastSync, dataMode } from "@/lib/data/repository";
import { SyncPanel } from "@/components/sync-panel";
import { LastUpdated } from "@/components/last-updated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [logs, sync] = await Promise.all([getSyncLogs(), getLastSync()]);
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
