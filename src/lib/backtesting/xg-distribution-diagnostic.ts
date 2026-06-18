import type { ExpectedGoalsDiagnosticBreakdown } from "../stat-model/expected-goals";
import { getActiveStatModelCalibration } from "../stat-model/calibration-presets";
import type { StatModelCalibrationMode } from "../stat-model/calibration-presets";
import { applyOneXTwoCalibrationStrategy } from "../stat-model/market-calibration";
import type { MatchStatModelPrediction } from "../stat-model/match-prediction";
import { createScoreMatrix, getTopScorelines, type ScoreMatrix } from "../stat-model/score-matrix";
import type { TeamStrengthRating } from "../stat-model/team-strength-ratings";
import type { WorldCupBacktestPrediction } from "./world-cup-backtest";

export type RatingDiffBucket = "0-5" | "5-10" | "10-15" | "15-20" | "20+";
export type XgDiagnosticSource = "2026-available" | "historical-backtest";

export interface DiagnosticScoreline {
  score: string;
  probability: number;
}

export interface XgDistributionMatchRow {
  id: string;
  source: XgDiagnosticSource;
  tournament: number;
  homeTeam: string;
  awayTeam: string;
  ratingDiff: number;
  attackDiff: number;
  defenseDiff: number;
  homeRatingSource: TeamStrengthRating["source"];
  awayRatingSource: TeamStrengthRating["source"];
  homeXg: number;
  awayXg: number;
  xgDiff: number;
  totalXg: number;
  favoriteTeam: string;
  underdogTeam: string;
  favoriteXg: number;
  underdogXg: number;
  favoriteProbability: number;
  underdogProbability: number;
  drawProbability: number;
  topScorelines: DiagnosticScoreline[];
  breakdown: ExpectedGoalsDiagnosticBreakdown;
  calibrationMode: string;
  modelVariant: string;
  scoreMatrixLambdaSource: "raw-final-xg";
  warnings: Array<"compressionWarning" | "underdogInflationWarning" | "modalScoreWarning">;
}

export interface XgDistributionSummary {
  matches: number;
  meanHomeXg: number;
  meanAwayXg: number;
  meanTotalXg: number;
  meanAbsXgDiff: number;
  pctAbsXgDiffLt025: number;
  pctAbsXgDiffLt050: number;
  pctTopScore11: number;
  pctFavoriteXgLt17: number;
  pctUnderdogXgGt10: number;
}

export interface XgDistributionBucketRow {
  bucket: RatingDiffBucket;
  matches: number;
  meanFavoriteXg: number;
  meanUnderdogXg: number;
  meanFavoriteXgDiff: number;
  meanFavoriteWinProbability: number;
  meanUpsetProbability: number;
  pctTopScore11: number;
}

export interface XgDistributionDiagnostic {
  rows: XgDistributionMatchRow[];
  summaries: Array<{ source: "all" | XgDiagnosticSource; summary: XgDistributionSummary }>;
  buckets: Array<{ source: "all" | XgDiagnosticSource; rows: XgDistributionBucketRow[] }>;
  warningCounts: Record<XgDistributionMatchRow["warnings"][number], number>;
  scoreMatrixAudit: {
    calibratedOneXTwo: true;
    scoreMatrixUsesCalibratedLambdas: false;
    scoreMatrixLambdaSource: "estimateExpectedGoals.final-xg";
    visualInconsistencyPossible: true;
  };
}

const BUCKETS: RatingDiffBucket[] = ["0-5", "5-10", "10-15", "15-20", "20+"];

export function currentPredictionDiagnosticRow(prediction: MatchStatModelPrediction): XgDistributionMatchRow {
  const home = ratingValues(prediction.homeRating);
  const away = ratingValues(prediction.awayRating);
  const homeWin = marketProbability(prediction, "home_win");
  const awayWin = marketProbability(prediction, "away_win");
  return buildRow({
    id: prediction.matchId,
    source: "2026-available",
    tournament: 2026,
    homeTeam: prediction.homeTeam.name,
    awayTeam: prediction.awayTeam.name,
    homeRating: home.overall,
    awayRating: away.overall,
    homeAttack: home.attack,
    awayAttack: away.attack,
    homeDefense: home.defense,
    awayDefense: away.defense,
    homeXg: prediction.homeExpectedGoals,
    awayXg: prediction.awayExpectedGoals,
    homeWin,
    draw: marketProbability(prediction, "draw"),
    awayWin,
    matrix: prediction.scoreMatrix,
    breakdown: prediction.expectedGoalsDiagnostic,
    calibrationMode: prediction.calibrationMode,
    modelVariant: prediction.modelVariant,
    homeRatingSource: home.source,
    awayRatingSource: away.source,
  });
}

export function historicalPredictionDiagnosticRow(
  row: WorldCupBacktestPrediction,
  calibrationMode: StatModelCalibrationMode = "platt-blend-25"
): XgDistributionMatchRow {
  const raw = row.probabilities;
  const calibration = getActiveStatModelCalibration(calibrationMode, undefined);
  const calibrated = calibration.id === "none"
    ? { homeWin: raw.home, draw: raw.draw, awayWin: raw.away }
    : applyOneXTwoCalibrationStrategy(
      { homeWin: raw.home, draw: raw.draw, awayWin: raw.away },
      calibration.calibration,
      calibration.strategy
    );
  return buildRow({
    id: row.fixtureId,
    source: "historical-backtest",
    tournament: row.tournament,
    homeTeam: row.homeTeam.name,
    awayTeam: row.awayTeam.name,
    homeRating: row.homeRating,
    awayRating: row.awayRating,
    homeAttack: row.homeAttackRating,
    awayAttack: row.awayAttackRating,
    homeDefense: row.homeDefenseRating,
    awayDefense: row.awayDefenseRating,
    homeXg: row.homeExpectedGoals,
    awayXg: row.awayExpectedGoals,
    homeWin: calibrated.homeWin,
    draw: calibrated.draw,
    awayWin: calibrated.awayWin,
    matrix: createScoreMatrix({ homeExpectedGoals: row.homeExpectedGoals, awayExpectedGoals: row.awayExpectedGoals, maxGoals: 12 }),
    breakdown: requireBreakdown(row),
    calibrationMode: calibration.id,
    modelVariant: row.variant,
    homeRatingSource: row.homeRatingSource,
    awayRatingSource: row.awayRatingSource,
  });
}

export function diagnoseXgDistribution(rows: XgDistributionMatchRow[]): XgDistributionDiagnostic {
  const sorted = [...rows].sort((a, b) => a.tournament - b.tournament || a.id.localeCompare(b.id));
  const sources: Array<"all" | XgDiagnosticSource> = ["all", "2026-available", "historical-backtest"];
  const forSource = (source: "all" | XgDiagnosticSource) => source === "all" ? sorted : sorted.filter((row) => row.source === source);
  return {
    rows: sorted,
    summaries: sources.map((source) => ({ source, summary: summarize(forSource(source)) })),
    buckets: sources.map((source) => ({ source, rows: bucketRows(forSource(source)) })),
    warningCounts: {
      compressionWarning: sorted.filter((row) => row.warnings.includes("compressionWarning")).length,
      underdogInflationWarning: sorted.filter((row) => row.warnings.includes("underdogInflationWarning")).length,
      modalScoreWarning: sorted.filter((row) => row.warnings.includes("modalScoreWarning")).length,
    },
    scoreMatrixAudit: {
      calibratedOneXTwo: true,
      scoreMatrixUsesCalibratedLambdas: false,
      scoreMatrixLambdaSource: "estimateExpectedGoals.final-xg",
      visualInconsistencyPossible: true,
    },
  };
}

