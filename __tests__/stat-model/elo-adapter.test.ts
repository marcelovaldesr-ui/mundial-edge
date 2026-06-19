import test from "node:test";
import assert from "node:assert/strict";
import { ELO_DATA, getHistoricalElo, getTeamRatingsForWorldCup, normalizeEloRating } from "../../src/lib/stat-model/elo-adapter";

test("normalization remains within 60-100 for typical Elo values", () => {
  for (const elo of [1200, 1500, 1800, 2200]) {
    const rating = normalizeEloRating(elo);
    assert.ok(rating >= 60 && rating <= 100);
  }
});

test("1998 snapshot exposes externally sourced Brazil prior", () => {
  assert.equal(ELO_DATA.length, 224);
  assert.equal(ELO_DATA.filter((row) => row.worldCup === 1998).length, 32);
  assert.equal(getHistoricalElo(1998, "BRA")?.elo, 2091);
  const rating = getTeamRatingsForWorldCup(1998, "BRA");
  assert.ok(rating && rating.overall >= 60 && rating.overall <= 100);
  assert.equal(rating?.source, "historical_elo_hybrid");
});
