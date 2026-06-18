import type { Match, Team } from "../types";
import type { StatModelVariant } from "../stat-model/model-variant";
import type { StatModelCalibrationMode } from "../stat-model/calibration-presets";
import {
  simulateGroup,
  type GroupSimulationResult,
  type SimulatedGroupTeamResult,
} from "./group-simulation";

export interface SimulateGroupFromScheduleInput {
  groupId: string;
  teams: Team[];
  matches: Match[];
  simulations: number;
  seed?: number;
  modelVariant?: StatModelVariant;
  calibration?: StatModelCalibrationMode;
}

export interface SplitGroupMatches {
  playedMatches: Match[];
  remainingMatches: Match[];
}

export interface GroupSimulationServiceResult {
  groupId: string;
  teams: Team[];
  simulations: number;
  modelVariant: StatModelVariant;
  calibration: StatModelCalibrationMode;
  seed: number;
  generatedAt: string;
  warnings: string[];
  standings: SimulatedGroupTeamResult[];
  version: "group-simulation-service-v1";
  engineVersion: GroupSimulationResult["version"];
  modelSelection: "recommended-simulation-default" | "explicit-override";
  usesRecommendedSimulationModel: boolean;
}

export const RECOMMENDED_GROUP_SIMULATION_MODEL = {
  modelVariant: "xg-v2.1-prior8",
  calibration: "platt-blend-25",
} as const satisfies { modelVariant: StatModelVariant; calibration: StatModelCalibrationMode };

/**
 * Adapts a raw group schedule to the Monte Carlo engine and returns an ordered,
 * UI-ready read model. It does not read or write persistence.
 */
export function simulateGroupFromSchedule(input: SimulateGroupFromScheduleInput): GroupSimulationServiceResult {
  validateGroupSimulationInput(input);
  const modelVariant = input.modelVariant ?? RECOMMENDED_GROUP_SIMULATION_MODEL.modelVariant;
  const calibration = input.calibration
    ?? (modelVariant === RECOMMENDED_GROUP_SIMULATION_MODEL.modelVariant
      ? RECOMMENDED_GROUP_SIMULATION_MODEL.calibration
      : "none");
  const modelSelection = input.modelVariant == null && input.calibration == null
    ? "recommended-simulation-default"
    : "explicit-override";
  const usesRecommendedSimulationModel = modelVariant === RECOMMENDED_GROUP_SIMULATION_MODEL.modelVariant
    && calibration === RECOMMENDED_GROUP_SIMULATION_MODEL.calibration;
  const teamsById = new Map(input.teams.map((team) => [team.id, team]));
  const warnings = collectAdapterWarnings(input);
  warnings.unshift(modelSelection === "recommended-simulation-default"
    ? `Group simulation usa recommended simulation model: modelVariant=${modelVariant}, calibration=${calibration}.`
    : `Group simulation usa override explicito efectivo: modelVariant=${modelVariant}, calibration=${calibration}.`);
  const normalizedMatches = input.matches.map((match) => normalizeGroupMatch(match, teamsById));
  const { playedMatches, remainingMatches } = splitPlayedAndRemainingMatches(normalizedMatches);
  const simulation = simulateGroup({
    groupId: input.groupId,
    teams: input.teams,
    playedMatches,
    remainingMatches,
    simulations: input.simulations,
    seed: input.seed,
    modelVariant,
    calibration,
  });
  const standings = [...simulation.teams].sort((a, b) =>
    b.probabilityAdvance - a.probabilityAdvance
    || b.probabilityWinGroup - a.probabilityWinGroup
    || b.expectedPoints - a.expectedPoints
    || a.teamCode.localeCompare(b.teamCode)
  );
  validateServiceOutput(standings);
  return {
    groupId: simulation.groupId,
    teams: [...input.teams],
    simulations: simulation.simulations,
    modelVariant: simulation.modelVariant,
    calibration: simulation.calibration,
    seed: simulation.seed,
    generatedAt: new Date().toISOString(),
    warnings: [...new Set([...warnings, ...simulation.warnings])],
    standings,
    version: "group-simulation-service-v1",
    engineVersion: simulation.version,
    modelSelection,
    usesRecommendedSimulationModel,
  };
}

export function normalizeGroupMatch(match: Match, teamsById: ReadonlyMap<string, Team>): Match {
  const homeTeam = teamsById.get(match.home_team_id);
  const awayTeam = teamsById.get(match.away_team_id);
  if (!homeTeam || !awayTeam) throw new RangeError(`Match ${match.id} references a team outside the group.`);
  return {
    ...match,
    home_team: homeTeam,
    away_team: awayTeam,
    neutralVenue: match.neutralVenue ?? true,
  };
}

