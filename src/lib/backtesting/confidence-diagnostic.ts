import { brierScore1x2, type BacktestVariant, type WorldCupBacktestPrediction, type WorldCupBacktestReport } from "./world-cup-backtest";
import type { PredictionConfidenceLabel } from "../stat-model/confidence-score";

const CONFIDENCE_VARIANTS: BacktestVariant[] = ["legacy-neutral", "xg-v2.1-prior8"];
const LABELS: PredictionConfidenceLabel[] = ["low", "medium", "high"];

export interface ConfidenceDiagnosticRow {
  variant: BacktestVariant;
  label: PredictionConfidenceLabel;
  count: number;
  coverage: number;
  avgScore: number;
  accuracy: number;
  brierScore: number;
  avgTopProbability: number;
  avgTopMargin: number;
}

export interface ConfidenceDiagnostic {
  rows: ConfidenceDiagnosticRow[];
  monotonicAccuracy: Array<{ variant: BacktestVariant; passes: boolean; note: string }>;
}

export function diagnosePredictionConfidence(report: WorldCupBacktestReport): ConfidenceDiagnostic {
  const rows = CONFIDENCE_VARIANTS.flatMap((variant) => {
    const all = report.predictions.filter((prediction) => prediction.variant === variant);
    return LABELS.map((label) => confidenceRow(variant, label, all));
  });
  const monotonicAccuracy = CONFIDENCE_VARIANTS.map((variant) => {
    const populated = rows.filter((row) => row.variant === variant && row.count > 0);
    const passes = populated.every((row, index) => index === 0 || row.accuracy >= populated[index - 1].accuracy);
    return {
      variant,
      passes,
      note: passes
        ? "Accuracy no decrece al subir de bucket entre buckets con datos."
        : "La relacion no es monotona en este corpus limitado; usar el score como señal, no como garantia.",
    };
  });
  return { rows, monotonicAccuracy };
}

export function renderConfidenceDiagnosticMarkdown(diagnostic: ConfidenceDiagnostic): string {
  return `# Diagnostico de Prediction Confidence

## Objetivo

Evaluar si el Confidence Score separa razonablemente picks inciertos y picks concentrados. No se exige monotonicidad perfecta: el corpus contiene 128 partidos y los buckets pequeños tienen alta varianza.

## Coverage y desempeño por bucket

${confidenceTable(diagnostic.rows)}

## Chequeo de monotonicidad

${diagnostic.monotonicAccuracy.map((row) => `- **${row.variant}: ${row.passes ? "cumple" : "no cumple"}.** ${row.note}`).join("\n")}

## Interpretacion

- Un bucket low razonable debe mostrar menor probabilidad top y menor margen top-vs-segundo que medium/high.
- Accuracy y Brier son validaciones posteriores, no componentes calculados con el resultado real.
- El score no representa una probabilidad de acierto ni reemplaza la calibracion del modelo.
- Fallbacks, muestras pequeñas, dependencia alta del prior, warnings y contexto fuerte de grupos reducen confianza aunque el pick tenga probabilidad concentrada.
`;
}

function confidenceRow(
  variant: BacktestVariant,
  label: PredictionConfidenceLabel,
  all: WorldCupBacktestPrediction[]
): ConfidenceDiagnosticRow {
  const selected = all.filter((row) => row.confidenceLabel === label);
  return {
    variant,
    label,
    count: selected.length,
    coverage: all.length ? selected.length / all.length : 0,
    avgScore: average(selected.map((row) => row.confidenceScore)),
    accuracy: average(selected.map((row) => row.picked === row.actual ? 1 : 0)),
    brierScore: average(selected.map((row) => brierScore1x2(row.probabilities, row.actual))),
    avgTopProbability: average(selected.map((row) => sortedProbabilities(row)[0])),
    avgTopMargin: average(selected.map((row) => sortedProbabilities(row)[0] - sortedProbabilities(row)[1])),
  };
}

function sortedProbabilities(row: WorldCupBacktestPrediction): number[] {
  return Object.values(row.probabilities).sort((a, b) => b - a);
}

function confidenceTable(rows: ConfidenceDiagnosticRow[]): string {
  return [
    "| Variante | Bucket | N | Coverage | Score medio | Accuracy | Brier | Prob top media | Margen top-2 |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.variant} | ${row.label} | ${row.count} | ${pct(row.coverage)} | ${row.avgScore.toFixed(1)} | ${pct(row.accuracy)} | ${row.brierScore.toFixed(4)} | ${pct(row.avgTopProbability)} | ${pct(row.avgTopMargin)} |`),
  ].join("\n");
}

function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }
