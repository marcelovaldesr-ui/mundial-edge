export type HistoricalWorldCupStage =
  | "GROUP"
  | "ROUND_OF_16"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "THIRD_PLACE"
  | "FINAL";

export interface HistoricalTeamRef {
  code: string;
  name: string;
}

export interface HistoricalWorldCupFixture {
  id: string;
  year: number;
  stage: HistoricalWorldCupStage;
  round: string;
  group: string | null;
  homeTeam: HistoricalTeamRef;
  awayTeam: HistoricalTeamRef;
  homeGoals: number;
  awayGoals: number;
  date: string;
  order: number;
  neutralVenue: true;
  scoreBasis: "REGULATION_90";
}

export function historicalFixture(
  year: number,
  order: number,
  date: string,
  stage: HistoricalWorldCupStage,
  group: string | null,
  homeName: string,
  awayName: string,
  homeGoals: number,
  awayGoals: number,
  round?: string
): HistoricalWorldCupFixture {
  return {
    id: `${year}-${String(order).padStart(2, "0")}`,
    year,
    stage,
    round: round ?? defaultRound(stage),
    group,
    homeTeam: team(homeName),
    awayTeam: team(awayName),
    homeGoals,
    awayGoals,
    date,
    order,
    neutralVenue: true,
    scoreBasis: "REGULATION_90",
  };
}

function defaultRound(stage: HistoricalWorldCupStage): string {
  if (stage === "GROUP") return "Group stage";
  if (stage === "ROUND_OF_16") return "Round of 16";
  if (stage === "QUARTER_FINAL") return "Quarter-finals";
  if (stage === "SEMI_FINAL") return "Semi-finals";
  if (stage === "THIRD_PLACE") return "Third place";
  return "Final";
}

function team(name: string): HistoricalTeamRef {
  const code = TEAM_CODES[name];
  if (!code) throw new Error(`Historical team code missing for ${name}.`);
  return { name, code };
}

const TEAM_CODES: Record<string, string> = {
  Algeria: "ALG", Angola: "ANG", Argentina: "ARG", Australia: "AUS", Austria: "AUT", Belgium: "BEL", "Bosnia-Herzegovina": "BIH", Brazil: "BRA", Bulgaria: "BUL", Cameroon: "CMR",
  Canada: "CAN", Chile: "CHI", Colombia: "COL", "Costa Rica": "CRC", Croatia: "CRO", Denmark: "DEN",
  Ecuador: "ECU", Egypt: "EGY", England: "ENG", France: "FRA", Germany: "GER", Ghana: "GHA",
  China: "CHN", "Côte d'Ivoire": "CIV", "Czech Republic": "CZE", Greece: "GRE", Honduras: "HON", Iceland: "ISL", Iran: "IRN", Ireland: "IRL", Italy: "ITA", Jamaica: "JAM", Japan: "JPN", Mexico: "MEX", Morocco: "MAR",
  Netherlands: "NED", "New Zealand": "NZL", Nigeria: "NGA", "North Korea": "PRK", Norway: "NOR", Panama: "PAN", Paraguay: "PAR", Peru: "PER", Poland: "POL",
  Portugal: "POR", Qatar: "QAT", Russia: "RUS", "Saudi Arabia": "KSA", Senegal: "SEN",
  Romania: "ROU", Scotland: "SCO", Serbia: "SRB", "Serbia and Montenegro": "SCG", Slovakia: "SVK", Slovenia: "SVN", "South Africa": "RSA", Spain: "ESP", Sweden: "SWE", Switzerland: "SUI", "South Korea": "KOR",
  Togo: "TOG", "Trinidad and Tobago": "TRI", Tunisia: "TUN", Turkey: "TUR", Ukraine: "UKR", Uruguay: "URU", USA: "USA", Wales: "WAL", Yugoslavia: "YUG",
};
