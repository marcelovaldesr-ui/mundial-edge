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
  awayGoals: number
): HistoricalWorldCupFixture {
  return {
    id: `${year}-${String(order).padStart(2, "0")}`,
    year,
    stage,
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

function team(name: string): HistoricalTeamRef {
  const code = TEAM_CODES[name];
  if (!code) throw new Error(`Historical team code missing for ${name}.`);
  return { name, code };
}

const TEAM_CODES: Record<string, string> = {
  Argentina: "ARG", Australia: "AUS", Belgium: "BEL", Brazil: "BRA", Cameroon: "CMR",
  Canada: "CAN", Colombia: "COL", "Costa Rica": "CRC", Croatia: "CRO", Denmark: "DEN",
  Ecuador: "ECU", Egypt: "EGY", England: "ENG", France: "FRA", Germany: "GER", Ghana: "GHA",
  Iceland: "ISL", Iran: "IRN", Japan: "JPN", Mexico: "MEX", Morocco: "MAR",
  Netherlands: "NED", Nigeria: "NGA", Panama: "PAN", Peru: "PER", Poland: "POL",
  Portugal: "POR", Qatar: "QAT", Russia: "RUS", "Saudi Arabia": "KSA", Senegal: "SEN",
  Serbia: "SRB", Spain: "ESP", Sweden: "SWE", Switzerland: "SUI", "South Korea": "KOR",
  Tunisia: "TUN", Uruguay: "URU", USA: "USA", Wales: "WAL",
};
