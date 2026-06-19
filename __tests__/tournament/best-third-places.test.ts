import test from "node:test";
import assert from "node:assert/strict";
import {
  selectBestThirdPlacedTeams,
  type GroupStandings,
} from "../../src/lib/tournament/best-third-places";

test("selects eight thirds by points, goal difference and goals scored", () => {
  const strengths = [
    [6, 0, 2], [5, 0, 2], [4, 3, 2], [4, 2, 5], [4, 2, 4], [4, 1, 9],
    [3, 4, 7], [3, 3, 8], [3, 2, 9], [2, 9, 9], [1, 9, 9], [0, 9, 9],
  ];
  const standings = strengths.map(([points, goalDifference, goalsFor], index) => group(index, points, goalDifference, goalsFor));
  assert.deepEqual(selectBestThirdPlacedTeams(standings, 7), ["third-A", "third-B", "third-C", "third-D", "third-E", "third-F", "third-G", "third-H"]);
});

test("total ties use a reproducible seeded draw", () => {
  const standings = Array.from({ length: 12 }, (_, index) => group(index, 3, 0, 3));
  const first = selectBestThirdPlacedTeams(standings, 2026);
  const repeated = selectBestThirdPlacedTeams(standings, 2026);
  assert.equal(first.length, 8);
  assert.equal(new Set(first).size, 8);
  assert.deepEqual(repeated, first);
});

function group(index: number, points: number, goalDifference: number, goalsFor: number): GroupStandings {
  const groupId = String.fromCharCode(65 + index);
  const row = (position: 1 | 2 | 3 | 4) => ({
    teamId: position === 3 ? `third-${groupId}` : `${groupId}-${position}`,
    teamCode: `${groupId}${position}`,
    teamName: `Group ${groupId} Team ${position}`,
    points: position === 3 ? points : position === 1 ? 9 : position === 2 ? 6 : 0,
    goalsFor: position === 3 ? goalsFor : 0,
    goalsAgainst: position === 3 ? goalsFor - goalDifference : 0,
    goalDifference: position === 3 ? goalDifference : 0,
    position,
  });
  return { groupId, teams: [row(1), row(2), row(3), row(4)] };
}
