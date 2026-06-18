import { TEAM_STRENGTH_RATINGS, type TeamStrengthRating } from "./team-strength-ratings";

export const RATING_SNAPSHOT_YEARS = [1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026] as const;
export type RatingSnapshotYear = typeof RATING_SNAPSHOT_YEARS[number];
type HistoricalSnapshotYear = Exclude<RatingSnapshotYear, 2026>;

export interface TeamRatingSnapshot {
  id: string;
  year: RatingSnapshotYear;
  ratings: TeamStrengthRating[];
  methodology: "manual_historical_estimate" | "current_2026_manual_seed" | "historical_elo";
  isHistorical: boolean;
  source: "manual-historical-estimate" | "Mundial Edge manual seed 2026" | "external-normalized";
  license: string | null;
  version: string;
}

/**
 * Offline pseudo-historical pre-tournament estimates. Values are hand-curated
 * era-strength tiers (not observed tournament results and not external Elo).
 * No third-party license applies. They are versioned to make replacement by a
 * licensed historical Elo source explicit and reproducible.
 */
const HISTORICAL_OVERALLS: Record<HistoricalSnapshotYear, Record<string, number>> = {
  1998: {
    BRA: 90, NOR: 78, MAR: 74, SCO: 74, ITA: 88, CHI: 82, AUT: 78, CMR: 76,
    FRA: 88, DEN: 82, RSA: 72, KSA: 68, NGA: 82, PAR: 78, ESP: 86, BUL: 76,
    NED: 87, MEX: 80, BEL: 80, KOR: 70, GER: 87, YUG: 82, IRN: 70, USA: 74,
    ROU: 82, ENG: 84, COL: 80, TUN: 69, ARG: 88, CRO: 80, JAM: 68, JPN: 70,
  },
  2002: {
    DEN: 82, SEN: 74, URU: 80, FRA: 90, ESP: 87, PAR: 78, RSA: 72, SVN: 72,
    BRA: 89, TUR: 79, CRC: 72, CHN: 68, KOR: 76, USA: 76, POR: 86, POL: 78,
    GER: 84, IRL: 79, CMR: 78, KSA: 67, SWE: 81, ENG: 84, ARG: 89, NGA: 79,
    MEX: 80, ITA: 87, CRO: 80, ECU: 72, JPN: 76, BEL: 79, RUS: 78, TUN: 69,
  },
  2006: {
    GER: 86, ECU: 75, POL: 78, CRC: 72, ENG: 87, SWE: 82, PAR: 78, TRI: 68,
    ARG: 89, NED: 86, CIV: 77, SCG: 76, POR: 86, MEX: 81, ANG: 69, IRN: 72,
    ITA: 87, GHA: 76, CZE: 83, USA: 78, BRA: 92, AUS: 74, CRO: 80, JPN: 75,
    SUI: 81, FRA: 85, KOR: 76, TOG: 68, ESP: 86, UKR: 78, TUN: 71, KSA: 68,
  },
  2010: {
    RSA: 72, MEX: 80, URU: 82, FRA: 84, ARG: 88, NGA: 77, KOR: 77, GRE: 76,
    ENG: 86, USA: 79, ALG: 72, SVN: 73, GER: 85, AUS: 75, SRB: 78, GHA: 78,
    NED: 87, DEN: 80, JPN: 76, CMR: 77, ITA: 85, PAR: 79, NZL: 67, SVK: 76,
    BRA: 90, PRK: 66, CIV: 79, POR: 86, ESP: 91, SUI: 80, HON: 68, CHI: 81,
  },
  2014: {
    BRA: 90, CRO: 81, MEX: 80, CMR: 75, ESP: 91, NED: 86, CHI: 82, AUS: 72,
    COL: 82, GRE: 76, CIV: 78, JPN: 77, URU: 85, CRC: 73, ENG: 85, ITA: 84,
    SUI: 81, ECU: 77, FRA: 86, HON: 68, ARG: 90, BIH: 76, IRN: 71, NGA: 77,
    GER: 89, POR: 86, GHA: 77, USA: 78, BEL: 84, ALG: 73, RUS: 80, KOR: 75,
  },
  2018: {
    RUS: 74, KSA: 68, EGY: 76, URU: 84, POR: 87, ESP: 89, MAR: 75, IRN: 74,
    FRA: 88, AUS: 73, PER: 77, DEN: 81, ARG: 89, ISL: 76, CRO: 82, NGA: 77,
    CRC: 74, SRB: 78, BRA: 91, SUI: 81, GER: 91, MEX: 81, SWE: 80, KOR: 75,
    BEL: 87, PAN: 68, TUN: 72, ENG: 86, COL: 83, JPN: 76, POL: 81, SEN: 78,
  },
  2022: {
    QAT: 69, ECU: 78, SEN: 81, NED: 86, ENG: 88, IRN: 75, USA: 79, WAL: 78,
    ARG: 91, KSA: 69, MEX: 80, POL: 79, DEN: 82, TUN: 73, FRA: 90, AUS: 73,
    GER: 87, JPN: 78, ESP: 88, CRC: 72, MAR: 80, CRO: 84, BEL: 86, CAN: 76,
    SUI: 82, CMR: 75, BRA: 92, SRB: 78, URU: 83, KOR: 77, POR: 87, GHA: 74,
  },
};

