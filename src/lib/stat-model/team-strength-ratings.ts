export type TeamRatingConfidence = "low" | "medium" | "high";
export type TeamRatingSource = "manual_seed" | "manual-historical-estimate" | "historical_elo_hybrid" | "neutral_fallback";

export interface TeamStrengthRating {
  teamCode: string;
  teamName: string;
  overall: number;
  attack: number;
  defense: number;
  /** @deprecated Use overall. Kept for compatibility with existing consumers. */
  overallRating: number;
  /** @deprecated Use attack. Kept for compatibility with existing consumers. */
  attackRating: number;
  /** @deprecated Use defense. Kept for compatibility with existing consumers. */
  defenseRating: number;
  formRating?: number;
  tournamentExperience?: number;
  goalkeeperOrDefensiveSolidity?: number;
  confidence: TeamRatingConfidence;
  source: TeamRatingSource;
  isHistorical?: boolean;
  updatedAt?: string;
}

const UPDATED_AT = "2026-06-17";

// Seed prudente para arrancar el Mundial con priors diferenciados. Attack y
// defense se mantienen cerca de overall (normalmente +/- 5). Los ajustes
// moderados reflejan perfiles conocidos: Francia/Portugal mas ofensivos;
// Marruecos/Croacia/Suiza mas defensivos. No son ratings historicos ni live.
export const TEAM_STRENGTH_RATINGS: TeamStrengthRating[] = [
  rating("ARG", "Argentina", 92, 91, 88, 88, 95),
  rating("FRA", "Francia", 92, 92, 87, 86, 92),
  rating("BRA", "Brasil", 90, 90, 86, 84, 92),
  rating("ENG", "Inglaterra", 89, 88, 86, 84, 88),
  rating("ESP", "España", 88, 87, 86, 85, 90),
  rating("POR", "Portugal", 88, 89, 84, 84, 88),
  rating("NED", "Países Bajos", 86, 84, 85, 82, 86),
  rating("GER", "Alemania", 86, 86, 83, 81, 93),
  rating("ITA", "Italia", 84, 80, 86, 78, 90),
  rating("BEL", "Bélgica", 84, 85, 80, 78, 82),
  rating("CRO", "Croacia", 83, 80, 82, 78, 90),
  rating("URU", "Uruguay", 84, 83, 83, 82, 84),
  rating("COL", "Colombia", 83, 82, 80, 84, 78),
  rating("MEX", "México", 80, 78, 79, 76, 82),
  rating("USA", "Estados Unidos", 80, 79, 78, 77, 76),
  rating("SUI", "Suiza", 80, 77, 81, 76, 80),
  rating("DEN", "Dinamarca", 81, 78, 82, 76, 80),
  rating("SEN", "Senegal", 80, 79, 80, 77, 72),
  rating("MAR", "Marruecos", 82, 78, 84, 81, 78),
  rating("JPN", "Japón", 80, 79, 78, 80, 74),
  rating("KOR", "Corea del Sur", 78, 78, 75, 76, 74),
  rating("IRN", "Irán", 77, 76, 76, 74, 72),
  rating("AUS", "Australia", 75, 73, 75, 72, 74),
  rating("CAN", "Canadá", 76, 77, 72, 73, 68),
  rating("ECU", "Ecuador", 79, 78, 78, 77, 70),
  rating("CHI", "Chile", 76, 74, 75, 70, 76),
  rating("PAR", "Paraguay", 75, 72, 76, 72, 74),
  rating("PER", "Perú", 74, 72, 74, 70, 74),
  rating("ALG", "Argelia", 75, 76, 72, 72, 68),
  rating("TUN", "Túnez", 74, 71, 75, 70, 70),
  rating("EGY", "Egipto", 77, 78, 74, 74, 72),
  rating("NGA", "Nigeria", 78, 80, 74, 75, 72),
  rating("GHA", "Ghana", 75, 75, 72, 70, 72),
  rating("CIV", "Costa de Marfil", 77, 78, 74, 76, 70),
  rating("CMR", "Camerún", 75, 75, 73, 70, 72),
  rating("COD", "RD Congo", 72, 72, 71, 68, 62),
  rating("RSA", "Sudáfrica", 72, 70, 72, 70, 64),
  rating("QAT", "Catar", 72, 71, 70, 68, 68),
  rating("KSA", "Arabia Saudita", 71, 70, 70, 68, 68),
  rating("UAE", "Emiratos Árabes Unidos", 69, 69, 68, 66, 60),
  rating("JOR", "Jordania", 68, 68, 67, 66, 58),
  rating("PAN", "Panamá", 70, 69, 69, 68, 62),
  rating("CRC", "Costa Rica", 72, 70, 72, 68, 76),
  rating("JAM", "Jamaica", 71, 72, 68, 69, 60),
  rating("NZL", "Nueva Zelanda", 68, 67, 68, 66, 62),
  rating("UKR", "Ucrania", 80, 78, 80, 77, 76),
  rating("AUT", "Austria", 81, 80, 79, 81, 72),
  rating("SRB", "Serbia", 78, 79, 75, 73, 70),
  rating("POL", "Polonia", 78, 78, 75, 70, 76),
  rating("TUR", "Turquía", 79, 80, 75, 78, 72),
  rating("CZE", "Chequia", 77, 75, 77, 73, 76),
  rating("NOR", "Noruega", 79, 82, 74, 76, 62),
];

const RATING_BY_CODE = new Map(TEAM_STRENGTH_RATINGS.map((item) => [item.teamCode, item]));

export function getTeamStrengthRating(teamCode: string | null | undefined): TeamStrengthRating | null {
  if (!teamCode) return null;
  return RATING_BY_CODE.get(normalizeTeamCode(teamCode)) ?? null;
}

export function neutralTeamStrengthRating(teamCode: string, teamName: string): TeamStrengthRating {
  return {
    teamCode: normalizeTeamCode(teamCode),
    teamName,
    overall: 74,
    attack: 74,
    defense: 74,
    overallRating: 74,
    attackRating: 74,
    defenseRating: 74,
    formRating: 74,
    tournamentExperience: 65,
    goalkeeperOrDefensiveSolidity: 74,
    confidence: "low",
    source: "neutral_fallback",
    isHistorical: false,
    updatedAt: UPDATED_AT,
  };
}

export function getOverallStrength(rating: TeamStrengthRating): number {
  return rating.overall ?? rating.overallRating;
}

export function getAttackStrength(rating: TeamStrengthRating): number {
  return rating.attack ?? rating.attackRating;
}

export function getDefenseStrength(rating: TeamStrengthRating): number {
  return rating.defense ?? rating.defenseRating;
}

function rating(
  teamCode: string,
  teamName: string,
  overallRating: number,
  attackRating: number,
  defenseRating: number,
  formRating: number,
  tournamentExperience: number
): TeamStrengthRating {
  return {
    teamCode,
    teamName,
    overall: overallRating,
    attack: attackRating,
    defense: defenseRating,
    overallRating,
    attackRating,
    defenseRating,
    formRating,
    tournamentExperience,
    goalkeeperOrDefensiveSolidity: defenseRating,
    confidence: "medium",
    source: "manual_seed",
    isHistorical: false,
    updatedAt: UPDATED_AT,
  };
}

function normalizeTeamCode(code: string): string {
  return code.trim().toUpperCase();
}
