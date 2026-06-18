import { Badge } from "@/components/ui/badge";
import {
  calibrationLabel,
  configSourceLabel,
  modelConfigurationLabel,
  modelVariantLabel,
} from "@/lib/stat-model/model-labels";
import type { PredictionConfigSource, StatModelCalibrationMode, StatModelVariant } from "@/lib/stat-model";

export function ModelMetadata({
  modelVariantUsed,
  calibrationUsed,
  configSource,
  warnings = [],
  compact = false,
}: {
  modelVariantUsed: StatModelVariant;
  calibrationUsed: StatModelCalibrationMode;
  configSource: PredictionConfigSource;
  warnings?: string[];
  compact?: boolean;
}) {
  const safeWarnings = warnings.filter((warning) => warning.trim()).slice(0, compact ? 2 : 5);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="muted">{modelConfigurationLabel(modelVariantUsed, calibrationUsed)}</Badge>
      {!compact && <Badge variant="outline">{configSourceLabel(configSource)}</Badge>}
      <details className="text-muted-foreground">
        <summary className="cursor-pointer">Metadata técnica</summary>
        <div className="mt-2 min-w-64 rounded-md border border-border bg-card p-3">
          <p><strong className="text-foreground">modelVariantUsed:</strong> {modelVariantUsed}</p>
          <p><strong className="text-foreground">calibrationUsed:</strong> {calibrationUsed}</p>
          <p><strong className="text-foreground">configSource:</strong> {configSource}</p>
          <p><strong className="text-foreground">Label:</strong> {modelVariantLabel(modelVariantUsed)} + {calibrationLabel(calibrationUsed)}</p>
          <p><strong className="text-foreground">warnings:</strong> {safeWarnings.length}</p>
          {safeWarnings.map((warning) => <p key={warning} className="mt-1">• {warning}</p>)}
        </div>
      </details>
    </div>
  );
}
