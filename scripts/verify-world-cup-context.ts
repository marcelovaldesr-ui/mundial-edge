import assert from "node:assert/strict";
import { getWorldCupGroupContext, buildGroupStandings, inferWorldCupPhase } from "../src/lib/world-cup";
import type { Match, Team } from "../src/lib/types";

const teams: Team[] = [
  { id: "arg", name: "Argentina", code: "ARG", group: "A" },
  { id: "alg", name: "Argelia", code: "ALG", group: "A" },
  { id: "jpn", name: "Japón", code: "JPN", group: "A" },
  { id: "pan", name: "Panamá", code: "PAN", group: "A" },
];

function team(id: string) {
  return teams.find((item) => item.id === id)!;
}

function match(id: string, home: string, away: string, kickoff: string, status: Match["status"], home_score: number | null, away_score: number | null): Match {
  return {
    id,
    home_team_id: home,
    away_team_id: away,
    home_team: team(home),
    away_team: team(away),
    stage: "Group A",
    kickoff,
    venue: null,
    status,
    home_score,
    away_score,
  };
}

const matches = [
  match("m1", "arg", "alg", "2026-06-12T12:00:00Z", "finished", 2, 0),
  match("m2", "jpn", "pan", "2026-06-12T15:00:00Z", "finished", 1, 1),
  match("m3", "arg", "jpn", "2026-06-18T12:00:00Z", "scheduled", null, null),
  match("m4", "alg", "pan", "2026-06-18T15:00:00Z", "scheduled", null, null),
];

assert.equal(inferWorldCupPhase(matches[0]), "GROUP_STAGE");
const standings = buildGroupStandings(matches).get("Grupo A");
assert(standings, "Expected Grupo A standings.");
assert.equal(standings[0].team?.code, "ARG");
assert.equal(standings[0].points, 3);
assert.equal(standings[0].goalDifference, 2);

const context = getWorldCupGroupContext(matches[2], matches);
assert.equal(context.group, "Grupo A");
assert.equal(context.groupMatchNumber, 2);
assert(context.summary.includes("Grupo A"));
assert(context.homeStanding?.points === 3);

console.log("World Cup context verification passed");