export function renderXgDistributionDiagnosticMarkdown(diagnostic: XgDistributionDiagnostic): string {
  const current = diagnostic.summaries.find((item) => item.source === "2026-available")!.summary;
  const historical = diagnostic.summaries.find((item) => item.source === "historical-backtest")!.summary;
  const currentRows = diagnostic.rows.filter((row) => row.source === "2026-available");
  const currentFallbacks = currentRows.filter((row) => row.homeRatingSource === "neutral_fallback" || row.awayRatingSource === "neutral_fallback").length;
  const notable = [...currentRows].sort((a, b) => b.ratingDiff - a.ratingDiff)[0];
  const configurations = [...new Set(diagnostic.rows.map((row) => `${row.modelVariant} + ${row.calibrationMode}`))].join(", ");
  return `# Diagnóstico de distribución xG

Generado por \`npm run diagnose:xg-distribution\`. Esta auditoría no cambia parámetros, schema ni mercados. Configuración evaluada: **${configurations}**. Sin flags explícitos usa la configuración recommended; acepta \`STAT_MODEL_VARIANT\` y \`STAT_MODEL_CALIBRATION\` para evaluar candidatos como v2.2.

## Hallazgos ejecutivos

- 2026 disponible: **${current.matches} partidos**, xG absoluto medio **${num(current.meanAbsXgDiff)}**, modal 1-1 en **${pct(current.pctTopScore11)}**.
- Histórico: **${historical.matches} partidos**, xG absoluto medio **${num(historical.meanAbsXgDiff)}**, modal 1-1 en **${pct(historical.pctTopScore11)}**.
- Ratings 2026: **${currentFallbacks}/${current.matches}** partidos usan al menos un \`neutral_fallback=74\`.
- Mayor mismatch 2026: ${notable ? `**${notable.homeTeam} – ${notable.awayTeam}** (ΔR ${num(notable.ratingDiff)}, xG ${num(notable.homeXg)}-${num(notable.awayXg)}, modal ${notable.topScorelines[0]?.score ?? "—"})` : "sin partidos evaluables"}.
- Warnings: \`compressionWarning\` ${diagnostic.warningCounts.compressionWarning}, \`underdogInflationWarning\` ${diagnostic.warningCounts.underdogInflationWarning}, \`modalScoreWarning\` ${diagnostic.warningCounts.modalScoreWarning}.
- Los warnings de mismatch usan \`ratingDiff >= 15\`; compresión significa \`favoriteXg - underdogXg < 0.50\` e inflación significa \`underdogXg > 1.10\`.

## Distribución

${summaryTable(diagnostic)}

## Buckets de ratingDiff

${diagnostic.buckets.map((section) => `### ${sourceLabel(section.source)}\n\n${bucketTable(section.rows)}`).join("\n\n")}

## Auditoría de calibración y score matrix

El flujo actual calcula primero los lambdas finales con \`estimateExpectedGoals\`, crea con ellos la matriz Poisson y deriva el 1X2 raw. Después, exclusivamente para el modelo recomendado, \`platt-blend-25\` reemplaza las probabilidades de \`home_win\`, \`draw\` y \`away_win\` en la lista de mercados. **La matriz y sus scorelines no se recalibran ni reciben lambdas implícitos calibrados.**

- 1X2 mostrado: calibrado.
- Score matrix y top scorelines: lambdas finales raw del estimador.
- Lambdas calibrados: no existen en el flujo actual.
- Inconsistencia visual posible: sí; un favorito calibrado por encima de 50% puede conservar 1-1 como marcador modal raw.

## Recomendaciones automáticas

- ${diagnostic.warningCounts.compressionWarning ? `Revisar los ${diagnostic.warningCounts.compressionWarning} casos \`compressionWarning\`: el rating separa al menos 15 puntos pero el xG favorito-underdog queda bajo 0.50.` : "No se detectaron casos compressionWarning con el umbral actual."}
- ${diagnostic.warningCounts.underdogInflationWarning ? `Auditar rating fallback, prior defensivo y shrinkage en los ${diagnostic.warningCounts.underdogInflationWarning} casos \`underdogInflationWarning\`; el underdog supera 1.10 xG en un mismatch.` : "No se detectó inflación de underdog en mismatches."}
- ${diagnostic.warningCounts.modalScoreWarning ? `Separar visualmente el 1X2 calibrado del score raw en los ${diagnostic.warningCounts.modalScoreWarning} casos \`modalScoreWarning\`, o calibrar una representación coherente antes de mostrar ambos como una sola predicción.` : "No se detectó divergencia modal/1X2 con el umbral actual."}
- No modificar todavía priors, caps ni ratings: estos indicadores sirven para una siguiente comparación por ablaciones.

## Componentes y partidos

\`Obs\` es el componente de stats observado antes de regularización; \`Bayes\` es ese componente tras prior8; \`Prior\` es el componente rating; \`wB\` es el peso observado de la etapa bayesiana compartida; \`wR\` es el peso rating del blend; \`Ctx\` es el multiplicador de contexto. \`Caps\` sólo lista guardrails que se activaron en ese partido. Los guardrails siempre disponibles son xG [0.2, 4.5], factores ataque/defensa [0.78, 1.25], tilt de rating limitado a ±25 y contexto [0.94, 1.06].

${matchTable(diagnostic.rows)}
`;
}

