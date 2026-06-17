import { AlertTriangle, Info } from "lucide-react";
import type React from "react";

export function ExplanationBox({
  children,
  warning,
}: {
  children: React.ReactNode;
  warning?: boolean;
}) {
  const Icon = warning ? AlertTriangle : Info;
  return (
    <div className="flex gap-2 rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
      <Icon className={"mt-0.5 h-4 w-4 shrink-0 " + (warning ? "text-warning" : "text-primary")} />
      <div className="space-y-1">{children}</div>
    </div>
  );
}
