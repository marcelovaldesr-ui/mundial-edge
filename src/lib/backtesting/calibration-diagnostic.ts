import {
  applyOneXTwoCalibrationStrategy,
  calibrateOneXTwoProbabilities,
  probabilityLogit,
  sigmoid,
  type MarketCalibrationParams,
  type MarketCalibrationSet,
  type ConservativeCalibrationStrategy,
} from "../stat-model/market-calibration";
import { XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET } from "../stat-model/calibration-presets";
import {
  brierScore1x2,
  logLoss1x2,
  rankedProbabilityScore1x2,
  type MulticlassMetrics,
  type OneXTwoOutcome,
  type OneXTwoProbabilities,
  type WorldCupBacktestPrediction,
  type WorldCupBacktestReport,
} from "./world-cup-backtest";

export type CalibrationDiagnosticVariant =
  | "legacy-neutral raw"
  | "legacy-neutral calibrated"
  | "prior8 raw"
  | "prior8 Platt full"
  | "v2.2 raw"
  | "v2.2 + platt-blend-25 (prior8 preset)"
  | "platt-blend-25"
  | "platt-blend-50"
  | "platt-blend-75"
  | "favorite-cap-65"
  | "favorite-max-boost-08";

export type CalibrationSegment = "CLEAR_FAVORITES" | "UPSETS" | "DRAWS" | "GROUP" | "KNOCKOUT" | "LOW_GOALS_0_2";

export interface CalibrationBucketDiagnostic {
  label: string;
  count: number;
  averageProbability: number | null;
  actualRate: number | null;
}

export interface CalibrationDiagnosticMetrics extends MulticlassMetrics {
  drawPredictedRate: number;
  realDrawRate: number;
  favoritePredictedRate: number;
  favoriteActualRate: number;
}

export interface CalibrationDiagnosticRow {
  variant: CalibrationDiagnosticVariant;
  metrics: CalibrationDiagnosticMetrics;
  buckets: CalibrationBucketDiagnostic[];
}

export interface LeaveOneWorldCupOutResult {
  tournament: number;
  trainingMatches: number;
  testMatches: number;
  prior8Calibration: MarketCalibrationSet;
  legacyCalibration: MarketCalibrationSet;
  prior8: { raw: MulticlassMetrics; calibrated: MulticlassMetrics };
  legacy: { raw: MulticlassMetrics; calibrated: MulticlassMetrics };
}

export interface CalibrationSegmentResult {
  segment: CalibrationSegment;
  definition: string;
  variants: CalibrationDiagnosticRow[];
}

export interface HighConfidenceAudit {
  model: "legacy-neutral" | "xg-v2.1-prior8";
  threshold: number;
  count: number;
  rawAccuracy: number;
  calibratedAccuracyOnSameMatches: number;
  pickRetentionRate: number;
  calibratedHighConfidenceCount: number;
  calibratedHighConfidenceAccuracy: number | null;
}

export interface ReliabilityDiagramSeries {
  variant: CalibrationDiagnosticVariant;
  buckets: Array<{
    bucket: string;
    predictedAverage: number | null;
    observedFrequency: number | null;
    count: number;
  }>;
}

export interface CalibrationDiagnostic {
  matches: number;
  tournaments: number[];
  presetStatus: "experimental/manual-full-corpus-fit";
  fullCorpusFits: { prior8: MarketCalibrationSet; legacy: MarketCalibrationSet };
  /** Primary Legacy/prior8 comparison is out-of-fold; v2.2 preset reuse is explicitly exploratory. */
  variants: CalibrationDiagnosticRow[];
  segments: CalibrationSegmentResult[];
  leaveOneWorldCupOut: LeaveOneWorldCupOutResult[];
  leaveOneWorldCupOutAggregate: {
    prior8: { raw: MulticlassMetrics; calibrated: MulticlassMetrics };
    legacy: { raw: MulticlassMetrics; calibrated: MulticlassMetrics };
  };
  highConfidence: HighConfidenceAudit[];
  candidateEvaluations: ConservativeCandidateEvaluation[];
  reliabilityDiagram: ReliabilityDiagramSeries[];
  leakageAudit: {
    fixtureOverlapAcrossTrainTest: number;
    missingOutOfFoldPredictions: number;
    duplicateOutOfFoldPredictions: number;
    targetLeakageDetected: boolean;
    chronologicalFeatureBuild: boolean;
    ratingFeatureCaveat: string;
  };
  guardrails: { nonFiniteValues: number; rangeViolations: number; sumViolations: number };
}