function buildRow(input: {
  id: string; source: XgDiagnosticSource; tournament: number; homeTeam: string; awayTeam: string;
  homeRating: number; awayRating: number; homeAttack: number; awayAttack: number; homeDefense: number; awayDefense: number;
  homeXg: number; awayXg: number; homeWin: number; draw: number; awayWin: number;
  matrix: ScoreMatrix; breakdown: ExpectedGoalsDiagnosticBreakdown; calibrationMode: string;
  modelVariant: string;
  homeRatingSource: TeamStrengthRating["source"]; awayRatingSource: TeamStrengthRating["source"];
}): XgDistributionMatchRow {
  const homeFavorite = input.homeRating > input.awayRating
    || (input.homeRating === input.awayRating && input.homeWin >= input.awayWin);
  const favoriteXg = homeFavorite ? input.homeXg : input.awayXg;
  const underdogXg = homeFavorite ? input.awayXg : input.homeXg;
  const favoriteProbability = homeFavorite ? input.homeWin : input.awayWin;
  const underdogProbability = homeFavorite ? input.awayWin : input.homeWin;
  const ratingDiff = Math.abs(input.homeRating - input.awayRating);
  const topScorelines = getTopScorelines(input.matrix, 5).map((score) => ({
    score: `${score.homeGoals}-${score.awayGoals}`,
    probability: score.probability,
  }));
  const warnings: XgDistributionMatchRow["warnings"] = [];
  if (ratingDiff >= 15 && favoriteXg - underdogXg < 0.5) warnings.push("compressionWarning");
  if (ratingDiff >= 15 && underdogXg > 1.1) warnings.push("underdogInflationWarning");
  if (topScorelines[0]?.score === "1-1" && favoriteProbability > 0.5) warnings.push("modalScoreWarning");
  return {
    id: input.id, source: input.source, tournament: input.tournament,
    homeTeam: input.homeTeam, awayTeam: input.awayTeam,
    ratingDiff, attackDiff: input.homeAttack - input.awayAttack, defenseDiff: input.homeDefense - input.awayDefense,
    homeRatingSource: input.homeRatingSource, awayRatingSource: input.awayRatingSource,
    homeXg: input.homeXg, awayXg: input.awayXg, xgDiff: input.homeXg - input.awayXg,
    totalXg: input.homeXg + input.awayXg,
    favoriteTeam: homeFavorite ? input.homeTeam : input.awayTeam,
    underdogTeam: homeFavorite ? input.awayTeam : input.homeTeam,
    favoriteXg, underdogXg, favoriteProbability, underdogProbability, drawProbability: input.draw,
    topScorelines, breakdown: input.breakdown, calibrationMode: input.calibrationMode,
    modelVariant: input.modelVariant,
    scoreMatrixLambdaSource: "raw-final-xg", warnings,
  };
}

function summarize(rows: XgDistributionMatchRow[]): XgDistributionSummary {
  const n = rows.length;
  const ratio = (test: (row: XgDistributionMatchRow) => boolean) => n ? rows.filter(test).length / n : 0;
  return {
    matches: n,
    meanHomeXg: mean(rows.map((row) => row.homeXg)),
    meanAwayXg: mean(rows.map((row) => row.awayXg)),
    meanTotalXg: mean(rows.map((row) => row.totalXg)),
    meanAbsXgDiff: mean(rows.map((row) => Math.abs(row.xgDiff))),
    pctAbsXgDiffLt025: ratio((row) => Math.abs(row.xgDiff) < 0.25),
    pctAbsXgDiffLt050: ratio((row) => Math.abs(row.xgDiff) < 0.5),
    pctTopScore11: ratio((row) => row.topScorelines[0]?.score === "1-1"),
    pctFavoriteXgLt17: ratio((row) => row.favoriteXg < 1.7),
    pctUnderdogXgGt10: ratio((row) => row.underdogXg > 1),
  };
}

function bucketRows(rows: XgDistributionMatchRow[]): XgDistributionBucketRow[] {
  return BUCKETS.map((bucket) => {
    const selected = rows.filter((row) => ratingBucket(row.ratingDiff) === bucket);
    return {
      bucket, matches: selected.length,
      meanFavoriteXg: mean(selected.map((row) => row.favoriteXg)),
      meanUnderdogXg: mean(selected.map((row) => row.underdogXg)),
      meanFavoriteXgDiff: mean(selected.map((row) => row.favoriteXg - row.underdogXg)),
      meanFavoriteWinProbability: mean(selected.map((row) => row.favoriteProbability)),
      meanUpsetProbability: mean(selected.map((row) => row.underdogProbability)),
      pctTopScore11: selected.length ? selected.filter((row) => row.topScorelines[0]?.score === "1-1").length / selected.length : 0,
    };
  });
}

function ratingBucket(diff: number): RatingDiffBucket {
  if (diff < 5) return "0-5";
  if (diff < 10) return "5-10";
  if (diff < 15) return "10-15";
  if (diff < 20) return "15-20";
  return "20+";
}

