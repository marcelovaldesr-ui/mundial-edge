"use client";

import { useMemo, useState } from "react";
import { ParlayCard } from "@/components/parlay-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  generateParlaysWithDebug,
  PARLAY_PROFILE_RULES,
  sortAndFilterParlays,
  type Parlay,
  type ParlayFilters,
  type ParlayPick,
  type ParlayProfile,
  type ParlayRiskLevel,
  type ParlaySortKey,
  type RejectedParlayCandidate,
} from "@/lib/parlays";
import type { ScoreMatrix, StatModelCoverage } from "@/lib/stat-model";
import { formatMarketWithLine, formatSelectionName, marketDistributionKey } from "@/lib/markets/market-display";
import { fmtEv, pct } from "@/lib/utils";

const profiles: ParlayProfile[] = ["conservative", "balanced", "aggressive"];
const sortOptions: { value: ParlaySortKey; label: string }[] = [
  { value: "score", label: "Score recomendado" },
  { value: "ev", label: "EV estimado" },
  { value: "probability", label: "Probabilidad ajustada" },
  { value: "risk", label: "Riesgo menor" },
  { value: "odds", label: "Cuota total" },
  { value: "stake", label: "Stake sugerido" },
];

const profileCopy: Record<ParlayProfile, { title: string; text: string }> = {
  conservative: {
    title: "Conservadora",
    text: "Prioriza probabilidad conjunta, cuota moderada, baja correlación y stake prudente.",
  },
  balanced: {
    title: "Balanceada",
    text: "Busca equilibrio entre probabilidad estimada, EV ajustado, cuota total y riesgo controlado.",
  },
  aggressive: {
    title: "Agresiva",
    text: "Explora mayor cuota y varianza, manteniendo EV ajustado positivo y caps de stake.",
  },
};

const riskText: Record<ParlayRiskLevel, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  very_high: "Muy alto",
};