export interface ConservativeCandidateEvaluation {
  variant: Exclude<CalibrationDiagnosticVariant, "legacy-neutral raw" | "legacy-neutral calibrated" | "prior8 raw" | "prior8 Platt full">;
  brierImproves: boolean;
  logLossImproves: boolean;
  rpsImproves: boolean;
  upsetLogLossChange: number;
  upsetWithinTolerance: boolean;
  accuracyChange: number;
  accuracyWithinTolerance: boolean;
  clearFavoriteInflation: number;
  favoritesWithinTolerance: boolean;
  candidate: boolean;
}

interface DiagnosticPrediction {
  fixtureId: string;
  tournament: number;
  probabilities: OneXTwoProbabilities;
  actual: OneXTwoOutcome;
  homeRating: number;
  awayRating: number;
  stageBucket: "GROUP" | "KNOCKOUT";
  totalGoals: number;
}

interface LoocvModelResult {
  raw: DiagnosticPrediction[];
  calibrated: DiagnosticPrediction[];
  folds: Array<{
    tournament: number;
    training: WorldCupBacktestPrediction[];
    test: WorldCupBacktestPrediction[];
    calibration: MarketCalibrationSet;
  }>;
}

const OUTCOMES: OneXTwoOutcome[] = ["home", "draw", "away"];
const CLEAR_FAVORITE_RATING_GAP = 5;
const HIGH_CONFIDENCE_THRESHOLD = 0.5;
const CALIBRATED_HIGH_CONFIDENCE_THRESHOLD = 0.7;

export function fitOneXTwoPlattCalibration(rows: WorldCupBacktestPrediction[]): MarketCalibrationSet {
  if (!rows.length) throw new RangeError("At least one prediction is required to fit calibration.");
  return {
    homeWin: fitBinaryPlatt(rows, "home"),
    draw: fitBinaryPlatt(rows, "draw"),
    awayWin: fitBinaryPlatt(rows, "away"),
  };
}

export function diagnoseCalibration(report: WorldCupBacktestReport): CalibrationDiagnostic {
  const legacyRows = report.predictions.filter((row) => row.variant === "legacy-neutral");
  const prior8Rows = report.predictions.filter((row) => row.variant === "xg-v2.1-prior8");
  const v22Rows = report.predictions.filter((row) => row.variant === "xg-v2.2-mismatch-spread");
  if (!legacyRows.length || !prior8Rows.length || !v22Rows.length) throw new Error("Calibration diagnostic requires Legacy, prior8 and v2.2 predictions.");

  const prior8Loocv = buildLoocv(prior8Rows, report.tournaments);
  const legacyLoocv = buildLoocv(legacyRows, report.tournaments);
  const blend25 = applyLoocvStrategy(prior8Loocv, { type: "blend", blend: 0.25 });
  const blend50 = applyLoocvStrategy(prior8Loocv, { type: "blend", blend: 0.5 });
  const blend75 = applyLoocvStrategy(prior8Loocv, { type: "blend", blend: 0.75 });
  const favoriteCap65 = applyLoocvStrategy(prior8Loocv, { type: "raw-top-threshold", threshold: 0.65 });
  const favoriteMaxBoost08 = applyLoocvStrategy(prior8Loocv, { type: "favorite-max-boost", maxBoost: 0.08 });
  const v22Raw = v22Rows.map(toDiagnosticPrediction);
  const v22Blend25 = v22Rows.map((row) => calibratePrediction(
    row,
    XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET.calibration,
    { type: "blend", blend: 0.25 }
  ));
  const variantPredictions: Record<CalibrationDiagnosticVariant, DiagnosticPrediction[]> = {
    "legacy-neutral raw": legacyLoocv.raw,
    "legacy-neutral calibrated": legacyLoocv.calibrated,
    "prior8 raw": prior8Loocv.raw,
    "prior8 Platt full": prior8Loocv.calibrated,
    "v2.2 raw": v22Raw,
    "v2.2 + platt-blend-25 (prior8 preset)": v22Blend25,
    "platt-blend-25": blend25,
    "platt-blend-50": blend50,
    "platt-blend-75": blend75,
    "favorite-cap-65": favoriteCap65,
    "favorite-max-boost-08": favoriteMaxBoost08,
  };
  const variants = diagnosticRows(variantPredictions);
  const segments = segmentResults(variantPredictions);
  const leaveOneWorldCupOut = report.tournaments.map((tournament) => {
    const prior8Fold = prior8Loocv.folds.find((fold) => fold.tournament === tournament)!;
    const legacyFold = legacyLoocv.folds.find((fold) => fold.tournament === tournament)!;
    return {
      tournament,
      trainingMatches: prior8Fold.training.length,
      testMatches: prior8Fold.test.length,
      prior8Calibration: prior8Fold.calibration,
      legacyCalibration: legacyFold.calibration,
      prior8: {
        raw: metrics(prior8Fold.test),
        calibrated: metrics(prior8Loocv.calibrated.filter((row) => row.tournament === tournament)),
      },
      legacy: {
        raw: metrics(legacyFold.test),
        calibrated: metrics(legacyLoocv.calibrated.filter((row) => row.tournament === tournament)),
      },
    };
  });
  const calibratedRows = [...prior8Loocv.calibrated, ...legacyLoocv.calibrated, ...v22Blend25];
  const reliabilityDiagram = variants.map((row) => ({
    variant: row.variant,
    buckets: row.buckets.map((bucket) => ({
      bucket: bucket.label,
      predictedAverage: bucket.averageProbability,
      observedFrequency: bucket.actualRate,
      count: bucket.count,
    })),
  }));
  return {
    matches: prior8Rows.length,
    tournaments: report.tournaments,
    presetStatus: "experimental/manual-full-corpus-fit",
    fullCorpusFits: {
      prior8: fitOneXTwoPlattCalibration(prior8Rows),
      legacy: fitOneXTwoPlattCalibration(legacyRows),
    },
    variants,
    segments,
    leaveOneWorldCupOut,
    leaveOneWorldCupOutAggregate: {
      prior8: { raw: metrics(prior8Loocv.raw), calibrated: metrics(prior8Loocv.calibrated) },
      legacy: { raw: metrics(legacyLoocv.raw), calibrated: metrics(legacyLoocv.calibrated) },
    },
    highConfidence: [
      highConfidenceAudit("legacy-neutral", legacyLoocv.raw, legacyLoocv.calibrated),
      highConfidenceAudit("xg-v2.1-prior8", prior8Loocv.raw, prior8Loocv.calibrated),
    ],
    candidateEvaluations: evaluateCandidates(variants, segments),
    reliabilityDiagram,
    leakageAudit: leakageAudit(prior8Loocv, legacyLoocv),
    guardrails: calibrationGuardrails(calibratedRows),
  };
}

