import assert from "node:assert/strict";
import {
  filterPreMatchEdges,
  filterPreMatchMatches,
  filterPreMatchParlays,
  getMatchKickoffTime,
  isPreMatchEligible,
  normalizeMatchStatus,
} from "../src/lib/matches/pre-match-eligibility";
import type { Edge, Match } from "../src/lib/types";

const now = "2026-06-17T12:00:00Z";

function match(id: string, status: Match["status"] | string, kickoff: string): Match {
  return {
    id,
    home_team_id: `${id}-h`,
    away_team_id: `${id}-a`,
    stage: "Group Stage",
    kickoff,
    venue: null,
    status: status as Match["status"],
    home_score: null,
    away_score: null,
  };
}

const future = match("future", "scheduled", "2026-06-18T12:00:00Z");
const pastScheduled = match("past-scheduled", "scheduled", "2026-06-16T12:00:00Z");
const live = match("live", "live", "2026-06-17T11:00:00Z");
const finished = match("finished", "finished", "2026-06-16T12:00:00Z");
const postponed = match("postponed", "postponed", "2026-06-18T12:00:00Z");
const invalidDate = match("invalid-date", "scheduled", "not-a-date");

assert.equal(normalizeMatchStatus("TIMED"), "scheduled");
assert.equal(normalizeMatchStatus("IN_PLAY"), "live");
assert.equal(normalizeMatchStatus("FT"), "finished");
assert.equal(normalizeMatchStatus("SUSPENDED"), "suspended");
assert.ok(Number.isFinite(getMatchKickoffTime(future)));

assert.equal(isPreMatchEligible(future, now), true);
assert.equal(isPreMatchEligible(pastScheduled, now), false);
assert.equal(isPreMatchEligible(live, now), false);
assert.equal(isPreMatchEligible(finished, now), false);
assert.equal(isPreMatchEligible(postponed, now), false);
assert.equal(isPreMatchEligible(invalidDate, now), false);

const matches = [future, pastScheduled, live, finished, postponed, invalidDate];
assert.deepEqual(filterPreMatchMatches(matches, now).map((item) => item.id), ["future"]);

const edges = matches.map((item) => ({ id: `edge-${item.id}`, match_id: item.id, match: item }) as Edge);
assert.deepEqual(filterPreMatchEdges(edges, matches, now).map((item) => item.match_id), ["future"]);

const parlays = [
  { picks: [{ matchId: "future", match: future }] },
  { picks: [{ matchId: "future", match: future }, { matchId: "finished", match: finished }] },
  { picks: [{ matchId: "past-scheduled", startsAt: pastScheduled.kickoff, matchStatus: "scheduled" as const }] },
];
assert.equal(filterPreMatchParlays(parlays, matches, now).length, 1);

console.log("Pre-match eligibility verification passed");