export function splitPlayedAndRemainingMatches(matches: Match[]): SplitGroupMatches {
  return {
    playedMatches: matches.filter((match) => match.status === "finished"),
    remainingMatches: matches.filter((match) => match.status !== "finished"),
  };
}

export function validateGroupSimulationInput(input: SimulateGroupFromScheduleInput): void {
  const groupId = normalizeGroupId(input.groupId);
  if (!groupId) throw new RangeError("groupId is required.");
  if (input.teams.length !== 4) throw new RangeError("A group schedule requires exactly four teams.");
  const teamIds = new Set<string>();
  for (const team of input.teams) {
    if (!team.id || !team.code || !team.name) throw new RangeError("Every group team requires id, code and name.");
    if (teamIds.has(team.id)) throw new RangeError(`Duplicate team id ${team.id}.`);
    teamIds.add(team.id);
    if (team.group != null && normalizeGroupId(team.group) !== groupId) {
      throw new RangeError(`Team ${team.code} belongs to group ${team.group}, not ${input.groupId}.`);
    }
  }
  if (!Number.isInteger(input.simulations) || input.simulations < 1) {
    throw new RangeError("simulations must be a positive integer.");
  }
  if (input.seed != null && !Number.isFinite(input.seed)) throw new RangeError("seed must be finite.");
  if (input.modelVariant === "experimental-dixon-coles") {
    throw new RangeError("Dixon-Coles is not supported by group simulation service.");
  }
  if (input.modelVariant === "legacy-neutral" && input.calibration != null && input.calibration !== "none") {
    throw new RangeError("Legacy group simulation only supports calibration=none.");
  }
  const matchIds = new Set<string>();
  for (const match of input.matches) {
    if (matchIds.has(match.id)) throw new RangeError(`Duplicate match id ${match.id}.`);
    matchIds.add(match.id);
    if (!teamIds.has(match.home_team_id) || !teamIds.has(match.away_team_id) || match.home_team_id === match.away_team_id) {
      throw new RangeError(`Match ${match.id} is missing a valid group team.`);
    }
    const matchGroup = normalizeGroupId(match.stage);
    if (matchGroup && matchGroup !== groupId) {
      throw new RangeError(`Match ${match.id} belongs to ${match.stage}, not group ${input.groupId}.`);
    }
    if (match.status === "finished") {
      if (!validScore(match.home_score) || !validScore(match.away_score)) {
        throw new RangeError(`Played match ${match.id} requires a valid score.`);
      }
    } else if ((match.home_score != null && !validScore(match.home_score)) || (match.away_score != null && !validScore(match.away_score))) {
      throw new RangeError(`Pending match ${match.id} contains an invalid optional score.`);
    }
  }
}

function collectAdapterWarnings(input: SimulateGroupFromScheduleInput): string[] {
  const warnings: string[] = [];
  const missingTeamGroups = input.teams.filter((team) => team.group == null).length;
  if (missingTeamGroups) warnings.push(`${missingTeamGroups} equipos sin metadata de grupo; se uso groupId=${input.groupId}.`);
  const missingJoins = input.matches.filter((match) => !match.home_team || !match.away_team).length;
  if (missingJoins) warnings.push(`${missingJoins} partidos sin joins completos; el service resolvio los equipos por id.`);
  const uniquePairs = new Set(input.matches.map((match) => [match.home_team_id, match.away_team_id].sort().join(":")));
  if (uniquePairs.size < 6) warnings.push(`Calendario incompleto: ${uniquePairs.size}/6 cruces unicos disponibles.`);
  const liveMatches = input.matches.filter((match) => match.status === "live").length;
  if (liveMatches) warnings.push(`${liveMatches} partidos live se trataron como pendientes completos; v1 no simula desde marcador parcial.`);
  return warnings;
}

function validateServiceOutput(standings: SimulatedGroupTeamResult[]): void {
  for (const row of standings) {
    const values = Object.values(row).filter((value): value is number => typeof value === "number");
    if (values.some((value) => !Number.isFinite(value))) throw new Error(`Simulation output for ${row.teamCode} contains NaN/Infinity.`);
  }
}

function normalizeGroupId(value: string): string {
  return value.trim().toUpperCase().replace(/^(GROUP|GRUPO)\s+/, "").replace(/\s+/g, "_");
}

function validScore(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value >= 0;
}
