/**
 * Poisson model validation against WC 2026 finished matches.
 * Usage: npx tsx scripts/validate-poisson.ts
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 * Writes: reports/poisson-validation.md
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

interface Row {
  matchId: string;
  home: string;
  away: string;
  kickoff: string;
  probHome: number;
  probDraw: number;
  probAway: number;
  actualHome: number;
  actualAway: number;
  result: "H" | "D" | "A";
  brierContrib: number;
  accurate: boolean;
}

async function run() {
  const { data: matches } = await sb
    .from("matches")
    .select(
      "id, kickoff, home_score, away_score, home_team:teams!home_team_id(name,code), away_team:teams!away_team_id(name,code)"
    )
    .eq("status", "finished")
    .not("home_score", "is", null)
    .order("kickoff", { ascending: false })
    .limit(10);

  if (!matches?.length) {
    console.log("No finished matches found.");
    return;
  }

  const ids = matches.map((m: any) => m.id);
  const { data: preds } = await sb
    .from("predictions")
    .select("match_id, outcome, model_probability")
    .in("match_id", ids)
    .eq("market", "1x2");

  const predMap = new Map<string, { home: number; draw: number; away: number }>();
  for (const p of (preds ?? []) as any[]) {
    const e = predMap.get(p.match_id) ?? { home: 0, draw: 0, away: 0 };
    if (p.outcome === "home") e.home = p.model_probability;
    if (p.outcome === "draw") e.draw = p.model_probability;
    if (p.outcome === "away") e.away = p.model_probability;
    predMap.set(p.match_id, e);
  }

  const rows: Row[] = [];
  for (const m of matches as any[]) {
    const pred = predMap.get(m.id);
    if (!pred) continue;
    const hScore = m.home_score, aScore = m.away_score;
    const result: Row["result"] = hScore > aScore ? "H" : hScore < aScore ? "A" : "D";
    const actual = { home: result === "H" ? 1 : 0, draw: result === "D" ? 1 : 0, away: result === "A" ? 1 : 0 };
    const brier = (pred.home - actual.home) ** 2 + (pred.draw - actual.draw) ** 2 + (pred.away - actual.away) ** 2;
    const predicted = pred.home > pred.draw && pred.home > pred.away ? "H" : pred.away > pred.draw ? "A" : "D";
    rows.push({
      matchId: m.id,
      home: (m.home_team as any)?.code ?? "?",
      away: (m.away_team as any)?.code ?? "?",
      kickoff: m.kickoff,
      probHome: pred.home,
      probDraw: pred.draw,
      probAway: pred.away,
      actualHome: hScore,
      actualAway: aScore,
      result,
      brierContrib: brier,
      accurate: predicted === result,
    });
  }

  if (!rows.length) {
    console.log("No predictions found for finished matches.");
    return;
  }

  const avgBrier = rows.reduce((s, r) => s + r.brierContrib, 0) / rows.length;
  const accuracy = rows.filter((r) => r.accurate).length / rows.length;

  const table = rows.map((r) =>
    `| ${r.home}-${r.away} | ${r.actualHome}-${r.actualAway} (${r.result}) | ${pct(r.probHome)} | ${pct(r.probDraw)} | ${pct(r.probAway)} | ${r.brierContrib.toFixed(3)} | ${r.accurate ? "✓" : "✗"} |`
  ).join("\n");

  const report = `# Validación del modelo Poisson — WC 2026

Generado: ${new Date().toISOString()}

## Resumen

| Métrica | Valor |
|---------|-------|
| Partidos evaluados | ${rows.length} |
| Brier Score medio | ${avgBrier.toFixed(4)} |
| Accuracy (predicción de resultado) | ${(accuracy * 100).toFixed(1)}% |

## Detalle por partido

| Partido | Score | P(H) | P(X) | P(A) | Brier | Acierto |
|---------|-------|------|------|------|-------|---------|
${table}

## Referencia histórica
- Brier Score modelo histórico (1998-2022): **0.5920** (sobre 448 partidos)
- Baseline uniforme (33.3% cada resultado): **0.6667**
- Umbral aceptable: < 0.65 → mantener MARKET_WEIGHT=0.78

---
*Resultados estadísticos. No predicen resultados futuros.*
`;

  const outPath = path.join(process.cwd(), "reports", "poisson-validation.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, "utf8");
  console.log(`\nValidation report written to ${outPath}`);
  console.log(`Brier Score: ${avgBrier.toFixed(4)} | Accuracy: ${(accuracy * 100).toFixed(1)}%`);
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

run().catch(console.error);
