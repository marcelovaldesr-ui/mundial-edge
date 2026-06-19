import assert from "node:assert/strict";
import { estimateExpectedGoals, getTeamStrengthRating, neutralTeamStrengthRating } from "../src/lib/stat-model";
import type { Team, TeamStats } from "../src/lib/types";
import { getRatingSnapshot, RATING_SNAPSHOT_YEARS } from "../src/lib/stat-model/rating-snapshots";

const arg = getTeamStrengthRating("ARG");
const jor = getTeamStrengthRating("JOR");
assert(arg, "Expected ARG rating seed.");
assert(jor, "Expected JOR rating seed.");
assert.equal(arg.source, "manual_seed");
assert.equal(arg.confidence, "medium");
assert.deepEqual(RATING_SNAPSHOT_YEARS, [1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026]);
assert(getRatingSnapshot(1998) && getRatingSnapshot(1998)!.methodology === "historical_elo");
assert.equal(getRatingSnapshot(1998)!.isHistorical, true);
assert.equal(getRatingSnapshot(1998)!.ratings.length, 32);
assert(getRatingSnapshot(1998)!.ratings.every((rating) => rating.source === "historical_elo_hybrid" && rating.isHistorical));
assert.equal(getRatingSnapshot(1994), null);
assert(arg.overallRating > jor.overallRating, "ARG should have stronger base rating than JOR.");
assert.equal(arg.overall, arg.overallRating, "Canonical overall must preserve the legacy alias.");
assert.equal(arg.attack, arg.attackRating, "Canonical attack must preserve the legacy alias.");
assert.equal(arg.defense, arg.defenseRating, "Canonical defense must preserve the legacy alias.");

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

const legacyHome = estimateExpectedGoals({
  home: neutralStats("arg"), away: neutralStats("jor"),
  homeTeam: team("arg", "ARG", "Argentina"), awayTeam: team("jor", "JOR", "Jordania"),
  ratingModel: "legacy_v1", neutralVenue: false,
});
const neutralHome = estimateExpectedGoals({
  home: neutralStats("arg"), away: neutralStats("jor"),
  homeTeam: team("arg", "ARG", "Argentina"), awayTeam: team("jor", "JOR", "Jordania"),
  ratingModel: "legacy_v1", neutralVenue: true,
});
assert(neutralHome.homeExpectedGoals < legacyHome.homeExpectedGoals, "Neutral venue must remove home advantage.");
assert(Math.abs(neutralHome.awayExpectedGoals - legacyHome.awayExpectedGoals) < 1e-12, "Neutral venue must not alter away xG.");

const base = neutralTeamStrengthRating("TST", "Test");
const ratingResolver = (input: Team) => {
  if (input.code === "ATK") return { ...base, teamCode: "ATK", teamName: "Attack", attack: 90, attackRating: 90 };
  if (input.code === "LOW") return { ...base, teamCode: "LOW", teamName: "Low attack", attack: 65, attackRating: 65 };
  if (input.code === "DEF") return { ...base, teamCode: "DEF", teamName: "Defense", defense: 90, defenseRating: 90 };
  return { ...base, teamCode: input.code, teamName: input.name, defense: 65, defenseRating: 65 };
};
const highAttack = estimateExpectedGoals({
  home: neutralStats("atk"), away: neutralStats("opp"),
  homeTeam: team("atk", "ATK", "Attack"), awayTeam: team("opp", "OPP", "Opponent"),
  ratingResolver, ratingModel: "attack_defense_v2", neutralVenue: true,
});
const lowAttack = estimateExpectedGoals({
  home: neutralStats("low"), away: neutralStats("opp"),
  homeTeam: team("low", "LOW", "Low attack"), awayTeam: team("opp", "OPP", "Opponent"),
  ratingResolver, ratingModel: "attack_defense_v2", neutralVenue: true,
});
assert(highAttack.homeExpectedGoals > lowAttack.homeExpectedGoals, "Higher attack must increase own xG.");

const versusHighDefense = estimateExpectedGoals({
  home: neutralStats("atk"), away: neutralStats("def"),
  homeTeam: team("atk", "ATK", "Attack"), awayTeam: team("def", "DEF", "Defense"),
  ratingResolver, ratingModel: "attack_defense_v2", neutralVenue: true,
});
assert(versusHighDefense.homeExpectedGoals < highAttack.homeExpectedGoals, "Higher opponent defense must reduce own xG.");

const oneMatchZeroAttack = (team_id: string): TeamStats => ({
  team_id, matches_played: 1, goals_for: 0, goals_against: 0, goal_diff: 0,
  recent_form: ["D"], gf_per_game: 0, ga_per_game: 0,
});
const unregularized = estimateExpectedGoals({
  home: oneMatchZeroAttack("atk"), away: oneMatchZeroAttack("opp"),
  homeTeam: team("atk", "ATK", "Attack"), awayTeam: team("opp", "OPP", "Opponent"),
  ratingResolver, ratingModel: "attack_defense_v2", neutralVenue: true,
});
const prior2 = estimateExpectedGoals({
  home: oneMatchZeroAttack("atk"), away: oneMatchZeroAttack("opp"),
  homeTeam: team("atk", "ATK", "Attack"), awayTeam: team("opp", "OPP", "Opponent"),
  ratingResolver, ratingModel: "attack_defense_v2", neutralVenue: true, priorStrength: 2,
});
const prior8 = estimateExpectedGoals({
  home: oneMatchZeroAttack("atk"), away: oneMatchZeroAttack("opp"),
  homeTeam: team("atk", "ATK", "Attack"), awayTeam: team("opp", "OPP", "Opponent"),
  ratingResolver, ratingModel: "attack_defense_v2", neutralVenue: true, priorStrength: 8,
});
assert.equal(unregularized.priorStrength, null, "Production/default xG v2 must remain unregularized.");
assert.equal(prior2.priorStrength, 2);
assert.equal(prior8.priorStrength, 8);
assert(prior8.homeExpectedGoals > prior2.homeExpectedGoals, "A stronger prior must shrink a one-match zero attack farther toward its rating prior.");
assert.throws(() => estimateExpectedGoals({
  home: neutralStats("atk"), away: neutralStats("opp"), priorStrength: 0,
}), /priorStrength/);

console.log("Team ratings verification passed");
