import assert from "node:assert/strict";
import {
  WORLD_CUP_2026_BEST_THIRD_QUALIFIERS,
  WORLD_CUP_2026_TOP_TWO_QUALIFIERS,
  WORLD_CUP_2026_TOTAL_ELIMINATED,
  WORLD_CUP_2026_TOTAL_QUALIFIERS,
  rankBestThirdPlaces,
  selectBestThirdPlacedTeams,
  simulateWorldCup2026Groups,
  type ThirdPlaceRankingEntry,
} from "../src/lib/tournament/best-third-places";
import type { GroupSimulationInput } from "../src/lib/tournament/group-simulation";
import type { Match, Team } from "../src/lib/types";

const groups = Array.from({ length: 12 }, (_, groupIndex) => buildGroup(groupIndex));
const result = simulateWorldCup2026Groups({ groups, simulations: 1_000, seed: 20260618 });

assert.equal(result.topTwoQualifiersPerSimulation, 24);
assert.equal(result.thirdPlaceQualifiersPerSimulation, 8);
assert.equal(result.qualifiersPerSimulation, 32);
assert.equal(result.eliminatedPerSimulation, 16);
assert.equal(WORLD_CUP_2026_TOP_TWO_QUALIFIERS, 24);
assert.equal(WORLD_CUP_2026_BEST_THIRD_QUALIFIERS, 8);
assert.equal(WORLD_CUP_2026_TOTAL_QUALIFIERS, 32);
assert.equal(WORLD_CUP_2026_TOTAL_ELIMINATED, 16);

const teams = result.groups.flatMap((group) => group.teams);
near(teams.reduce((sum, team) => sum + team.probabilityAdvanceAsTop2, 0), 24);
near(teams.reduce((sum, team) => sum + team.probabilityAdvanceAsThird, 0), 8);
near(teams.reduce((sum, team) => sum + team.probabilityAdvance, 0), 32);
near(teams.reduce((sum, team) => sum + team.probabilityEliminated, 0), 16);
assert.equal(teams.reduce((sum, team) => sum + team.timesThirdQualified, 0), 8_000);
assert.equal(result.thirdPlaceQualificationByPoints.reduce((sum, band) => sum + band.appearances, 0), 12_000);
for (const team of teams) {
  near(team.probabilityAdvance, team.probabilityAdvanceAsTop2 + team.probabilityAdvanceAsThird);
  near(team.probabilityAdvance + team.probabilityEliminated, 1);
  near(team.probabilityWinGroup + team.probabilityFinishSecond + team.probabilityFinishThird + team.probabilityFinishFourth, 1);
  assert(Object.values(team).filter((value): value is number => typeof value === "number").every(Number.isFinite));
  assert(team.timesAdvanced === team.timesFirst + team.timesSecond + team.timesThirdQualified);
}

const ranked = rankBestThirdPlaces(thirdRankingFixture(), 99);
assert.equal(ranked.length, 8);
assert.deepEqual(ranked.slice(0, 3).map((team) => team.teamId), ["points", "goal-difference", "goals-for"]);
const controlledStandings = thirdRankingFixture().map((third) => ({
  groupId: third.groupId,
  teams: [
    { ...third, teamId: `${third.teamId}-first`, position: 1 as const },
    { ...third, teamId: `${third.teamId}-second`, position: 2 as const },
    third,
    { ...third, teamId: `${third.teamId}-fourth`, position: 4 as const },
  ],
}));
const selected = selectBestThirdPlacedTeams(controlledStandings, 99);
assert.deepEqual(selected, ranked.map((row) => row.teamId));
assert.deepEqual(selectBestThirdPlacedTeams(controlledStandings, 99), selected, "Seeded draw must be reproducible.");

console.log("Best third places verification passed (24 top-2 + 8 thirds = 32 qualified; 16 eliminated)");

function buildGroup(groupIndex: number): GroupSimulationInput {
  const groupId = String.fromCharCode(65 + groupIndex);
  const teams = Array.from({ length: 4 }, (_, teamIndex): Team => ({
    id: `${groupId}-${teamIndex + 1}`,
    name: `Group ${groupId} Team ${teamIndex + 1}`,
    code: `${groupId}${teamIndex + 1}`,
    group: groupId,
  }));
  const remainingMatches: Match[] = [];
  let matchIndex = 0;
  for (let home = 0; home < teams.length; home++) {
    for (let away = home + 1; away < teams.length; away++) {
      remainingMatches.push({
        id: `${groupId}-match-${++matchIndex}`,
        home_team_id: teams[home].id,
        away_team_id: teams[away].id,
        home_team: teams[home],
        away_team: teams[away],
        stage: `Group ${groupId}`,
        kickoff: `2026-06-${String(10 + matchIndex).padStart(2, "0")}T18:00:00Z`,
        venue: null,
        status: "scheduled",
        home_score: null,
        away_score: null,
      });
    }
  }
  return { groupId, teams, playedMatches: [], remainingMatches, simulations: 500, modelVariant: "xg-v2.1-prior8", calibration: "platt-blend-25" };
}

function thirdRankingFixture(): ThirdPlaceRankingEntry[] {
  const base = (teamId: string, points: number, goalDifference: number, goalsFor: number): ThirdPlaceRankingEntry => ({
    groupId: teamId,
    teamId,
    teamCode: teamId,
    teamName: teamId,
    points,
    goalDifference,
    goalsFor,
    goalsAgainst: goalsFor - goalDifference,
    position: 3,
  });
  return [
    base("goals-for", 4, 1, 5),
    base("goal-difference", 4, 2, 2),
    base("points", 6, 0, 1),
    ...Array.from({ length: 9 }, (_, index) => base(`other-${index}`, 3 - Math.floor(index / 3), index % 3, index)),
  ];
}

function near(actual: number, expected: number, tolerance = 1e-9): void {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, received ${actual}`);
}
