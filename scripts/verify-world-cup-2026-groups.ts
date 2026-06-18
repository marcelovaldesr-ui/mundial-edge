import assert from "node:assert/strict";
import {
  buildWorldCup2026Groups,
  createWorldCup2026GroupSimulationView,
} from "../src/lib/tournament/world-cup-2026-groups";
import type { Match, Team } from "../src/lib/types";

const teams: Team[] = [
  team("arg", "Argentina", "ARG"),
  team("alg", "Argelia", "ALG"),
  team("jpn", "Japón", "JPN"),
  team("pan", "Panamá", "PAN"),
];
const matches: Match[] = [
  fixture("1", 0, 1, "finished", 2, 0),
  fixture("2", 2, 3, "finished", 1, 1),
  fixture("3", 0, 2),
  fixture("4", 1, 3),
  fixture("5", 0, 3),
  fixture("6", 1, 2),
];

const groups = buildWorldCup2026Groups(matches);
assert.equal(groups.length, 12, "The adapter must always expose groups A-L");
assert.equal(groups[0].teams.length, 4);
assert.equal(groups[0].matches.length, 6);
assert.equal(groups[0].playedMatches.length, 2);
assert.equal(groups[0].pendingMatches.length, 4);
assert.equal(groups[0].metadata.source, "repository-current");

const current = createWorldCup2026GroupSimulationView(matches, groups[0].groupId, 2_000);
assert.equal(current.dataStatus, "current");
assert.equal(current.result.groupId, groups[0].groupId);
assert.equal(current.result.modelVariant, "xg-v2.1-prior8");
assert.equal(current.result.calibration, "platt-blend-25");
assert(current.result.warnings.some((warning) => warning.includes("recommended simulation model")));
near(current.result.standings.reduce((sum, row) => sum + row.probabilityAdvanceAsTop2, 0), 2, 1e-12, "top-2 total");
for (const row of current.result.standings) {
  near(
    row.probabilityWinGroup + row.probabilityFinishSecond + row.probabilityFinishThird + row.probabilityFinishFourth,
    1,
    1e-12,
    `${row.teamCode} finish total`
  );
  assert(Object.values(row).filter((value): value is number => typeof value === "number").every(Number.isFinite));
}

const incomplete = createWorldCup2026GroupSimulationView(matches.slice(0, 4), null, 100);
assert.equal(incomplete.dataStatus, "preview");
assert.equal(incomplete.groups.length, 12);
assert(incomplete.result.warnings.some((warning) => warning.includes("Fixture actual incompleto")));

console.log("World Cup 2026 group adapter verification passed");

function team(id: string, name: string, code: string): Team {
  return { id, name, code, group: null };
}

function fixture(
  id: string,
  homeIndex: number,
  awayIndex: number,
  status: Match["status"] = "scheduled",
  homeScore: number | null = null,
  awayScore: number | null = null
): Match {
  const home = teams[homeIndex];
  const away = teams[awayIndex];
  return {
    id: `current-${id}`,
    home_team_id: home.id,
    away_team_id: away.id,
    home_team: home,
    away_team: away,
    stage: "Group Stage",
    kickoff: `2026-06-${String(10 + Number(id)).padStart(2, "0")}T18:00:00Z`,
    venue: null,
    status,
    home_score: homeScore,
    away_score: awayScore,
  };
}

function near(actual: number, expected: number, tolerance: number, label: string): void {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}
