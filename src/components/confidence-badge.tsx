import { Badge } from "@/components/ui/badge";
import type { StatModelConfidence } from "@/lib/stat-model";

const LABEL: Record<StatModelConfidence, string> = {
  none: "Sin confianza",
  low: "Confianza baja",
  medium: "Confianza media",
  high: "Confianza alta",
};

const VARIANT: Record<StatModelConfidence, "muted" | "warning" | "success" | "danger"> = {
  none: "danger",
  low: "muted",
  medium: "warning",
  high: "success",
};

export function ConfidenceBadge({ confidence }: { confidence: StatModelConfidence }) {
  return <Badge variant={VARIANT[confidence]}>{LABEL[confidence]}</Badge>;
}
