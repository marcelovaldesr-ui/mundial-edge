"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const JOBS = [
  { id: "fixtures", label: "Fixtures" },
  { id: "results", label: "Resultados" },
  { id: "odds", label: "Cuotas" },
  { id: "predictions", label: "Predicciones / Edges" },
] as const;

type Result = { job: string; status: string; records: number; message: string; source: string };

export function SyncPanel() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  async function run(path: string, job: string) {
    setLoading(job);
    try {
      const res = await fetch(path, {
        method: "GET",
        headers: secret ? { "x-cron-secret": secret } : {},
      });
      const data = await res.json();
      const arr: Result[] = data.ran ?? [data];
      setResults(arr);
    } catch (e) {
      setResults([{ job, status: "error", records: 0, message: String(e), source: "-" }]);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sincronización manual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            CRON_SECRET (requerido en producción)
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="token de sincronización"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run("/api/cron", "all")} disabled={!!loading}>
            {loading === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Ejecutar todo
          </Button>
          {JOBS.map((j) => (
            <Button key={j.id} variant="outline" disabled={!!loading}
              onClick={() => run(`/api/sync/${j.id}`, j.id)}>
              {loading === j.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {j.label}
            </Button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {r.status === "success"
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  : <XCircle className="mt-0.5 h-4 w-4 text-danger" />}
                <div>
                  <span className="font-medium capitalize">{r.job}</span>
                  <span className="text-muted-foreground"> · {r.source} · {r.records} registros</span>
                  <p className="text-xs text-muted-foreground">{r.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