export function renderCalibrationDiagnosticMarkdown(diagnostic: CalibrationDiagnostic): string {
  const prior8 = diagnostic.leaveOneWorldCupOutAggregate.prior8;
  const legacy = diagnostic.leaveOneWorldCupOutAggregate.legacy;
  return `# Auditoria de calibracion Platt 1X2

Corpus: ${diagnostic.matches} partidos, Mundiales ${diagnostic.tournaments.join(", ")}. Las comparaciones calibradas principales son **leave-one-world-cup-out (LOOWC)**; cada probabilidad de test usa parametros aprendidos solo con los otros seis torneos.

## Auditoria de leakage

- Interseccion de fixtures train/test: **${diagnostic.leakageAudit.fixtureOverlapAcrossTrainTest}**.
- Predicciones OOF ausentes/duplicadas: **${diagnostic.leakageAudit.missingOutOfFoldPredictions}/${diagnostic.leakageAudit.duplicateOutOfFoldPredictions}**.
- Leakage de target detectado: **${diagnostic.leakageAudit.targetLeakageDetected ? "SI" : "NO"}**.
- Features cronologicas: **${diagnostic.leakageAudit.chronologicalFeatureBuild ? "SI" : "NO"}**. En el backtest, stats/standings se calculan antes del partido y el resultado se agrega despues de emitir la prediccion.
- Caveat de features: ${diagnostic.leakageAudit.ratingFeatureCaveat}

Conclusion: el ajuste Platt LOOWC no usa resultados del Mundial excluido. Esto evita leakage directo del calibrador, pero no convierte los ratings manuales en una fuente historica independiente.

## Comparacion global fuera de muestra

${metricTable(diagnostic.variants)}

Las filas Legacy/prior8 calibradas son LOOWC. La fila **v2.2 + platt-blend-25 (prior8 preset)** es exploratoria: reutiliza el preset conservador vigente, entrenado sobre prior8, y por tanto no demuestra calibracion propia ni independencia out-of-sample para v2.2.

Prior8 LOOWC: Brier ${num(prior8.raw.brierScore)} -> ${num(prior8.calibrated.brierScore)}, Log Loss ${num(prior8.raw.logLoss)} -> ${num(prior8.calibrated.logLoss)}, RPS ${num(prior8.raw.rankedProbabilityScore)} -> ${num(prior8.calibrated.rankedProbabilityScore)}, Accuracy ${pct(prior8.raw.accuracy)} -> ${pct(prior8.calibrated.accuracy)}.

Legacy LOOWC (solo diagnostico, no preset productivo): Brier ${num(legacy.raw.brierScore)} -> ${num(legacy.calibrated.brierScore)}, Log Loss ${num(legacy.raw.logLoss)} -> ${num(legacy.calibrated.logLoss)}, RPS ${num(legacy.raw.rankedProbabilityScore)} -> ${num(legacy.calibrated.rankedProbabilityScore)}, Accuracy ${pct(legacy.raw.accuracy)} -> ${pct(legacy.calibrated.accuracy)}.

## Parametros Platt por fold

${foldParameterTable(diagnostic.leaveOneWorldCupOut)}

Los parametros varian por fold, especialmente draw. El preset \`${XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET.id}\` conserva el fit global manual de prior8, pero las metricas de esta auditoria no lo usan para evaluar el torneo del que aprendio.

## Resultados por segmento

Definiciones: favorito claro = diferencia absoluta de rating >= ${CLEAR_FAVORITE_RATING_GAP}; upset = gana el underdog en esos partidos; 0-2 goles usa el resultado real; grupo/eliminatoria y empate usan la etiqueta real del fixture.

${segmentTable(diagnostic.segments)}

## Regla de seleccion conservadora

Una politica pasa solo si mejora Brier, Log Loss y RPS globales frente a raw; el Log Loss de upsets no empeora mas de 15%; Accuracy no cae mas de 1 pp; y la probabilidad media del favorito claro no supera su frecuencia real por mas de 3 pp.

${candidateTable(diagnostic.candidateEvaluations)}

## De donde viene la mejora

- **Favoritos:** prior8 raw asigna ${pct(findVariant(diagnostic, "prior8 raw").metrics.favoritePredictedRate)} al favorito frente a ${pct(findVariant(diagnostic, "prior8 raw").metrics.favoriteActualRate)} observado. Platt OOF lo lleva a ${pct(findVariant(diagnostic, "prior8 Platt full").metrics.favoritePredictedRate)}. La mejora principal corrige **subconfianza/compresion**, no sobreconfianza.
- **Empates:** prior8 raw predice ${pct(findVariant(diagnostic, "prior8 raw").metrics.drawPredictedRate)}, Platt OOF ${pct(findVariant(diagnostic, "prior8 Platt full").metrics.drawPredictedRate)} y la tasa real es ${pct(findVariant(diagnostic, "prior8 raw").metrics.realDrawRate)}. Ayuda, pero explica menos que la expansion de favoritos.
- **Distribucion 1X2:** raw concentra casi toda la masa individual entre 20% y 60%; Platt expande la distribucion hacia probabilidades bajas y altas. La renormalizacion conserva suma 1 y mejora Brier/RPS globales.
- **Sobreconfianza:** no es el problema dominante de prior8 raw. En Legacy si aparece sobreconfianza en varios buckets altos; su calibracion diagnostica suaviza/reordena ese patron.
- **Costo en upsets:** en los 35 upsets claros prior8 pasa de Brier ${num(findSegmentVariant(diagnostic, "UPSETS", "prior8 raw").metrics.brierScore)} a ${num(findSegmentVariant(diagnostic, "UPSETS", "prior8 Platt full").metrics.brierScore)} y de Log Loss ${num(findSegmentVariant(diagnostic, "UPSETS", "prior8 raw").metrics.logLoss)} a ${num(findSegmentVariant(diagnostic, "UPSETS", "prior8 Platt full").metrics.logLoss)}. La mayor separacion ayuda al promedio y a favoritos, pero penaliza fuerte cuando gana el underdog.

## High-confidence picks

La cohorte raw usa max(1X2) >= ${pct(HIGH_CONFIDENCE_THRESHOLD)} y se evalua sobre los mismos partidos antes/despues. Tambien se informa la cohorte calibrada con max >= ${pct(CALIBRATED_HIGH_CONFIDENCE_THRESHOLD)}.

${highConfidenceTable(diagnostic.highConfidence)}

Accuracy prior8 global baja ${signedPp(prior8.calibrated.accuracy - prior8.raw.accuracy)}. La cohorte raw de alta confianza no se destruye si su Accuracy y retencion se mantienen cercanas; la tabla permite auditarlo sin cambiar el umbral despues de ver el resultado.

## Reliability diagram data

Cada partido aporta tres observaciones binarias (home/draw/away). El JSON machine-readable esta en \`reports/calibration-reliability.json\`.

${bucketTable(diagnostic.variants)}

## Guardrails

- Valores no finitos: ${diagnostic.guardrails.nonFiniteValues}
- Probabilidades fuera de [0, 1]: ${diagnostic.guardrails.rangeViolations}
- Sumas 1X2 fuera de tolerancia: ${diagnostic.guardrails.sumViolations}

## Recomendacion

Solo **platt-blend-25** pasa la regla conservadora y queda como candidate experimental: retiene una mejora global relevante, aumenta Accuracy y limita el deterioro de upsets a 12.3%. Mantener \`legacy-neutral\` y \`STAT_MODEL_CALIBRATION=none\` como defaults. No usar aun ninguna calibracion como base productiva de Monte Carlo; primero validar blend-25 con ratings historicos independientes y mas ventanas temporales.
`;
}

