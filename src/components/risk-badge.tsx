import { Badge } from "@/components/ui/badge";
import { TIER_META } from "@/lib/model/edge";
import type { ValueTier } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

const VARIANT: Record<ValueTier, "default" | "muted" | "success" | "warning" | "danger"> = {
  no_bet: "danger",
  no_value: "muted",
  low: "default",
  medium: "success",
  high: "warning",
};

export function RiskBadge({ tier }: { tier: ValueTier }) {
  const meta = TIER_META[tier];
  return (
    <Badge variant={VARIANT[tier]} className="gap-1">
      {meta.warn && <AlertTriangle className="h-3 w-3" />}
      {meta.label}
    </Badge>
  );
}
