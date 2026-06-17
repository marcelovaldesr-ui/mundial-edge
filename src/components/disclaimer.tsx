import { AlertTriangle } from "lucide-react";
import { DISCLAIMER } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Disclaimer({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn(
      "flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-warning",
      className
    )}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className={cn("leading-snug", compact ? "text-xs" : "text-sm")}>
        <strong>Aviso de riesgo:</strong> {DISCLAIMER} No es asesoría financiera ni una
        recomendación de apuesta. Apuesta de forma responsable; juega solo lo que puedas
        permitirte perder. +18.
      </p>
    </div>
  );
}