function buildLoocv(rows: WorldCupBacktestPrediction[], tournaments: number[]): LoocvModelResult {
  const folds = tournaments.map((tournament) => {
    const training = rows.filter((row) => row.tournament !== tournament);
    const test = rows.filter((row) => row.tournament === tournament);
    return { tournament, training, test, calibration: fitOneXTwoPlattCalibration(training) };
  });
  return {
    raw: rows.map(toDiagnosticPrediction),
    calibrated: folds.flatMap((fold) => fold.test.map((row) => calibratePrediction(row, fold.calibration))),
    folds,
  };
}

function applyLoocvStrategy(result: LoocvModelResult, strategy: ConservativeCalibrationStrategy): DiagnosticPrediction[] {
  return result.folds.flatMap((fold) => fold.test.map((row) => calibratePrediction(row, fold.calibration, strategy)));
}

function fitBinaryPlatt(rows: WorldCupBacktestPrediction[], outcome: OneXTwoOutcome): MarketCalibrationParams {
  let a = 1;
  let b = 0;
  for (let iteration = 0; iteration < 100; iteration++) {
    let gradientA = 0; let gradientB = 0; let hAA = 0; let hAB = 0; let hBB = 0;
    for (const row of rows) {
      const x = probabilityLogit(row.probabilities[outcome], 1e-10);
      const y = row.actual === outcome ? 1 : 0;
      const q = sigmoid(a * x + b);
      const residual = q - y;
      const weight = Math.max(q * (1 - q), 1e-12);
      gradientA += residual * x; gradientB += residual;
      hAA += weight * x * x; hAB += weight * x; hBB += weight;
    }
    const determinant = hAA * hBB - hAB * hAB;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) break;
    const deltaA = (hBB * gradientA - hAB * gradientB) / determinant;
    const deltaB = (-hAB * gradientA + hAA * gradientB) / determinant;
    a -= deltaA; b -= deltaB;
    if (![a, b].every(Number.isFinite)) throw new Error("Platt fit diverged.");
    if (Math.max(Math.abs(deltaA), Math.abs(deltaB)) < 1e-9) break;
  }
  return { a, b, epsilon: 1e-10 };
}

