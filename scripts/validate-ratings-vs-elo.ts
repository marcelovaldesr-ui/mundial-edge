import { ELO_DATA, ELO_PRIOR_WEIGHT, calibrateEloToMundialEdgeScale, normalizeEloRating } from "../src/lib/stat-model/elo-adapter";
import { TEAM_RATING_SNAPSHOTS } from "../src/lib/stat-model/rating-snapshots";

const historical = TEAM_RATING_SNAPSHOTS.filter((snapshot) => snapshot.year < 2026);
const pairs = historical.flatMap((snapshot) => snapshot.ratings.flatMap((rating) => {
  const elo = ELO_DATA.find((row) => row.worldCup === snapshot.year && row.team === rating.teamCode);
  return elo ? [{
    worldCup: snapshot.year,
    team: rating.teamCode,
    own: (rating.overall - ELO_PRIOR_WEIGHT * calibrateEloToMundialEdgeScale(elo.elo)) / (1 - ELO_PRIOR_WEIGHT),
    adopted: rating.overall,
    attack: (rating.attack - ELO_PRIOR_WEIGHT * calibrateEloToMundialEdgeScale(elo.elo)) / (1 - ELO_PRIOR_WEIGHT),
    defense: (rating.defense - ELO_PRIOR_WEIGHT * calibrateEloToMundialEdgeScale(elo.elo)) / (1 - ELO_PRIOR_WEIGHT),
    elo: elo.elo,
    eloNormalized: normalizeEloRating(elo.elo),
  }] : [];
}));

const own = pairs.map((row) => row.own);
const external = pairs.map((row) => row.eloNormalized);
const regression = linearRegression(own, external);
const eloToOwnRegression = linearRegression(external, own);
const summary = {
  Cobertura: `${pairs.length}/${ELO_DATA.length}`,
  Pearson: pearson(own, external).toFixed(4),
  Spearman: spearman(own, external).toFixed(4),
  RMSE: rmse(own, external).toFixed(4),
  "Sesgo own-Elo": mean(pairs.map((row) => row.own - row.eloNormalized)).toFixed(4),
  "Mapeo lineal": `${regression.a.toFixed(4)} * rating + ${regression.b.toFixed(4)}`,
  "Elo norm. a escala own": `${eloToOwnRegression.a.toFixed(4)} * EloNorm + ${eloToOwnRegression.b.toFixed(4)}`,
  "Pearson adoptado": pearson(pairs.map((row) => row.adopted), external).toFixed(4),
  "RMSE adoptado": rmse(pairs.map((row) => row.adopted), external).toFixed(4),
};

console.log("VALIDACION EXTERNA MUNDIAL EDGE VS ELO RATINGS");
console.table([summary]);
console.log("Por Mundial:");
console.table(historical.map((snapshot) => {
  const rows = pairs.filter((row) => row.worldCup === snapshot.year);
  return {
    Mundial: snapshot.year,
    N: rows.length,
    Pearson: pearson(rows.map((row) => row.own), rows.map((row) => row.eloNormalized)).toFixed(4),
    RMSE: rmse(rows.map((row) => row.own), rows.map((row) => row.eloNormalized)).toFixed(4),
    Sesgo: mean(rows.map((row) => row.own - row.eloNormalized)).toFixed(4),
  };
}));
console.log("Top 10 discrepancias absolutas:");
console.table([...pairs]
  .sort((a, b) => Math.abs(b.own - b.eloNormalized) - Math.abs(a.own - a.eloNormalized))
  .slice(0, 10)
  .map((row) => ({
    Mundial: row.worldCup, Equipo: row.team, Own: row.own.toFixed(1), Ataque: row.attack.toFixed(1),
    Defensa: row.defense.toFixed(1), Elo: row.elo, "Elo norm.": row.eloNormalized.toFixed(1),
    Diferencia: (row.own - row.eloNormalized).toFixed(1), Relativa: `${(Math.abs(row.own - row.eloNormalized) / row.eloNormalized * 100).toFixed(1)}%`,
  })));

function mean(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function rmse(a: number[], b: number[]): number { return Math.sqrt(mean(a.map((value, index) => Math.pow(value - b[index], 2)))); }
function pearson(a: number[], b: number[]): number {
  const ma = mean(a); const mb = mean(b);
  const numerator = a.reduce((sum, value, index) => sum + (value - ma) * (b[index] - mb), 0);
  const denominator = Math.sqrt(a.reduce((sum, value) => sum + Math.pow(value - ma, 2), 0) * b.reduce((sum, value) => sum + Math.pow(value - mb, 2), 0));
  return denominator ? numerator / denominator : 0;
}
function spearman(a: number[], b: number[]): number { return pearson(ranks(a), ranks(b)); }
function ranks(values: number[]): number[] {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const out = new Array<number>(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end++;
    const rank = (start + end - 1) / 2 + 1;
    for (let index = start; index < end; index++) out[sorted[index].index] = rank;
    start = end;
  }
  return out;
}
function linearRegression(x: number[], y: number[]): { a: number; b: number } {
  const mx = mean(x); const my = mean(y);
  const numerator = x.reduce((sum, value, index) => sum + (value - mx) * (y[index] - my), 0);
  const denominator = x.reduce((sum, value) => sum + Math.pow(value - mx, 2), 0);
  const a = numerator / denominator;
  return { a, b: my - a * mx };
}
