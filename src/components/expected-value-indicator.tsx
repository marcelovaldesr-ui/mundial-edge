import { EdgeScoreBadge } from "@/components/edge-score-badge";
import { Badge } from "@/components/ui/badge";
import { fmtEv } from "@/lib/utils";

export function ExpectedValueIndicator({
  ev,
  edge,
  compact = false,
}: {
  ev: number;
  edge?: number;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <EdgeScoreBadge ev={ev} />
      {!compact && edge != null && (
        <Badge variant={edge > 0 ? "success" : "muted"}>Edge {fmtEv(edge)}</Badge>
      )}
    </div>
  );
}
