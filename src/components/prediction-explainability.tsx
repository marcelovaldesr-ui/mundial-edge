import type { ExpectedGoalsComponents, MatchStatModelPrediction, ProbabilityInterval } from "@/lib/stat-model";
import { pct } from "@/lib/utils";

export function PredictionExplainability({
  prediction,
  compact = false,
}: {
  prediction: MatchStatModelPrediction;
  compact?: boolean;
}) {
  return (
    <details className="group rounded-lg border bg-background/70" open={!compact}>
      <summary className="cursor-pointer list-none px-4 py-3 marker:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Cómo se construye esta predicción</p>
            <p className="text-xs text-muted-foreground">Descomposición xG e incertidumbre P10–P90</p>
          </div>
          <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
        </div>
      </summary>

      <div className="space-y-5 border-t p-4">
        <p className="text-sm leading-relaxed">{prediction.explanation}</p>

        <section aria-labelledby={`waterfall-${prediction.matchId}`}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 id={`waterfall-${prediction.matchId}`} className="text-sm font-semibold">Waterfall de goles esperados</h3>
              <p className="text-xs text-muted-foreground">Cada barra parte del acumulado anterior; los aportes suman exactamente el xG final.</p>
            </div>
            <span className="text-[11px] text-muted-foreground">Verde suma · naranja resta</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Waterfall team={prediction.homeTeam.code} xg={prediction.homeExpectedGoals} components={prediction.expectedGoalsComponents.home} />
            <Waterfall team={prediction.awayTeam.code} xg={prediction.awayExpectedGoals} components={prediction.expectedGoalsComponents.away} />
          </div>
        </section>

        <section aria-labelledby={`uncertainty-${prediction.matchId}`}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 id={`uncertainty-${prediction.matchId}`} className="text-sm font-semibold">Rango probable por mercado</h3>
              <p className="text-xs text-muted-foreground">
                {prediction.probabilityIntervals.samples} simulaciones paramétricas de λ; la línea marca la probabilidad central.
              </p>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium">P10–P90</span>
          </div>
          <div className="grid gap-x-6 gap-y-3 lg:grid-cols-2">
            {prediction.probabilityIntervals.intervals.map((interval) => (
              <IntervalBar
                key={interval.selection}
                interval={interval}
                label={marketLabel(interval.selection, prediction.homeTeam.code, prediction.awayTeam.code)}
              />
            ))}
          </div>
        </section>
      </div>
    </details>
  );
}

function Waterfall({ team, xg, components }: { team: string; xg: number; components: ExpectedGoalsComponents }) {
  const steps = [
    { label: "Promedio torneo", value: components.tournamentAvg },
    { label: "Rating histórico", value: components.priorRating },
    { label: "Forma reciente", value: components.recentForm },
    { label: "Contexto grupo", value: components.context },
  ];
  let running = 0;
  const positions = steps.map((step) => {
    const before = running;
    running += step.value;
    return { ...step, before, after: running };
  });
  const values = [0, ...positions.flatMap((step) => [step.before, step.after]), xg];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.08, 0.08);
  const min = Math.min(0, rawMin - padding);
  const max = rawMax + padding;
  const range = max - min || 1;
  const finalPosition = ((xg - min) / range) * 100;

  return (
    <div className="rounded-md bg-muted/35 p-3">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold">{team}</p>
        <p className="text-lg font-bold tabular-nums">{xg.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">xG</span></p>
      </div>
      <div className="space-y-2">
        {positions.map((step) => {
          const left = ((Math.min(step.before, step.after) - min) / range) * 100;
          const width = Math.max((Math.abs(step.after - step.before) / range) * 100, 1.25);
          return (
            <div key={step.label} className="grid grid-cols-[7.25rem_1fr] items-center gap-2 text-xs">
              <span className="truncate text-muted-foreground">{step.label}</span>
              <div className="relative h-6 rounded bg-background/80" title={`${step.label}: ${signed(step.value)} xG; acumulado ${step.after.toFixed(2)}`}>
                <div className="absolute inset-y-0 w-px bg-border" style={{ left: `${((0 - min) / range) * 100}%` }} />
                <div
                  className={`absolute top-1 h-4 rounded-sm ${step.value >= 0 ? "bg-emerald-500/80" : "bg-orange-500/80"}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 font-medium tabular-nums">{signed(step.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="relative mt-2 h-4 border-t border-dashed">
        <span className="absolute -translate-x-1/2 text-[10px] font-semibold tabular-nums" style={{ left: `${finalPosition}%` }}>{xg.toFixed(2)}</span>
      </div>
    </div>
  );
}

function IntervalBar({ label, interval }: { label: string; interval: ProbabilityInterval }) {
  const left = interval.p10 * 100;
  const width = Math.max((interval.p90 - interval.p10) * 100, 0.75);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{pct(interval.point)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted">
        <div className="absolute h-2 rounded-full bg-sky-400/45" style={{ left: `${left}%`, width: `${width}%` }} />
        <div className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-foreground" style={{ left: `${interval.point * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>P10 {pct(interval.p10)}</span>
        <span>P90 {pct(interval.p90)}</span>
      </div>
    </div>
  );
}

function marketLabel(selection: ProbabilityInterval["selection"], home: string, away: string): string {
  const labels: Record<ProbabilityInterval["selection"], string> = {
    home_win: `${home} gana`,
    draw: "Empate",
    away_win: `${away} gana`,
    over_2_5: "Más de 2.5",
    under_2_5: "Menos de 2.5",
    btts_yes: "Ambos marcan: sí",
    btts_no: "Ambos marcan: no",
  };
  return labels[selection];
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
}