export function ParlayWorkspace({
  picks,
  initialProfile,
  initialDebug,
  scoreMatricesByMatchId,
  coverage,
  excludedNonPreMatchEdges,
}: {
  picks: ParlayPick[];
  initialProfile: ParlayProfile;
  initialDebug?: boolean;
  scoreMatricesByMatchId?: Record<string, ScoreMatrix>;
  coverage?: StatModelCoverage;
  excludedNonPreMatchEdges?: number;
}) {
  const [profile, setProfile] = useState<ParlayProfile>(initialProfile);
  const [bankrollInput, setBankrollInput] = useState("");
  const [sortKey, setSortKey] = useState<ParlaySortKey>("score");
  const [showDebug, setShowDebug] = useState(initialDebug ?? false);
  const [filters, setFilters] = useState({
    maxRisk: "",
    minOdds: "",
    maxOdds: "",
    minEV: "",
    minProbability: "",
    hideHighCorrelation: false,
    legs: "",
  });
  const bankroll = parseBankroll(bankrollInput);
  const rules = PARLAY_PROFILE_RULES[profile];

  const generated = useMemo(
    () => generateParlaysWithDebug(picks, { profile, maxResults: 80, bankroll, scoreMatricesByMatchId }),
    [picks, profile, bankroll, scoreMatricesByMatchId]
  );
  const activeFilters = useMemo(() => parseFilters(filters), [filters]);
  const parlays = useMemo(
    () => sortAndFilterParlays(generated.parlays, activeFilters, sortKey).slice(0, 8),
    [generated.parlays, activeFilters, sortKey]
  );
  const summary = summarize(parlays);
  const matrixCount = generated.parlays.filter((parlay) => parlay.correlationMethod === "score_matrix").length;
  const heuristicCount = generated.parlays.filter((parlay) => parlay.correlationMethod === "heuristic").length;
  const marketDiagnostics = useMemo(
    () => buildMarketDiagnostics(picks, generated.parlays, generated.rejected),
    [picks, generated.parlays, generated.rejected]
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-5 pt-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {profiles.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setProfile(item)}
                  className={
                    "rounded-md border px-3 py-2 text-sm transition " +
                    (item === profile
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
                  }
                >
                  {profileCopy[item].title}
                </button>
              ))}
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Perfil {profileCopy[profile].title}</Badge>
                <Badge variant="outline">Cuota objetivo {rules.targetOddsRange[0]}-{rules.targetOddsRange[1]}</Badge>
                <Badge variant="outline">Legs {rules.preferredLegs.join("/")}</Badge>
                <Badge variant="outline">EV {(rules.minEV * 100).toFixed(1)}-{(rules.maxEV * 100).toFixed(0)}%</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{profileCopy[profile].text}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="bankroll">Bankroll opcional</label>
            <input
              id="bankroll"
              value={bankrollInput}
              onChange={(event) => setBankrollInput(event.target.value)}
              inputMode="decimal"
              placeholder="Ej. 100000"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">
              {bankroll
                ? `Stake estimado calculado sobre ${formatMoney(bankroll)}.`
                : "Vacío o inválido: se muestran unidades, sin monto monetario."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-5 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="sort">Ordenar por</label>
            <select
              id="sort"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as ParlaySortKey)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterInput label="Cuota mín." value={filters.minOdds} onChange={(value) => setFilters((x) => ({ ...x, minOdds: value }))} />
            <FilterInput label="Cuota máx." value={filters.maxOdds} onChange={(value) => setFilters((x) => ({ ...x, maxOdds: value }))} />
            <FilterInput label="EV mín. %" value={filters.minEV} onChange={(value) => setFilters((x) => ({ ...x, minEV: value }))} />
            <FilterInput label="Prob. mín. %" value={filters.minProbability} onChange={(value) => setFilters((x) => ({ ...x, minProbability: value }))} />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="maxRisk">Riesgo máximo</label>
              <select
                id="maxRisk"
                value={filters.maxRisk}
                onChange={(event) => setFilters((x) => ({ ...x, maxRisk: event.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
                <option value="very_high">Muy alto</option>
              </select>
            </div>
            <FilterInput label="Selecciones" value={filters.legs} onChange={(value) => setFilters((x) => ({ ...x, legs: value }))} />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={filters.hideHighCorrelation}
                onChange={(event) => setFilters((x) => ({ ...x, hideHighCorrelation: event.target.checked }))}
              />
              Ocultar correlación alta
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showDebug} onChange={(event) => setShowDebug(event.target.checked)} />
              Modo debug
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Combinadas" value={String(parlays.length)} />
        <SummaryCard label="Mejor EV" value={summary.bestEv == null ? "—" : fmtEv(summary.bestEv)} accent />
        <SummaryCard label="Mayor prob." value={summary.bestProb == null ? "—" : pct(summary.bestProb)} />
        <SummaryCard label="Stake prom." value={summary.avgStake == null ? "—" : `${summary.avgStake.toFixed(2).replace(/\.00$/, "")}u`} />
        <SummaryCard label="Riesgo predominante" value={summary.risk ? riskText[summary.risk] : "—"} />
      </div>

      {coverage && (
        <Card>
          <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-6">
            <CoverageMetric label="Pre-partido" value={coverage.totalPreMatch} />
            <CoverageMetric label="Con matriz" value={coverage.withScoreMatrix} />
            <CoverageMetric label="Stats suficientes" value={coverage.withSufficientTeamStats} />
            <CoverageMetric label="Sin matriz" value={coverage.withoutScoreMatrix} />
            <CoverageMetric label="Comb. matriz" value={matrixCount} />
            <CoverageMetric label="Comb. heurística" value={heuristicCount} />
          </CardContent>
        </Card>
      )}

      {showDebug && excludedNonPreMatchEdges != null && excludedNonPreMatchEdges > 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Edges excluidos por no ser pre-partido elegible:{" "}
            <span className="font-semibold tabular-nums text-foreground">{excludedNonPreMatchEdges}</span>.
            No se borran de Supabase; solo se omiten de combinadas apostables.
          </CardContent>
        </Card>
      )}

      {showDebug && <MarketDiagnostics diagnostics={marketDiagnostics} />}

      <div className="grid gap-4">
        {parlays.map((parlay, index) => (
          <ParlayCard key={parlay.id} parlay={parlay} index={index} />
        ))}
        {parlays.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            No hay combinadas recomendadas para este perfil con los filtros actuales. Es una salida válida:
            el motor prefiere no forzar combinadas cuando la probabilidad, EV o correlación no compensan.
          </div>
        )}
      </div>

      {showDebug && <RejectedCandidates rejected={generated.rejected.slice(0, 30)} />}
    </div>
  );
}

function CoverageMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function parseBankroll(value: string): number | undefined {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function summarize(parlays: Parlay[]) {
  if (!parlays.length) {
    return { bestEv: null, bestProb: null, avgStake: null, risk: null as ParlayRiskLevel | null };
  }
  const bestEv = Math.max(...parlays.map((parlay) => parlay.ev));
  const bestProb = Math.max(...parlays.map((parlay) => parlay.jointProbabilityAdjusted));
  const avgStake = parlays.reduce((sum, parlay) => sum + parlay.suggestedStakeUnits, 0) / parlays.length;
  const riskCounts = new Map<ParlayRiskLevel, number>();
  for (const parlay of parlays) riskCounts.set(parlay.riskLevel, (riskCounts.get(parlay.riskLevel) ?? 0) + 1);
  const risk = Array.from(riskCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { bestEv, bestProb, avgStake, risk };
}

function parseFilters(filters: {
  maxRisk: string;
  minOdds: string;
  maxOdds: string;
  minEV: string;
  minProbability: string;
  hideHighCorrelation: boolean;
  legs: string;
}): ParlayFilters {
  return {
    maxRisk: isRisk(filters.maxRisk) ? filters.maxRisk : undefined,
    minOdds: parsePositive(filters.minOdds),
    maxOdds: parsePositive(filters.maxOdds),
    minEV: parsePercent(filters.minEV),
    minProbability: parsePercent(filters.minProbability),
    hideHighCorrelation: filters.hideHighCorrelation,
    legs: parseInteger(filters.legs),
  };
}

function parsePositive(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePercent(value: string): number | undefined {
  const parsed = parsePositive(value);
  return parsed == null ? undefined : parsed / 100;
}

function parseInteger(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isRisk(value: string): value is ParlayRiskLevel {
  return value === "low" || value === "medium" || value === "high" || value === "very_high";
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={"text-lg font-semibold tabular-nums " + (accent ? "text-success" : "")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function RejectedCandidates({ rejected }: { rejected: RejectedParlayCandidate[] }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div>
          <h2 className="text-base font-semibold">Candidatas descartadas</h2>
          <p className="text-sm text-muted-foreground">Muestra interna para auditar filtros, riesgo, EV y correlación.</p>
        </div>
        <div className="grid gap-2">
          {rejected.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted">{item.reason}</Badge>
                <span className="text-muted-foreground">{item.message}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.picks.map((pick) => `${pick.match?.home_team?.code ?? "LOC"}-${pick.match?.away_team?.code ?? "VIS"} ${formatSelectionName(pick)}`).join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {item.totalOdds != null && <span>Cuota {item.totalOdds.toFixed(2)}</span>}
                {item.jointProbabilityAdjusted != null && <span>Prob. {pct(item.jointProbabilityAdjusted)}</span>}
                {item.ev != null && <span>EV {fmtEv(item.ev)}</span>}
                {item.riskScore != null && <span>Risk {item.riskScore}</span>}
                {item.correlationLevel && <span>Corr. {item.correlationLevel}</span>}
              </div>
            </div>
          ))}
          {rejected.length === 0 && <p className="text-sm text-muted-foreground">No hay descartes para mostrar.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

interface MarketDiagnosticsData {
  available: Array<{ label: string; count: number }>;
  rejected: Array<{ label: string; count: number }>;
  selected: Array<{ label: string; count: number }>;
}

function buildMarketDiagnostics(
  picks: ParlayPick[],
  parlays: Parlay[],
  rejected: RejectedParlayCandidate[]
): MarketDiagnosticsData {
  return {
    available: countMarkets(picks),
    rejected: countMarkets(rejected.flatMap((item) => item.picks)),
    selected: countMarkets(parlays.flatMap((parlay) => parlay.picks)),
  };
}

function countMarkets(picks: ParlayPick[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>();
  for (const pick of picks) {
    const key = marketDistributionKey(pick);
    const current = counts.get(key);
    if (current) current.count++;
    else counts.set(key, { label: formatMarketWithLine(pick), count: 1 });
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function MarketDiagnostics({ diagnostics }: { diagnostics: MarketDiagnosticsData }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div>
          <h2 className="text-base font-semibold">Distribución de mercados</h2>
          <p className="text-sm text-muted-foreground">
            Diagnóstico para revisar si las combinadas dependen demasiado de un tipo de mercado.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <DistributionList title="Disponibles antes de generar" rows={diagnostics.available} />
          <DistributionList title="Descartados por filtros" rows={diagnostics.rejected} />
          <DistributionList title="Seleccionados en combinadas" rows={diagnostics.selected} />
        </div>
      </CardContent>
    </Card>
  );
}

function DistributionList({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-semibold tabular-nums">{row.count}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Sin datos.</p>}
      </div>
    </div>
  );
}