const PROFILE_DELTAS: Record<string, [attack: number, defense: number]> = {
  ARG: [2, 0], BEL: [2, -1], BRA: [3, -1], CHI: [2, 0], CIV: [2, -1],
  COL: [2, 0], CRC: [-1, 1], CRO: [0, 2], DEN: [0, 1], ENG: [1, 1],
  ESP: [2, 1], FRA: [1, 1], GER: [1, 1], GHA: [1, -1], GRE: [-2, 2],
  ITA: [-2, 3], JPN: [1, 0], KOR: [1, -1], MAR: [-1, 2], MEX: [1, 0],
  NED: [2, 0], NGA: [2, -1], PAR: [-1, 2], POR: [2, -1], SEN: [1, 1],
  SUI: [-1, 2], SWE: [-1, 2], TUR: [1, 0], URU: [0, 2], USA: [0, 1],
};

const HISTORICAL_SNAPSHOTS: TeamRatingSnapshot[] = (Object.entries(HISTORICAL_OVERALLS) as Array<[string, Record<string, number>]>).map(([yearText, ratings]) => {
  const year = Number(yearText) as HistoricalSnapshotYear;
  return {
    id: `mundial-edge-rating-snapshot-${year}-v2`,
    year,
    ratings: Object.entries(ratings).map(([teamCode, overall]) => historicalRating(teamCode, overall, year)),
    methodology: "manual_historical_estimate",
    isHistorical: true,
    source: "manual-historical-estimate",
    license: null,
    version: "rating-snapshot-v2",
  };
});

const CURRENT_SNAPSHOT: TeamRatingSnapshot = {
  id: "mundial-edge-rating-snapshot-2026-v1",
  year: 2026,
  ratings: TEAM_STRENGTH_RATINGS.map((rating) => ({ ...rating, isHistorical: false })),
  methodology: "current_2026_manual_seed",
  isHistorical: false,
  source: "Mundial Edge manual seed 2026",
  license: null,
  version: "rating-snapshot-v1",
};

export const TEAM_RATING_SNAPSHOTS: TeamRatingSnapshot[] = [...HISTORICAL_SNAPSHOTS, CURRENT_SNAPSHOT]
  .sort((a, b) => a.year - b.year);

export function getRatingSnapshot(year: number): TeamRatingSnapshot | null {
  return TEAM_RATING_SNAPSHOTS.find((snapshot) => snapshot.year === year) ?? null;
}

function historicalRating(teamCode: string, overall: number, year: HistoricalSnapshotYear): TeamStrengthRating {
  const [attackDelta, defenseDelta] = PROFILE_DELTAS[teamCode] ?? [0, 0];
  const attack = clamp(overall + attackDelta, 60, 95);
  const defense = clamp(overall + defenseDelta, 60, 95);
  return {
    teamCode,
    teamName: teamCode,
    overall,
    attack,
    defense,
    overallRating: overall,
    attackRating: attack,
    defenseRating: defense,
    confidence: "medium",
    source: "manual-historical-estimate",
    isHistorical: true,
    updatedAt: `${year}-05-31`,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
