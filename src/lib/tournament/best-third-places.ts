import type { Team } from "../types";
import {
  createSeededRandom,
  prepareGroupSimulation,
  type GroupSimulationInput,
  type GroupSimulationResult,
  type SimulatedGroupIterationTeam,
  type SimulatedGroupTeamResult,
} from "./group-simulation";

export const WORLD_CUP_2026_GROUP_COUNT = 12;
export const WORLD_CUP_2026_TOP_TWO_QUALIFIERS = 24;
export const WORLD_CUP_2026_BEST_THIRD_QUALIFIERS = 8;
export const WORLD_CUP_2026_TOTAL_QUALIFIERS = 32;
export const WORLD_CUP_2026_TOTAL_ELIMINATED = 16;

export interface ThirdPlaceRankingEntry extends SimulatedGroupIterationTeam {
  groupId: string;
}

export interface GroupStandings {
  groupId: string;
  teams: SimulatedGroupIterationTeam[];
}

export interface ThirdPlacePointsBand {
  points: number;
  appearances: number;
  qualified: number;
  probabilityAdvance: number;
}

export interface WorldCup2026GroupsSimulationInput {
  groups: GroupSimulationInput[];
  simulations: number;
  seed?: number;
}

export interface WorldCup2026GroupsSimulationResult {
  groups: GroupSimulationResult[];
  simulations: number;
  seed: number;
  qualifiersPerSimulation: typeof WORLD_CUP_2026_TOTAL_QUALIFIERS;
  topTwoQualifiersPerSimulation: typeof WORLD_CUP_2026_TOP_TWO_QUALIFIERS;
  thirdPlaceQualifiersPerSimulation: typeof WORLD_CUP_2026_BEST_THIRD_QUALIFIERS;
  eliminatedPerSimulation: typeof WORLD_CUP_2026_TOTAL_ELIMINATED;
  thirdPlaceQualificationByPoints: ThirdPlacePointsBand[];
  warnings: string[];
  version: "world-cup-2026-groups-monte-carlo-v1";
}

interface TournamentAccumulator {
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  finishes: [number, number, number, number];
  advanceAsTop2: number;
  advanceAsThird: number;
  eliminated: number;
}

const DEFAULT_SEED = 20260618;

/** Ranks third-place teams by points, goal difference, goals scored and a stable seeded fallback. */
export function rankBestThirdPlaces(
  thirds: ThirdPlaceRankingEntry[],
  seed: number,
  qualifyingPlaces = WORLD_CUP_2026_BEST_THIRD_QUALIFIERS
): ThirdPlaceRankingEntry[] {
  return [...thirds]
    .sort((a, b) =>
      b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || deterministicFallback(seed, a) - deterministicFallback(seed, b)
      || a.teamId.localeCompare(b.teamId)
    )
    .slice(0, qualifyingPlaces);
}

/** Public rule-level API: extracts each group's third-place team and returns the eight qualifiers. */
export function selectBestThirdPlacedTeams(
  allGroupStandings: GroupStandings[],
  seed = DEFAULT_SEED
): string[] {
  if (allGroupStandings.length !== WORLD_CUP_2026_GROUP_COUNT) {
    throw new RangeError("Best-third selection requires standings from all 12 groups.");
  }
  const thirds = allGroupStandings.map(({ groupId, teams }) => {
    const third = teams.find((team) => team.position === 3) ?? teams[2];
    if (!third) throw new RangeError(`Group ${groupId} has no third-place team.`);
    return { ...third, groupId };
  });
  return rankBestThirdPlaces(thirds, normalizeSeed(seed)).map((row) => row.teamId);
}