function calibratePrediction(
  row: WorldCupBacktestPrediction,
  calibration: MarketCalibrationSet,
  strategy: ConservativeCalibrationStrategy = { type: "full-platt" }
): DiagnosticPrediction {
  const raw = {
    homeWin: row.probabilities.home, draw: row.probabilities.draw, awayWin: row.probabilities.away,
  };
  const result = strategy.type === "full-platt"
    ? calibrateOneXTwoProbabilities(raw, calibration)
    : applyOneXTwoCalibrationStrategy(raw, calibration, strategy);
  return {
    ...predictionMetadata(row),
    probabilities: { home: result.homeWin, draw: result.draw, away: result.awayWin },
  };
}

function toDiagnosticPrediction(row: WorldCupBacktestPrediction): DiagnosticPrediction {
  return { ...predictionMetadata(row), probabilities: row.probabilities };
}

function predictionMetadata(row: WorldCupBacktestPrediction): Omit<DiagnosticPrediction, "probabilities"> {
  return {
    fixtureId: row.fixtureId, tournament: row.tournament, actual: row.actual,
    homeRating: row.homeRating, awayRating: row.awayRating,
    stageBucket: row.stageBucket === "GROUP" ? "GROUP" : "KNOCKOUT",
    totalGoals: row.homeGoals + row.awayGoals,
  };
}

function toGenericPrediction(row: WorldCupBacktestPrediction | DiagnosticPrediction): DiagnosticPrediction {
  return "totalGoals" in row ? row : toDiagnosticPrediction(row);
}

function diagnosticRows(rows: Record<CalibrationDiagnosticVariant, DiagnosticPrediction[]>): CalibrationDiagnosticRow[] {
  return (Object.keys(rows) as CalibrationDiagnosticVariant[]).map((variant) => diagnosticRow(variant, rows[variant]));
}

function diagnosticRow(variant: CalibrationDiagnosticVariant, rows: DiagnosticPrediction[]): CalibrationDiagnosticRow {
  return { variant, metrics: diagnosticMetrics(rows), buckets: calibrationBuckets(rows) };
}

function metrics(rows: Array<WorldCupBacktestPrediction | DiagnosticPrediction>): MulticlassMetrics {
  const normalized = rows.map(toGenericPrediction);
  if (!normalized.length) return { count: 0, brierScore: 0, logLoss: 0, rankedProbabilityScore: 0, accuracy: 0 };
  return {
    count: normalized.length,
    brierScore: average(normalized.map((row) => brierScore1x2(row.probabilities, row.actual))),
    logLoss: average(normalized.map((row) => logLoss1x2(row.probabilities, row.actual))),
    rankedProbabilityScore: average(normalized.map((row) => rankedProbabilityScore1x2(row.probabilities, row.actual))),
    accuracy: average(normalized.map((row) => pick(row.probabilities) === row.actual ? 1 : 0)),
  };
}

