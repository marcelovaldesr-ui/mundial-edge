import { AlertTriangle, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CorrelationLevel } from "@/lib/parlays";

export function CorrelationWarning({
  level,
  method,
  reasons,
}: {
  level: CorrelationLevel;
  method: "heuristic" | "score_matrix";
  reasons: string[];
}) {
  const variant = level === "high" ? "danger" : level === "medium" ? "warning" : "muted";
  const hasSameMatch = reasons.some((reason) => reason.toLowerCase().includes("mismo partido") || reason.toLowerCase().includes("matriz"));

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={variant} className="gap-1">
          {level === "high" || level === "medium" ? <AlertTriangle className="h-3 w-3" /> : <GitBranch className="h-3 w-3" />}
          Correlación {level}
        </Badge>
        <Badge variant="outline">{method === "score_matrix" ? "Matriz Poisson" : "Fallback heurístico"}</Badge>
        {hasSameMatch && <Badge variant="warning">Same-match detectado</Badge>}
      </div>
      {reasons.slice(0, 3).map((reason) => (
        <p key={reason} className="mt-2 text-xs text-muted-foreground">{reason}</p>
      ))}
    </div>
  );
}