function ratingValues(rating: TeamStrengthRating | null): { overall: number; attack: number; defense: number; source: TeamStrengthRating["source"] } {
  return rating
    ? { overall: rating.overall, attack: rating.attack, defense: rating.defense, source: rating.source }
    : { overall: 74, attack: 74, defense: 74, source: "neutral_fallback" };
}

function requireBreakdown(row: WorldCupBacktestPrediction): ExpectedGoalsDiagnosticBreakdown {
  if (!row.expectedGoalsDiagnostic) throw new Error(`Missing xG component breakdown for ${row.fixtureId}.`);
  return row.expectedGoalsDiagnostic;
}

function marketProbability(prediction: MatchStatModelPrediction, selection: "home_win" | "draw" | "away_win"): number {
  return prediction.marketProbabilities.find((row) => row.selection === selection)?.probability ?? 0;
}

function summaryTable(diagnostic: XgDistributionDiagnostic): string {
  return [
    "| Corpus | N | homeXg | awayXg | totalXg | abs xgDiff | abs<0.25 | abs<0.50 | modal 1-1 | fav xG<1.7 | dog xG>1.0 |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...diagnostic.summaries.map(({ source, summary: s }) => `| ${sourceLabel(source)} | ${s.matches} | ${num(s.meanHomeXg)} | ${num(s.meanAwayXg)} | ${num(s.meanTotalXg)} | ${num(s.meanAbsXgDiff)} | ${pct(s.pctAbsXgDiffLt025)} | ${pct(s.pctAbsXgDiffLt050)} | ${pct(s.pctTopScore11)} | ${pct(s.pctFavoriteXgLt17)} | ${pct(s.pctUnderdogXgGt10)} |`),
  ].join("\n");
}

function bucketTable(rows: XgDistributionBucketRow[]): string {
  return [
    "| ratingDiff | N | xG favorito | xG underdog | xGDiff fav | P(win fav) | P(upset) | modal 1-1 |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.bucket} | ${row.matches} | ${num(row.meanFavoriteXg)} | ${num(row.meanUnderdogXg)} | ${num(row.meanFavoriteXgDiff)} | ${pct(row.meanFavoriteWinProbability)} | ${pct(row.meanUpsetProbability)} | ${pct(row.pctTopScore11)} |`),
  ].join("\n");
}

function matchTable(rows: XgDistributionMatchRow[]): string {
  return [
    "| Año | Partido | Rating source H/A | ΔR | ΔAtk | ΔDef | xG H-A | Fav/Dog xG | P Fav/Dog/Draw | Top 5 | Componentes H; A | Warnings |",
    "|---:|---|---|---:|---:|---:|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.tournament} | ${row.homeTeam} – ${row.awayTeam} | ${row.homeRatingSource} / ${row.awayRatingSource} | ${num(row.ratingDiff)} | ${signed(row.attackDiff)} | ${signed(row.defenseDiff)} | ${num(row.homeXg)}-${num(row.awayXg)} (Δ ${signed(row.xgDiff)}, T ${num(row.totalXg)}) | ${row.favoriteTeam} ${num(row.favoriteXg)} / ${row.underdogTeam} ${num(row.underdogXg)} | ${pct(row.favoriteProbability)} / ${pct(row.underdogProbability)} / ${pct(row.drawProbability)} | ${row.topScorelines.map((score) => `${score.score} ${pct(score.probability)}`).join(", ")} | ${component(row.breakdown.home)}; ${component(row.breakdown.away)} | ${row.warnings.join(", ") || "—"} |`),
  ].join("\n");
}

function component(side: ExpectedGoalsDiagnosticBreakdown["home"]): string {
  return `Prior ${side.priorRatingComponent == null ? "—" : num(side.priorRatingComponent)}, Obs ${num(side.observedStatsComponent)}, Bayes ${num(side.bayesianAdjustedObservedComponent)}, Avg ${num(side.tournamentAverageComponent)}, wB ${side.bayesianObservedWeight == null ? "—" : num(side.bayesianObservedWeight)}, wR ${num(side.ratingBlendWeight)}, Ctx ${num(side.contextAdjustment)}, Final ${num(side.finalXg)}, Caps ${side.capsApplied.join("+") || "—"}`;
}

function sourceLabel(source: "all" | XgDiagnosticSource): string {
  return source === "all" ? "Combinado" : source === "2026-available" ? "2026 disponible" : "Backtest histórico";
}

function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function num(value: number): string { return value.toFixed(3); }
function signed(value: number): string { return `${value >= 0 ? "+" : ""}${num(value)}`; }
function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }
