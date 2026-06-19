export type TransparencyMarketId = "home_win" | "over_2_5" | "btts_yes";

export interface PublicMetrics {
  count: number;
  brierScore: number;
  logLoss: number;
  rankedProbabilityScore: number | null;
  accuracy: number;
}

export interface ReliabilityBin {
  bin: number;
  lower: number;
  upper: number;
  meanPredicted: number | null;
  actualFrequency: number | null;
  count: number;
}

export interface TransparencyReport {
  schemaVersion: 1;
  generatedAt: string;
  corpus: {
    firstWorldCup: number;
    lastWorldCup: number;
    tournaments: number[];
    matches: number;
    evaluation: string;
  };
  model: {
    id: "xg-v2.2-mismatch-spread-calibrated-matrix";
    label: string;
    temperature: 0.65;
  };
  global: PublicMetrics;
  baselines: Array<{
    id: "uniform-1x2" | "historical-frequency";
    label: string;
    probabilities: { home: number; draw: number; away: number };
    metrics: PublicMetrics;
    improvement: { brierScore: number; logLoss: number; rankedProbabilityScore: number };
  }>;
  byTournament: Array<{ tournament: number; metrics: PublicMetrics }>;
  byStage: Array<{ stage: "GROUP" | "KNOCKOUT"; label: string; metrics: PublicMetrics }>;
  byMarket: Array<{
    market: "1x2" | "over_2_5" | "btts";
    label: string;
    metrics: PublicMetrics;
    metricNote: string;
  }>;
  reliability: Array<{
    market: TransparencyMarketId;
    label: string;
    expectedCalibrationError: number;
    bins: ReliabilityBin[];
  }>;
  limitations: string[];
  sources: Array<{ name: string; role: string; url: string | null }>;
}

export function assertTransparencyReport(report: TransparencyReport): void {
  if (report.schemaVersion !== 1 || report.corpus.matches !== 448) throw new Error("Transparency report corpus/schema mismatch.");
  if (report.byTournament.length !== 7 || report.reliability.length !== 3) throw new Error("Transparency report is incomplete.");
  for (const series of report.reliability) {
    if (series.bins.length !== 10 || series.bins.reduce((sum, bin) => sum + bin.count, 0) !== report.corpus.matches) {
      throw new Error(`Invalid reliability bins for ${series.market}.`);
    }
  }
}
