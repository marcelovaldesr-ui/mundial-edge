"use client";

import { useMemo, useState } from "react";
import { ParlayCard } from "@/components/parlay-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  generateParlaysWithDebug,
  generateParlaysWithFallback,
  generateSuggestedParlays,
  PARLAY_PROFILE_RULES,
  sortAndFilterParlays,
  type Parlay,
  type RelaxedParlay,
  type ParlayFilters,
  type ParlayPick,
  type ParlayProfile,
  type ParlayConfidence,
  type GenerateParlaysOptions,
  type ParlayRiskLevel,
  type ParlaySortKey,
  type RejectedParlayCandidate,
} from "@/lib/parlays";
import type { Market } from "@/lib/types";
import type { ScoreMatrix, StatModelCoverage } from "@/lib/stat-model";
import { formatMarketWithLine, formatSelectionName, marketDistributionKey } from "@/lib/markets/market-display";
import { fmtEv, pct } from "@/lib/utils";

const profiles: ParlayProfile[] = ["conservative", "balanced", "aggressive"];

const ALL_MARKETS: Market[] = ["1x2", "btts", "over_under_2_5"];
const marketLabels: Record<Market, string> = {
  "1x2": "1X2 — Local / Empate / Visitante",
  "btts": "Ambos marcan — Sí / No",
  "over_under_2_5": "Más/Menos 2.5 goles",
  "over_under_1_5": "Más/Menos 1.5 goles",
  "over_under_3_5": "Más/Menos 3.5 goles",
  "double_chance": "Doble oportunidad",
};
const confidenceLabels: Record<ParlayConfidence, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};
const riskGenerationOptions: Record<ParlayProfile, Pick<GenerateParlaysOptions, "minEdge" | "minConfidence" | "allowLowConfidence">> = {
  // conservative bajado de 5% → 3%: el 5% excluía edges reales en mercado eficiente del Mundial.
  conservative: { minEdge: 0.03, minConfidence: "medium", allowLowConfidence: false },
  balanced: { minEdge: 0.02, minConfidence: "low", allowLowConfidence: true },
  aggressive: { minEdge: 0, minConfidence: "low", allowLowConfidence: true },
};
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
    title: "Equilibrado",
    text: "Busca equilibrio entre probabilidad estimada, EV ajustado, cuota total y riesgo controlado.",
  },
  aggressive: {
    title: "Oportunista",
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
  predictionMetadata,
  coverage,
  excludedNonPreMatchEdges,
}: {
  picks: ParlayPick[];
  initialProfile: ParlayProfile;
  initialDebug?: boolean;
  scoreMatricesByMatchId?: Record<string, ScoreMatrix>;
  predictionMetadata?: GenerateParlaysOptions["predictionMetadata"];
  coverage?: StatModelCoverage;
  excludedNonPreMatchEdges?: number;
}) {
  const [profile, setProfile] = useState<ParlayProfile>(initialProfile);
  const [bankrollInput, setBankrollInput] = useState("");
  const [sortKey, setSortKey] = useState<ParlaySortKey>("score");
  const [showDebug, setShowDebug] = useState(initialDebug ?? false);
  const [excludeEstimated, setExcludeEstimated] = useState(false);
  const [allowSameMatch, setAllowSameMatch] = useState(false);
  const [maxLegsInput, setMaxLegsInput] = useState("");
  // Builder manual
  const [builderMode, setBuilderMode] = useState(false);
  const [manualMinEdge, setManualMinEdge] = useState("");
  const [manualMinConfidence, setManualMinConfidence] = useState<ParlayConfidence | "">("");
  const [manualMarkets, setManualMarkets] = useState<Set<Market>>(new Set(ALL_MARKETS));
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
  const maxLegs = parseInteger(maxLegsInput) ?? undefined;
  const rules = PARLAY_PROFILE_RULES[profile];
  const [targetOdds, setTargetOdds] = useState({ min: "", max: "" });
  const effectiveTargetOdds = useMemo(() => {
    const min = parsePositive(targetOdds.min) ?? rules.targetOddsRange[0];
    const max = parsePositive(targetOdds.max) ?? rules.targetOddsRange[1];
    return max > min ? { min, max } : { min: rules.targetOddsRange[0], max: rules.targetOddsRange[1] };
  }, [targetOdds, rules]);

  // Merge builder overrides on top of profile defaults
  const effectiveGenerationOptions = useMemo(() => {
    const base = riskGenerationOptions[profile];
    if (!builderMode) return base;
    const parsedEdge = parsePercent(manualMinEdge);
    const effectiveConf = manualMinConfidence || undefined;
    const marketsArray = Array.from(manualMarkets) as Market[];
    const allowedMarkets = marketsArray.length > 0 && marketsArray.length < ALL_MARKETS.length
      ? marketsArray
      : undefined;
    return {
      minEdge: parsedEdge ?? base.minEdge,
      minConfidence: effectiveConf ?? base.minConfidence,
      allowLowConfidence: effectiveConf === "low" ? true : effectiveConf ? false : base.allowLowConfidence,
      allowedMarkets,
    };
  }, [builderMode, profile, manualMinEdge, manualMinConfidence, manualMarkets]);

  const generated = useMemo(
    () => generateParlaysWithFallback(picks, {
      profile,
      ...effectiveGenerationOptions,
      maxResults: 30,
      bankroll,
      targetOdds: effectiveTargetOdds,
      excludeEstimated,
      allowSameMatch,
      maxLegs,
      scoreMatricesByMatchId,
      predictionMetadata,
    }),
    [picks, profile, effectiveGenerationOptions, bankroll, effectiveTargetOdds, excludeEstimated, allowSameMatch, maxLegs, scoreMatricesByMatchId, predictionMetadata]
  );
  const profileCounts = useMemo(() => Object.fromEntries(profiles.map((item) => [
    item,
    generateParlaysWithDebug(picks, {
      profile: item,
      ...riskGenerationOptions[item],
      maxResults: 30,
      excludeEstimated,
      allowSameMatch,
      maxLegs,
      scoreMatricesByMatchId,
      predictionMetadata,
    }).parlays.length,
  ])) as Record<ParlayProfile, number>, [picks, excludeEstimated, allowSameMatch, maxLegs, scoreMatricesByMatchId, predictionMetadata]);
  const suggestions = useMemo(() => generateSuggestedParlays(picks, {
    scoreMatricesByMatchId,
    predictionMetadata,
  }), [picks, scoreMatricesByMatchId, predictionMetadata]);
  const activeFilters = useMemo(() => parseFilters(filters), [filters]);
  const parlays = useMemo(
    () => sortAndFilterParlays(generated.parlays, activeFilters, sortKey).slice(0, 30),
    [generated.parlays, activeFilters, sortKey]
  );
  const relaxedAlternatives = useMemo(
    () => sortAndFilterParlays(generated.relaxedAlternatives, activeFilters, sortKey).slice(0, 10) as RelaxedParlay[],
    [generated.relaxedAlternatives, activeFilters, sortKey]
  );
  const summary = summarize(parlays);
  const matrixCount = generated.parlays.filter((parlay) => parlay.correlationMethod === "score_matrix").length;
  const heuristicCount = generated.parlays.filter((parlay) => parlay.correlationMethod === "heuristic").length;
  const marketDiagnostics = useMemo(
    () => buildMarketDiagnostics(picks, generated.parlays, generated.rejected),
    [picks, generated.parlays, generated.rejected]
  );
  const ensembleDiagnostics = useMemo(() => buildEnsembleDiagnostics(picks), [picks]);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-5 pt-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div className="space-y-3">
              <label className="text-sm font-medium" htmlFor="risk-level">Nivel de riesgo</label>
              <input
                id="risk-level"
                aria-label="Nivel de riesgo"
                type="range"
                min={0}
                max={2}
                step={1}
                value={profiles.indexOf(profile)}
                onChange={(event) => setProfile(profiles[Number(event.target.value)] ?? "balanced")}
                className="w-full accent-primary"
              />
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {profiles.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setProfile(item)}
                    className={item === profile ? "font-semibold text-primary" : "text-muted-foreground"}
                  >
                    {profileCopy[item].title} · {profileCounts[item]}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Perfil {profileCopy[profile].title}</Badge>
                <Badge variant="outline">Cuota objetivo {rules.targetOddsRange[0]}-{rules.targetOddsRange[1]}</Badge>
                <Badge variant="outline">Legs {rules.preferredLegs.join("/")}</Badge>
                <Badge variant="outline">EV {(rules.minEV * 100).toFixed(1)}-{(rules.maxEV * 100).toFixed(0)}%</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{profileCopy[profile].text}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <FilterInput label={`Cuota objetivo mín. (def. ${rules.targetOddsRange[0]})`} value={targetOdds.min} onChange={(value) => setTargetOdds((x) => ({ ...x, min: value }))} />
                <FilterInput label={`Cuota objetivo máx. (def. ${rules.targetOddsRange[1]})`} value={targetOdds.max} onChange={(value) => setTargetOdds((x) => ({ ...x, max: value }))} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                La cuota objetivo guía la construcción: las combinadas cercanas a {effectiveTargetOdds.min.toFixed(2)}–{effectiveTargetOdds.max.toFixed(2)} se priorizan en el ranking.
              </p>
            </div>
          </div>

          <div className="space-y-4">
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

            <div className="space-y-2">
              <p className="text-sm font-medium">Opciones del generador</p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="maxLegs">Máx. selecciones por combinada</label>
                  <input
                    id="maxLegs"
                    value={maxLegsInput}
                    onChange={(event) => setMaxLegsInput(event.target.value)}
                    inputMode="numeric"
                    placeholder={`Def. ${rules.maxLegs} (por perfil)`}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={excludeEstimated}
                    onChange={(event) => setExcludeEstimated(event.target.checked)}
                    className="accent-primary"
                  />
                  Excluir cuota estimada
                  <span className="text-xs">(solo cuota real)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allowSameMatch}
                    onChange={(event) => setAllowSameMatch(event.target.checked)}
                    className="accent-primary"
                  />
                  Permitir picks del mismo partido
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Builder manual ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Configuración manual</h2>
              <p className="text-sm text-muted-foreground">
                Sobrescribe el perfil con parámetros específicos de edge, confianza y mercados.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={builderMode}
                onChange={(e) => setBuilderMode(e.target.checked)}
                className="accent-primary h-4 w-4"
              />
              Activar
            </label>
          </div>

          {builderMode && (
            <div className="grid gap-5 lg:grid-cols-3 border-t border-border pt-4">
              {/* Col 1 — Edge mínimo */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Edge mínimo</p>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="builder-min-edge">
                    Valor en % (def. perfil: {((riskGenerationOptions[profile].minEdge ?? 0.02) * 100).toFixed(0)}%)
                  </label>
                  <input
                    id="builder-min-edge"
                    value={manualMinEdge}
                    onChange={(e) => setManualMinEdge(e.target.value)}
                    inputMode="decimal"
                    placeholder={`Ej. ${((riskGenerationOptions[profile].minEdge ?? 0.02) * 100).toFixed(0)}`}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  0% = acepta picks sin edge positivo.{" "}
                  {parsePercent(manualMinEdge) != null && (
                    <span className="text-primary font-medium">
                      Activo: {manualMinEdge}%
                    </span>
                  )}
                </p>
              </div>

              {/* Col 2 — Confianza mínima */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confianza mínima</p>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="builder-confidence">
                    Def. perfil: {confidenceLabels[riskGenerationOptions[profile].minConfidence ?? "low"]}
                  </label>
                  <select
                    id="builder-confidence"
                    value={manualMinConfidence}
                    onChange={(e) => setManualMinConfidence(e.target.value as ParlayConfidence | "")}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Usar la del perfil</option>
                    {(["low", "medium", "high"] as ParlayConfidence[]).map((c) => (
                      <option key={c} value={c}>{confidenceLabels[c]}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Confianza alta → menos picks pero mejor calidad.
                  {manualMinConfidence && (
                    <span className="text-primary font-medium"> Activo: {confidenceLabels[manualMinConfidence]}</span>
                  )}
                </p>
              </div>

              {/* Col 3 — Mercados */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mercados permitidos</p>
                <div className="space-y-2">
                  {ALL_MARKETS.map((market) => (
                    <label key={market} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={manualMarkets.has(market)}
                        onChange={(e) => {
                          const next = new Set(manualMarkets);
                          if (e.target.checked) next.add(market);
                          else next.delete(market);
                          setManualMarkets(next);
                        }}
                        className="accent-primary h-4 w-4"
                      />
                      {marketLabels[market]}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {manualMarkets.size === ALL_MARKETS.length
                    ? "Todos los mercados activos."
                    : manualMarkets.size === 0
                    ? "⚠ Sin mercados: el pool quedará vacío."
                    : `${manualMarkets.size} de ${ALL_MARKETS.length} mercados activos.`}
                </p>
              </div>
            </div>
          )}

          {builderMode && (
            <div className="rounded-md bg-muted/30 border border-border px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-3">
              <span>
                Edge mín.:{" "}
                <span className="font-medium text-foreground">
                  {parsePercent(manualMinEdge) != null
                    ? `${manualMinEdge}%`
                    : `${((riskGenerationOptions[profile].minEdge ?? 0.02) * 100).toFixed(0)}% (perfil)`}
                </span>
              </span>
              <span>
                Confianza:{" "}
                <span className="font-medium text-foreground">
                  {manualMinConfidence ? confidenceLabels[manualMinConfidence] : `${confidenceLabels[riskGenerationOptions[profile].minConfidence ?? "low"]} (perfil)`}
                </span>
              </span>
              <span>
                Mercados:{" "}
                <span className="font-medium text-foreground">
                  {manualMarkets.size === ALL_MARKETS.length
                    ? "Todos"
                    : manualMarkets.size === 0
                    ? "Ninguno"
                    : Array.from(manualMarkets).join(", ")}
                </span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Filtros de display ──────────────────────────────────────── */}
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
      {showDebug && <EnsembleDiagnostics diagnostics={ensembleDiagnostics} />}

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Combinadas destacadas</h2>
            <p className="text-sm text-muted-foreground">Sugerencias temáticas construidas con los mismos controles de edge y compatibilidad.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {suggestions.map((suggestion) => (
              <Card key={suggestion.theme}>
                <CardContent className="space-y-3 pt-5">
                  <Badge variant={suggestion.theme === "surprise" ? "warning" : "success"}>{suggestion.label}</Badge>
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                  <ParlayCard parlay={suggestion.parlay} index={0} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4">
        {parlays.map((parlay, index) => (
          <ParlayCard key={parlay.id} parlay={parlay} index={index} />
        ))}
        {parlays.length === 0 && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-6">
            <p className="text-sm font-medium text-foreground">
              {generated.emptyStateMessage ?? "No hay combinadas que cumplan los filtros actuales."}
            </p>
            {generated.relaxationsApplied.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Relajamos automáticamente: {generated.relaxationsApplied.join(" · ")}.
              </p>
            )}
            {rejectionSummary(generated.rejected).length > 0 && (
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Por qué se descartaron candidatas:</p>
                <ul className="mt-1 list-inside list-disc">
                  {rejectionSummary(generated.rejected).map((row) => (
                    <li key={row.reason}>{rejectionLabel(row.reason)} · {row.count}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {parlays.length === 0 && relaxedAlternatives.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Alternativas relajadas</Badge>
              <p className="text-xs text-muted-foreground">Opciones subóptimas pero válidas, con restricciones aflojadas.</p>
            </div>
            <div className="grid gap-4">
              {relaxedAlternatives.map((parlay, index) => (
                <div key={parlay.id} className="space-y-1">
                  <p className="text-xs text-warning">Alternativa relajada — {parlay.relaxedRule}.</p>
                  <ParlayCard parlay={parlay} index={index} />
                </div>
              ))}
            </div>
          </section>
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

interface EnsembleDiagnosticsData {
  avgWeights: { market: number; poisson: number; ratings: number; realStats: number; worldCupContext: number } | null;
  rows: Array<{
    id: string;
    label: string;
    marketProbability: number | null;
    poissonProbability: number | null;
    finalProbability: number;
    impliedProbability: number | null;
    edge: number;
    confidence: string;
    warnings: string[];
  }>;
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

function buildEnsembleDiagnostics(picks: ParlayPick[]): EnsembleDiagnosticsData {
  const withBreakdown = picks.filter((pick) => pick.finalProbabilityBreakdown);
  if (!withBreakdown.length) return { avgWeights: null, rows: [] };
  const sum = { market: 0, poisson: 0, ratings: 0, realStats: 0, worldCupContext: 0 };
  for (const pick of withBreakdown) {
    const weights = pick.finalProbabilityBreakdown!.weights;
    sum.market += weights.market;
    sum.poisson += weights.poisson;
    sum.ratings += weights.ratings;
    sum.realStats += weights.realStats;
    sum.worldCupContext += weights.worldCupContext;
  }
  const divisor = withBreakdown.length;
  return {
    avgWeights: {
      market: sum.market / divisor,
      poisson: sum.poisson / divisor,
      ratings: sum.ratings / divisor,
      realStats: sum.realStats / divisor,
      worldCupContext: sum.worldCupContext / divisor,
    },
    rows: withBreakdown.slice(0, 8).map((pick) => {
      const breakdown = pick.finalProbabilityBreakdown!;
      return {
        id: pick.id,
        label: `${pick.match?.home_team?.code ?? "LOC"}-${pick.match?.away_team?.code ?? "VIS"} ${formatSelectionName(pick)}`,
        marketProbability: breakdown.components.marketProbability,
        poissonProbability: breakdown.components.poissonProbability,
        finalProbability: breakdown.finalProbability,
        impliedProbability: pick.marketProb,
        edge: pick.edge,
        confidence: breakdown.confidence,
        warnings: breakdown.warnings,
      };
    }),
  };
}

function EnsembleDiagnostics({ diagnostics }: { diagnostics: EnsembleDiagnosticsData }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div>
          <h2 className="text-base font-semibold">Ensemble de probabilidad final</h2>
          <p className="text-sm text-muted-foreground">
            Pesos y probabilidades usados por las combinadas. No crea mercados sin cuota real.
          </p>
        </div>
        {diagnostics.avgWeights ? (
          <div className="grid gap-3 lg:grid-cols-5">
            <SummaryCard label="Peso mercado" value={pct(diagnostics.avgWeights.market, 0)} />
            <SummaryCard label="Peso stat-model" value={pct(diagnostics.avgWeights.poisson, 0)} />
            <SummaryCard label="Peso ratings" value={pct(diagnostics.avgWeights.ratings, 0)} />
            <SummaryCard label="Peso stats reales" value={pct(diagnostics.avgWeights.realStats, 0)} />
            <SummaryCard label="Peso contexto" value={pct(diagnostics.avgWeights.worldCupContext, 0)} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin breakdown de ensemble disponible.</p>
        )}
        <div className="grid gap-2">
          {diagnostics.rows.map((row) => (
            <div key={row.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{row.label}</p>
                <Badge variant={row.confidence === "high" ? "success" : row.confidence === "medium" ? "warning" : "muted"}>
                  Confidence {row.confidence}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {row.marketProbability != null && <span>Prob. mercado {pct(row.marketProbability)}</span>}
                {row.poissonProbability != null && <span>Prob. stat-model {pct(row.poissonProbability)}</span>}
                <span>Prob. final {pct(row.finalProbability)}</span>
                {row.impliedProbability != null && <span>Impl. {pct(row.impliedProbability)}</span>}
                <span>Edge final {fmtEv(row.edge)}</span>
              </div>
              {row.warnings.slice(0, 2).map((warning) => (
                <p key={warning} className="mt-1 text-xs text-muted-foreground">Aviso: {warning}</p>
              ))}
            </div>
          ))}
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


const rejectionLabels: Record<string, string> = {
  pick_duplicated: "Pick duplicado",
  pick_expired: "Pick no pre-partido",
  pick_invalid: "Pick fuera de rango",
  edge_below_minimum: "Edge por debajo del mínimo",
  confidence_below_minimum: "Confianza insuficiente",
  candidate_limit: "Límite de candidatos por partido",
  joint_probability_too_low: "Probabilidad conjunta baja",
  ev_out_of_range: "EV fuera de rango",
  risk_too_high: "Riesgo demasiado alto",
  total_odds_too_high: "Cuota total demasiado alta",
  invalid_correlation: "Correlación inválida",
  same_match_overload: "Demasiados picks del mismo partido",
  same_market_contradiction: "Selecciones contradictorias",
};

function rejectionLabel(reason: string): string {
  return rejectionLabels[reason] ?? reason;
}

function rejectionSummary(rejected: RejectedParlayCandidate[]): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of rejected) counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
