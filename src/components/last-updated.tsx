import { RefreshCw, Database } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export function LastUpdated({ at, source, mode }: { at: string | null; source: string; mode: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <RefreshCw className="h-3.5 w-3.5" /> Última actualización: {timeAgo(at)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Database className="h-3.5 w-3.5" /> Fuente: {source}
        <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wide">{mode}</span>
      </span>
    </div>
  );
}
