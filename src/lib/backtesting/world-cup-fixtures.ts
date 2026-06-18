import { WORLD_CUP_2018_FIXTURES } from "./fixtures/world-cup-2018";
import { WORLD_CUP_2022_FIXTURES } from "./fixtures/world-cup-2022";
import type { HistoricalWorldCupFixture } from "./historical-fixture";

export * from "./historical-fixture";

export interface HistoricalWorldCupDataset {
  year: number;
  fixtures: HistoricalWorldCupFixture[];
  ratingSet: string;
  ratingSnapshotYear: number | null;
  source: string;
}

export const WORLD_CUP_DATASETS: HistoricalWorldCupDataset[] = [
  dataset(2018, WORLD_CUP_2018_FIXTURES),
  dataset(2022, WORLD_CUP_2022_FIXTURES),
];

export const COMPLETE_WORLD_CUP_FIXTURES = WORLD_CUP_DATASETS.flatMap((dataset) => dataset.fixtures);

function dataset(year: number, fixtures: HistoricalWorldCupFixture[]): HistoricalWorldCupDataset {
  return {
    year,
    fixtures,
    ratingSet: "mundial-edge-2026-seed-fallback",
    ratingSnapshotYear: null,
    source: `openfootball/worldcup.json ${year} (CC0), normalized locally`,
  };
}
