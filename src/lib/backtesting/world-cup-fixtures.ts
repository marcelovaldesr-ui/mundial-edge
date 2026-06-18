import { WORLD_CUP_1998_FIXTURES } from "./fixtures/world-cup-1998";
import { WORLD_CUP_2002_FIXTURES } from "./fixtures/world-cup-2002";
import { WORLD_CUP_2006_FIXTURES } from "./fixtures/world-cup-2006";
import { WORLD_CUP_2010_FIXTURES } from "./fixtures/world-cup-2010";
import { WORLD_CUP_2014_FIXTURES } from "./fixtures/world-cup-2014";
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
  dataset(1998, WORLD_CUP_1998_FIXTURES),
  dataset(2002, WORLD_CUP_2002_FIXTURES),
  dataset(2006, WORLD_CUP_2006_FIXTURES),
  dataset(2010, WORLD_CUP_2010_FIXTURES),
  dataset(2014, WORLD_CUP_2014_FIXTURES),
  dataset(2018, WORLD_CUP_2018_FIXTURES),
  dataset(2022, WORLD_CUP_2022_FIXTURES),
];

export const COMPLETE_WORLD_CUP_FIXTURES = WORLD_CUP_DATASETS.flatMap((dataset) => dataset.fixtures);

function dataset(year: number, fixtures: HistoricalWorldCupFixture[]): HistoricalWorldCupDataset {
  return {
    year,
    fixtures,
    ratingSet: `mundial-edge-rating-snapshot-${year}-${year === 2026 ? "v1" : "v2"}`,
    ratingSnapshotYear: year,
    source: `openfootball/worldcup.json ${year} (CC0), commit 6d4a1b67e09ced583ecc02f5e900c69dd5ec5a2b, normalized locally`,
  };
}