/** Simulates all twelve groups together so every iteration can rank the global third-place table. */
export function simulateWorldCup2026Groups(input: WorldCup2026GroupsSimulationInput): WorldCup2026GroupsSimulationResult {
  validateInput(input);
  const seed = normalizeSeed(input.seed ?? DEFAULT_SEED);
  const prepared = input.groups.map((group) => prepareGroupSimulation({ ...group, simulations: input.simulations, seed }));
  const random = createSeededRandom(seed);
  const accumulators = new Map<string, TournamentAccumulator>();
  const pointBands = new Map<number, { appearances: number; qualified: number }>();
  for (const group of input.groups) for (const team of group.teams) accumulators.set(teamKey(group.groupId, team.id), emptyAccumulator());

  for (let simulation = 0; simulation < input.simulations; simulation++) {
    const iterations = prepared.map((group) => ({ groupId: group.groupId, rows: group.sample(random) }));
    const thirds = iterations.map(({ groupId, rows }) => ({ ...rows[2], groupId }));
    const advancingThirds = new Set(rankBestThirdPlaces(thirds, seed + simulation).map((row) => teamKey(row.groupId, row.teamId)));
    for (const third of thirds) {
      const band = pointBands.get(third.points) ?? { appearances: 0, qualified: 0 };
      band.appearances++;
      if (advancingThirds.has(teamKey(third.groupId, third.teamId))) band.qualified++;
      pointBands.set(third.points, band);
    }
    let topTwoCount = 0;
    let thirdCount = 0;
    let eliminatedCount = 0;

    for (const iteration of iterations) {
      for (const row of iteration.rows) {
        const totals = accumulators.get(teamKey(iteration.groupId, row.teamId))!;
        totals.points += row.points;
        totals.goalsFor += row.goalsFor;
        totals.goalsAgainst += row.goalsAgainst;
        totals.goalDifference += row.goalDifference;
        totals.finishes[row.position - 1]++;
        if (row.position <= 2) {
          totals.advanceAsTop2++;
          topTwoCount++;
        } else if (row.position === 3 && advancingThirds.has(teamKey(iteration.groupId, row.teamId))) {
          totals.advanceAsThird++;
          thirdCount++;
        } else {
          totals.eliminated++;
          eliminatedCount++;
        }
      }
    }
    if (topTwoCount !== WORLD_CUP_2026_TOP_TWO_QUALIFIERS
      || thirdCount !== WORLD_CUP_2026_BEST_THIRD_QUALIFIERS
      || eliminatedCount !== WORLD_CUP_2026_TOTAL_ELIMINATED) {
      throw new Error(`Invalid 2026 qualification counts: top2=${topTwoCount}, thirds=${thirdCount}, eliminated=${eliminatedCount}.`);
    }
  }

  const groups = input.groups.map((group, index): GroupSimulationResult => ({
    groupId: group.groupId,
    simulations: input.simulations,
    modelVariant: prepared[index].modelVariant,
    calibration: prepared[index].calibration,
    seed,
    teams: group.teams.map((team) => summarize(team, accumulators.get(teamKey(group.groupId, team.id))!, input.simulations)),
    warnings: [...new Set([
      ...prepared[index].warnings,
      "Formato 2026 aplicado: primero y segundo clasifican; el tercero compite por 8 cupos globales.",
    ])],
    version: "group-monte-carlo-v1",
  }));

  return {
    groups,
    simulations: input.simulations,
    seed,
    qualifiersPerSimulation: WORLD_CUP_2026_TOTAL_QUALIFIERS,
    topTwoQualifiersPerSimulation: WORLD_CUP_2026_TOP_TWO_QUALIFIERS,
    thirdPlaceQualifiersPerSimulation: WORLD_CUP_2026_BEST_THIRD_QUALIFIERS,
    eliminatedPerSimulation: WORLD_CUP_2026_TOTAL_ELIMINATED,
    thirdPlaceQualificationByPoints: [...pointBands.entries()]
      .sort(([pointsA], [pointsB]) => pointsA - pointsB)
      .map(([points, band]) => ({
        points,
        appearances: band.appearances,
        qualified: band.qualified,
        probabilityAdvance: band.qualified / band.appearances,
      })),
    warnings: [
      "Ranking de mejores terceros: puntos, diferencia de gol, goles a favor y fallback deterministico.",
      "No se modelan fair play, sorteo FIFA ni combinaciones de bracket de Round of 32.",
    ],
    version: "world-cup-2026-groups-monte-carlo-v1",
  };
}

function validateInput(input: WorldCup2026GroupsSimulationInput): void {
  if (input.groups.length !== WORLD_CUP_2026_GROUP_COUNT) throw new RangeError("World Cup 2026 simulation requires exactly 12 groups.");
  if (!Number.isInteger(input.simulations) || input.simulations < 1) throw new RangeError("simulations must be a positive integer.");
  const groupIds = new Set(input.groups.map((group) => group.groupId));
  if (groupIds.size !== WORLD_CUP_2026_GROUP_COUNT) throw new RangeError("World Cup 2026 group ids must be unique.");
  const teamIds = input.groups.flatMap((group) => group.teams.map((team) => team.id));
  if (new Set(teamIds).size !== 48) throw new RangeError("World Cup 2026 simulation requires 48 unique teams.");
}

function summarize(team: Team, total: TournamentAccumulator, simulations: number): SimulatedGroupTeamResult {
  const probabilityAdvanceAsTop2 = total.advanceAsTop2 / simulations;
  const probabilityAdvanceAsThird = total.advanceAsThird / simulations;
  const probabilityEliminated = total.eliminated / simulations;
  return {
    teamId: team.id,
    teamCode: team.code,
    teamName: team.name,
    expectedPoints: total.points / simulations,
    probabilityAdvance: probabilityAdvanceAsTop2 + probabilityAdvanceAsThird,
    probabilityAdvanceAsTop2,
    probabilityAdvanceAsThird,
    probabilityEliminated,
    probabilityWinGroup: total.finishes[0] / simulations,
    probabilityFinishSecond: total.finishes[1] / simulations,
    probabilityFinishThird: total.finishes[2] / simulations,
    probabilityFinishFourth: total.finishes[3] / simulations,
    averageGoalDifference: total.goalDifference / simulations,
    averageGoalsFor: total.goalsFor / simulations,
    averageGoalsAgainst: total.goalsAgainst / simulations,
    timesAdvanced: total.advanceAsTop2 + total.advanceAsThird,
    timesFirst: total.finishes[0],
    timesSecond: total.finishes[1],
    timesThird: total.finishes[2],
    timesThirdQualified: total.advanceAsThird,
  };
}

function emptyAccumulator(): TournamentAccumulator {
  return { points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, finishes: [0, 0, 0, 0], advanceAsTop2: 0, advanceAsThird: 0, eliminated: 0 };
}

function teamKey(groupId: string, teamId: string): string {
  return `${groupId}:${teamId}`;
}

function deterministicFallback(seed: number, row: ThirdPlaceRankingEntry): number {
  return hashString(`${seed}:${row.groupId}:${row.teamId}`);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new RangeError("seed must be finite.");
  return Math.trunc(seed) >>> 0;
}
