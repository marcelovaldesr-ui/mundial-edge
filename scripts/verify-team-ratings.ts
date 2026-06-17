import assert from "node:assert/strict";
import { estimateExpectedGoals, getTeamStrengthRating } from "../src/lib/stat-model";
import type { Team, TeamStats } from "../src/lib/types";

const arg = getTeamStrengthRating("ARG");
const jor = getTeamStrengthRating("JOR");
assert(arg, "Expected ARG rating seed.");
assert(jor, "Expected JOR rating seed.");
assert.equal(arg.source, "manual_seed");
assert.equal(arg.confidence, "medium");
assert(arg.overallRating > jor.overallRating, "ARG should have stronger base rating than JOR.");

const neutralStats = (team_id: string): TeamStats => ({
  team_id,
  matches_played: 0,
  goals_for: 0,
  goals_against: 0,
  goal_diff: 0,
  recent_form: [],
  gf_per_game: 0,
  ga_per_game: 0,
});

const team = (id: string, code: string, name: string): Team => ({
  id,
  code,
  name,
  group: "A",
});

const strongVsWeak = estimateExpectedGoals({
  home: neutralStats("arg"),
  away: neutralStats("jor"),
  homeTeam: team("arg", "ARG", "Argentina"),
  awayTeam: team("jor", "JOR", "Jordania"),
});
const weakVsStrong = estimateExpectedGoals({
  home: neutralStats("jor"),
  away: neutralStats("arg"),
  homeTeam: team("jor", "JOR", "Jordania"),
  awayTeam: team("arg", "ARG", "Argentina"),
});

assert.equal(strongVsWeak.source, "rating_stats_blend_v1");
assert(strongVsWeak.homeExpectedGoals > strongVsWeak.awayExpectedGoals, "Rating prior should separate strong and weak teams from match 0.");
assert(weakVsStrong.awayExpectedGoals > weakVsStrong.homeExpectedGoals, "Away favorite should still carry rating strength.");
assert(strongVsWeak.blend.homeRatingWeight > 0.5, "No tournament sample should lean on rating prior.");

console.log("Team ratings verification passed");