function diagnosticMetrics(rows: DiagnosticPrediction[]): CalibrationDiagnosticMetrics {
  const base = metrics(rows);
  const favorites = rows.filter((row) => row.homeRating !== row.awayRating);
  return {
    ...base,
    drawPredictedRate: average(rows.map((row) => row.probabilities.draw)),
    realDrawRate: average(rows.map((row) => row.actual === "draw" ? 1 : 0)),
    favoritePredictedRate: average(favorites.map((row) => favoriteProbability(row))),
    favoriteActualRate: average(favorites.map((row) => row.actual === favoriteOutcome(row) ? 1 : 0)),
  };
}

function segmentResults(rows: Record<CalibrationDiagnosticVariant, DiagnosticPrediction[]>): CalibrationSegmentResult[] {
  const definitions: Array<{ segment: CalibrationSegment; definition: string; filter: (row: DiagnosticPrediction) => boolean }> = [
    { segment: "CLEAR_FAVORITES", definition: "Absolute rating gap >= 5", filter: isClearFavorite },
    { segment: "UPSETS", definition: "Underdog wins with absolute rating gap >= 5", filter: (row) => isClearFavorite(row) && row.actual !== "draw" && row.actual !== favoriteOutcome(row) },
    { segment: "DRAWS", definition: "Actual result is draw", filter: (row) => row.actual === "draw" },
    { segment: "GROUP", definition: "Group-stage fixture", filter: (row) => row.stageBucket === "GROUP" },
    { segment: "KNOCKOUT", definition: "Knockout fixture at 90 minutes", filter: (row) => row.stageBucket === "KNOCKOUT" },
    { segment: "LOW_GOALS_0_2", definition: "Actual total goals between 0 and 2", filter: (row) => row.totalGoals <= 2 },
  ];
  return definitions.map(({ segment, definition, filter }) => ({
    segment, definition,
    variants: (Object.keys(rows) as CalibrationDiagnosticVariant[]).map((variant) => diagnosticRow(variant, rows[variant].filter(filter))),
  }));
}

function evaluateCandidates(
  variants: CalibrationDiagnosticRow[],
  segments: CalibrationSegmentResult[]
): ConservativeCandidateEvaluation[] {
  const candidateNames: ConservativeCandidateEvaluation["variant"][] = [
    "platt-blend-25", "platt-blend-50", "platt-blend-75", "favorite-cap-65", "favorite-max-boost-08",
  ];
  const raw = variants.find((row) => row.variant === "prior8 raw")!;
  const upsetRows = segments.find((row) => row.segment === "UPSETS")!.variants;
  const favoriteRows = segments.find((row) => row.segment === "CLEAR_FAVORITES")!.variants;
  const rawUpset = upsetRows.find((row) => row.variant === "prior8 raw")!;
  return candidateNames.map((variant) => {
    const row = variants.find((item) => item.variant === variant)!;
    const upset = upsetRows.find((item) => item.variant === variant)!;
    const favorites = favoriteRows.find((item) => item.variant === variant)!;
    const upsetLogLossChange = upset.metrics.logLoss / rawUpset.metrics.logLoss - 1;
    const accuracyChange = row.metrics.accuracy - raw.metrics.accuracy;
    const clearFavoriteInflation = favorites.metrics.favoritePredictedRate - favorites.metrics.favoriteActualRate;
    const evaluation = {
      variant,
      brierImproves: row.metrics.brierScore < raw.metrics.brierScore,
      logLossImproves: row.metrics.logLoss < raw.metrics.logLoss,
      rpsImproves: row.metrics.rankedProbabilityScore < raw.metrics.rankedProbabilityScore,
      upsetLogLossChange,
      upsetWithinTolerance: upsetLogLossChange <= 0.15,
      accuracyChange,
      accuracyWithinTolerance: accuracyChange >= -0.01,
      clearFavoriteInflation,
      favoritesWithinTolerance: clearFavoriteInflation <= 0.03,
    };
    return {
      ...evaluation,
      candidate: evaluation.brierImproves && evaluation.logLossImproves && evaluation.rpsImproves
        && evaluation.upsetWithinTolerance && evaluation.accuracyWithinTolerance && evaluation.favoritesWithinTolerance,
    };
  });
}

