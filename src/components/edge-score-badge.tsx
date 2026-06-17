import { Badge } from "@/components/ui/badge";
import { fmtEv } from "@/lib/utils";

export function EdgeScoreBadge({ ev }: { ev: number }) {
  const variant = ev >= 0.12 ? "success" : ev >= 0.05 ? "default" : ev >= 0.02 ? "warning" : "muted";
  const label = ev >= 0.12 ? "Edge fuerte" : ev >= 0.05 ? "Edge positivo" : ev >= 0.02 ? "Edge bajo" : "Sin edge";
  return <Badge variant={variant}>{label} {fmtEv(ev)}</Badge>;
}
