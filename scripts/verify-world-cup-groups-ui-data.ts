import assert from "node:assert/strict";
import {
  WORLD_CUP_2026_GROUP_IDS,
  buildWorldCup2026Groups,
  createWorldCup2026GroupsUiData,
  selectWorldCup2026Group,
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

const schedules = buildWorldCup2026Groups(matches);
assert.deepEqual(schedules.map((group) => group.groupId), WORLD_CUP_2026_GROUP_IDS);
for (const schedule of schedules) {
  assert.equal(schedule.teams.length, 4, `Group ${schedule.groupId} must expose four teams`);
  assert(
    schedule.matches.length === 6 || schedule.warnings.some((warning) => warning.includes("Fixture")),
    `Group ${schedule.groupId} must expose six matches or an explicit warning`
  );
  assert(schedule.standings.flatMap((row) => [
    row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points,
  ]).every(Number.isFinite));
}

const groupA = schedules[0];
assert.equal(groupA.metadata.dataStatus, "current");
assert.equal(groupA.playedMatches.length, 2);
assert.deepEqual(
  groupA.standings.map((row) => ({ code: row.team.code, pj: row.played, g: row.won, e: row.drawn, p: row.lost, gf: row.goalsFor, gc: row.goalsAgainst, dg: row.goalDifference, pts: row.points })),
  [
    { code: "ARG", pj: 1, g: 1, e: 0, p: 0, gf: 2, gc: 0, dg: 2, pts: 3 },
    { code: "JPN", pj: 1, g: 0, e: 1, p: 0, gf: 1, gc: 1, dg: 0, pts: 1 },
    { code: "PAN", pj: 1, g: 0, e: 1, p: 0, gf: 1, gc: 1, dg: 0, pts: 1 },
    { code: "ALG", pj: 1, g: 0, e: 0, p: 1, gf: 0, gc: 2, dg: -2, pts: 0 },
  ]
);

const uiData = createWorldCup2026GroupsUiData(matches, 250);
assert.equal(uiData.groups.length, 12);
const selectedA = selectWorldCup2026Group(uiData.groups, "A");
const selectedL = selectWorldCup2026Group(uiData.groups, "L");
assert(selectedA && selectedL && selectedA.schedule.groupId !== selectedL.schedule.groupId, "Selector must resolve different groups");
assert.equal(selectedA.schedule.metadata.dataStatus, "current");
assert.equal(selectedA.simulation.modelVariant, "xg-v2.1-prior8");
assert.equal(selectedA.simulation.calibration, "platt-blend-25");
near(uiData.groups.flatMap((entry) => entry.simulation.standings).reduce((sum, row) => sum + row.probabilityAdvance, 0), 32, 1e-9);
near(uiData.groups.flatMap((entry) => entry.simulation.standings).reduce((sum, row) => sum + row.probabilityAdvanceAsThird, 0), 8, 1e-9);
for (const row of selectedA.simulation.standings) {
  near(row.probabilityWinGroup + row.probabilityFinishSecond + row.probabilityFinishThird + row.probabilityFinishFourth, 1, 1e-12);
  assert(Object.values(row).filter((value): value is number => typeof value === "number").every(Number.isFinite));
}

console.log("World Cup groups UI data verification passed");

function team(id: string, name: string, code: string): Team {
  return { id, name, code, group: "A" };
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
    id: `group-a-${id}`,
    home_team_id: home.id,
    away_team_id: away.id,
    home_team: home,
    away_team: away,
    stage: "Group A",
    kickoff: `2026-06-${String(10 + Number(id)).padStart(2, "0")}T18:00:00Z`,
    venue: null,
    status,
    home_score: homeScore,
    away_score: awayScore,
  };
}

function near(actual: number, expected: number, tolerance: number): void {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, received ${actual}`);
}