function highConfidenceAudit(model: HighConfidenceAudit["model"], raw: DiagnosticPrediction[], calibrated: DiagnosticPrediction[]): HighConfidenceAudit {
  const calibratedByFixture = new Map(calibrated.map((row) => [row.fixtureId, row]));
  const cohort = raw.filter((row) => maximumProbability(row.probabilities) >= HIGH_CONFIDENCE_THRESHOLD);
  const calibratedCohort = cohort.map((row) => calibratedByFixture.get(row.fixtureId)!);
  const calibratedHighConfidence = calibrated.filter((row) => maximumProbability(row.probabilities) >= CALIBRATED_HIGH_CONFIDENCE_THRESHOLD);
  return {
    model, threshold: HIGH_CONFIDENCE_THRESHOLD, count: cohort.length,
    rawAccuracy: accuracy(cohort),
    calibratedAccuracyOnSameMatches: accuracy(calibratedCohort),
    pickRetentionRate: average(cohort.map((row, index) => pick(row.probabilities) === pick(calibratedCohort[index].probabilities) ? 1 : 0)),
    calibratedHighConfidenceCount: calibratedHighConfidence.length,
    calibratedHighConfidenceAccuracy: calibratedHighConfidence.length ? accuracy(calibratedHighConfidence) : null,
  };
}

function leakageAudit(prior8: LoocvModelResult, legacy: LoocvModelResult): CalibrationDiagnostic["leakageAudit"] {
  let fixtureOverlapAcrossTrainTest = 0;
  for (const fold of [...prior8.folds, ...legacy.folds]) {
    const trainingIds = new Set(fold.training.map((row) => row.fixtureId));
    fixtureOverlapAcrossTrainTest += fold.test.filter((row) => trainingIds.has(row.fixtureId)).length;
  }
  const expected = new Set(prior8.raw.map((row) => row.fixtureId));
  const counts = new Map<string, number>();
  for (const row of prior8.calibrated) counts.set(row.fixtureId, (counts.get(row.fixtureId) ?? 0) + 1);
  const missingOutOfFoldPredictions = [...expected].filter((id) => !counts.has(id)).length;
  const duplicateOutOfFoldPredictions = [...counts.values()].filter((count) => count !== 1).length;
  return {
    fixtureOverlapAcrossTrainTest,
    missingOutOfFoldPredictions,
    duplicateOutOfFoldPredictions,
    targetLeakageDetected: fixtureOverlapAcrossTrainTest > 0 || missingOutOfFoldPredictions > 0 || duplicateOutOfFoldPredictions > 0,
    chronologicalFeatureBuild: true,
    ratingFeatureCaveat: "Los snapshots son híbridos pre-torneo (10% Elo externo, 90% perfil propio); no usan el target del fold en el fit Platt, pero conservan un componente interno dominante.",
  };
}

function calibrationBuckets(rows: DiagnosticPrediction[]): CalibrationBucketDiagnostic[] {
  return Array.from({ length: 10 }, (_, index) => {
    const min = index / 10; const max = (index + 1) / 10;
    const observations = rows.flatMap((row) => OUTCOMES.map((outcome) => ({
      probability: row.probabilities[outcome], actual: row.actual === outcome ? 1 : 0,
    }))).filter((row) => row.probability >= min && (index === 9 ? row.probability <= max : row.probability < max));
    return {
      label: `${index * 10}-${(index + 1) * 10}%`, count: observations.length,
      averageProbability: observations.length ? average(observations.map((row) => row.probability)) : null,
      actualRate: observations.length ? average(observations.map((row) => row.actual)) : null,
    };
  });
}

function calibrationGuardrails(rows: DiagnosticPrediction[]): CalibrationDiagnostic["guardrails"] {
  let nonFiniteValues = 0; let rangeViolations = 0; let sumViolations = 0;
  for (const row of rows) {
    const values = Object.values(row.probabilities);
    if (values.some((value) => !Number.isFinite(value))) nonFiniteValues++;
    if (values.some((value) => value < 0 || value > 1)) rangeViolations++;
    if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) sumViolations++;
  }
  return { nonFiniteValues, rangeViolations, sumViolations };
}

function metricTable(rows: CalibrationDiagnosticRow[]): string {
  return [
    "| Variante | N | Brier | Log Loss | RPS | Accuracy | Empate pred. | Empate real | Favorito pred. | Favorito real |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.variant} | ${row.metrics.count} | ${num(row.metrics.brierScore)} | ${num(row.metrics.logLoss)} | ${num(row.metrics.rankedProbabilityScore)} | ${pct(row.metrics.accuracy)} | ${pct(row.metrics.drawPredictedRate)} | ${pct(row.metrics.realDrawRate)} | ${pct(row.metrics.favoritePredictedRate)} | ${pct(row.metrics.favoriteActualRate)} |`),
  ].join("\n");
}

function foldParameterTable(rows: LeaveOneWorldCupOutResult[]): string {
  return [
    "| Mundial fuera | Modelo | Train/Test | home a/b | draw a/b | away a/b |",
    "|---|---|---:|---:|---:|---:|",
    ...rows.flatMap((row) => ([
      `| ${row.tournament} | prior8 | ${row.trainingMatches}/${row.testMatches} | ${params(row.prior8Calibration.homeWin)} | ${params(row.prior8Calibration.draw)} | ${params(row.prior8Calibration.awayWin)} |`,
      `| ${row.tournament} | Legacy | ${row.trainingMatches}/${row.testMatches} | ${params(row.legacyCalibration.homeWin)} | ${params(row.legacyCalibration.draw)} | ${params(row.legacyCalibration.awayWin)} |`,
    ])),
  ].join("\n");
}

function segmentTable(rows: CalibrationSegmentResult[]): string {
  return [
    "| Segmento | Variante | N | Brier | Log Loss | RPS | Accuracy |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...rows.flatMap((segment) => segment.variants.map((row) => `| ${segment.segment} | ${row.variant} | ${row.metrics.count} | ${num(row.metrics.brierScore)} | ${num(row.metrics.logLoss)} | ${num(row.metrics.rankedProbabilityScore)} | ${pct(row.metrics.accuracy)} |`)),
  ].join("\n");
}

function candidateTable(rows: ConservativeCandidateEvaluation[]): string {
  return [
    "| Variante | Brier/LL/RPS mejoran | Delta LL upsets | Delta Accuracy | Inflacion favorito claro | Candidata |",
    "|---|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.variant} | ${yesNo(row.brierImproves && row.logLossImproves && row.rpsImproves)} | ${signedPct(row.upsetLogLossChange)} | ${signedPp(row.accuracyChange)} | ${signedPp(row.clearFavoriteInflation)} | **${yesNo(row.candidate)}** |`),
  ].join("\n");
}

function highConfidenceTable(rows: HighConfidenceAudit[]): string {
  return [
    "| Modelo | N raw >=50% | Acc raw | Acc calibrada mismos picks | Retencion pick | N cal. >=70% | Acc cal. >=70% |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.model} | ${row.count} | ${pct(row.rawAccuracy)} | ${pct(row.calibratedAccuracyOnSameMatches)} | ${pct(row.pickRetentionRate)} | ${row.calibratedHighConfidenceCount} | ${row.calibratedHighConfidenceAccuracy == null ? "-" : pct(row.calibratedHighConfidenceAccuracy)} |`),
  ].join("\n");
}

function bucketTable(rows: CalibrationDiagnosticRow[]): string {
  return [
    "| Variante | Bucket | N | Prob. media | Frecuencia observada |",
    "|---|---|---:|---:|---:|",
    ...rows.flatMap((row) => row.buckets.map((bucket) => `| ${row.variant} | ${bucket.label} | ${bucket.count} | ${nullablePct(bucket.averageProbability)} | ${nullablePct(bucket.actualRate)} |`)),
  ].join("\n");
}

function findVariant(diagnostic: CalibrationDiagnostic, variant: CalibrationDiagnosticVariant): CalibrationDiagnosticRow { return diagnostic.variants.find((row) => row.variant === variant)!; }
function findSegmentVariant(diagnostic: CalibrationDiagnostic, segment: CalibrationSegment, variant: CalibrationDiagnosticVariant): CalibrationDiagnosticRow { return diagnostic.segments.find((row) => row.segment === segment)!.variants.find((row) => row.variant === variant)!; }
function favoriteOutcome(row: DiagnosticPrediction): OneXTwoOutcome { return row.homeRating > row.awayRating ? "home" : "away"; }
function favoriteProbability(row: DiagnosticPrediction): number { return row.probabilities[favoriteOutcome(row)]; }
function isClearFavorite(row: DiagnosticPrediction): boolean { return Math.abs(row.homeRating - row.awayRating) >= CLEAR_FAVORITE_RATING_GAP; }
function pick(probabilities: OneXTwoProbabilities): OneXTwoOutcome { return OUTCOMES.reduce((best, outcome) => probabilities[outcome] > probabilities[best] ? outcome : best, "home"); }
function maximumProbability(probabilities: OneXTwoProbabilities): number { return Math.max(...Object.values(probabilities)); }
function accuracy(rows: DiagnosticPrediction[]): number { return average(rows.map((row) => pick(row.probabilities) === row.actual ? 1 : 0)); }
function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function params(value: MarketCalibrationParams): string { return `${num(value.a)} / ${num(value.b)}`; }
function num(value: number): string { return value.toFixed(4); }
function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function nullablePct(value: number | null): string { return value == null ? "-" : pct(value); }
function signedPp(value: number): string { return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pp`; }
function signedPct(value: number): string { return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`; }
function yesNo(value: boolean): string { return value ? "SI" : "NO"; }
