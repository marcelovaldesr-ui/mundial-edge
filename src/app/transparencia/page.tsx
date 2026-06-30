import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, CheckCircle2, Database, ExternalLink, ShieldCheck, TrendingUp } from "lucide-react";
import rawReport from "../../../data/calibration-report.json";
import { ReliabilityChart } from "@/components/reliability-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assertTransparencyReport, type PublicMetrics, type TransparencyReport } from "@/lib/transparency/report";
import { pct } from "@/lib/utils";
import { getFinishedPickHistory, getRoiStats, getKellyDistribution, type RoiStats } from "@/lib/data/repository";

export const metadata: Metadata = {
  title: "Transparencia del modelo — Mundial Edge",
  description: "Resultados públicos del backtesting de Mundial Edge en 448 partidos de siete Mundiales, calibración, baselines y limitaciones.",
};

const report = rawReport as unknown as TransparencyReport;
assertTransparencyReport(report);

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function TransparencyPage() {
  const [picks, roiStats, kellyDist] = await Promise.all([getFinishedPickHistory(50), getRoiStats(), getKellyDistribution()]);
  const average = report.global;
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-xl border bg-card/70 p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Backtest público</Badge>
              <Badge variant="outline">448 partidos · 7 Mundiales</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Transparencia, no promesas</h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Publicamos cómo rindió el modelo en cada Mundial entre 1998 y 2022. Las métricas incluyen aciertos y errores: una predicción fiable no adivina todo, asigna probabilidades que se cumplen con una frecuencia parecida.
            </p>
          </div>
          <Link href="/metodologia" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Cómo funciona el modelo <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="global-title" className="space-y-4">
        <SectionHeading id="global-title" eyebrow="Resumen global" title="Un solo examen para los siete Mundiales" description={report.corpus.evaluation} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Brier Score" value={num(average.brierScore)} helper="Error probabilístico 1X2" />
          <MetricCard label="Log Loss" value={num(average.logLoss)} helper="Castiga el exceso de confianza" />
          <MetricCard label="RPS" value={num(average.rankedProbabilityScore!)} helper="Respeta el orden 1–X–2" />
          <MetricCard label="Accuracy" value={pct(average.accuracy, 1)} helper={`${average.count} predicciones`} />
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <strong>Modelo evaluado:</strong> {report.model.label}. <span className="text-muted-foreground">Menor Brier, Log Loss y RPS es mejor; mayor Accuracy es mejor.</span>
        </div>
      </section>

      <section aria-labelledby="baseline-title" className="space-y-4">
        <SectionHeading id="baseline-title" eyebrow="Control" title="¿Aporta algo frente a no saber de fútbol?" description="Comparamos exactamente los mismos 448 resultados. La mejora porcentual se calcula sobre el error: cuanto más alta, mejor." />
        <div className="grid gap-4 lg:grid-cols-2">
          {report.baselines.map((baseline) => (
            <Card key={baseline.id}>
              <CardHeader>
                <CardTitle className="text-base">{baseline.label}</CardTitle>
                <p className="text-xs text-muted-foreground">H {pct(baseline.probabilities.home)} · X {pct(baseline.probabilities.draw)} · A {pct(baseline.probabilities.away)}</p>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                <Improvement label="Brier" baseline={baseline.metrics.brierScore} improvement={baseline.improvement.brierScore} />
                <Improvement label="Log Loss" baseline={baseline.metrics.logLoss} improvement={baseline.improvement.logLoss} />
                <Improvement label="RPS" baseline={baseline.metrics.rankedProbabilityScore!} improvement={baseline.improvement.rankedProbabilityScore} />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="world-cups-title" className="space-y-4">
        <SectionHeading id="world-cups-title" eyebrow="Consistencia" title="Desglose por Mundial" description="El color compara cada edición con la media global del propio modelo; no oculta torneos difíciles como 2002." />
        <Card><CardContent className="pt-5">
          <Table>
            <TableHeader><TableRow><TableHead>Mundial</TableHead><TableHead>Brier</TableHead><TableHead>Log Loss</TableHead><TableHead>RPS</TableHead><TableHead>Accuracy</TableHead><TableHead className="text-right">Partidos</TableHead></TableRow></TableHeader>
            <TableBody>{report.byTournament.map((row) => (
              <TableRow key={row.tournament}>
                <TableCell className="font-semibold">{row.tournament}</TableCell>
                <MetricCell value={row.metrics.brierScore} average={average.brierScore} />
                <MetricCell value={row.metrics.logLoss} average={average.logLoss} />
                <MetricCell value={row.metrics.rankedProbabilityScore!} average={average.rankedProbabilityScore!} />
                <MetricCell value={row.metrics.accuracy} average={average.accuracy} higherIsBetter percent />
                <TableCell className="text-right tabular-nums text-muted-foreground">{row.metrics.count}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </CardContent></Card>
      </section>

      <section aria-labelledby="segments-title" className="space-y-4">
        <SectionHeading id="segments-title" eyebrow="Segmentos" title="Fase y mercados" description="1X2 usa Brier multiclase. Over 2.5 y BTTS usan Brier binario; sus escalas no deben compararse directamente." />
        <div className="grid gap-4 lg:grid-cols-2">
          <MetricTable title="Por fase" rows={report.byStage.map((row) => ({ label: row.label, metrics: row.metrics }))} />
          <MetricTable title="Por mercado" rows={report.byMarket.map((row) => ({ label: row.label, metrics: row.metrics, note: row.metricNote }))} />
        </div>
      </section>

      <section aria-labelledby="reliability-title" className="space-y-4">
        <SectionHeading id="reliability-title" eyebrow="Calibración" title="¿Un 60% ocurre realmente seis de cada diez veces?" description="Agrupamos las 448 predicciones en diez rangos. La diagonal punteada es el comportamiento ideal; el tamaño del punto representa cuántos partidos contiene." />
        <Card><CardContent className="pt-5"><ReliabilityChart series={report.reliability} /></CardContent></Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> Datos auditables</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {report.sources.map((source) => <p key={source.name}><strong className="text-foreground">{source.name}:</strong> {source.role}</p>)}
            <p className="text-xs">Reporte generado el {new Date(report.generatedAt).toLocaleDateString("es-CL", { dateStyle: "long", timeZone: "UTC" })}.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Lo que estas cifras no dicen</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {report.limitations.map((limitation) => <p key={limitation} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{limitation}</p>)}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="roi-title" className="space-y-4">
        <SectionHeading
          id="roi-title"
          eyebrow="Rendimiento real del sistema · WC 2026"
          title="ROI en tiempo real"
          description="Resultados verificados de los picks mostrados en /edges, liquidados con el resultado oficial del partido."
        />
        {roiStats ? (
          <RoiDashboard stats={roiStats} />
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="font-medium text-foreground">Sin datos liquidados aún</p>
              <p className="mt-1">El sistema lleva registrando picks desde el {new Date().toLocaleDateString("es-CL", { dateStyle: "long" })}. Los resultados reales aparecerán aquí conforme los partidos finalicen.</p>
            </CardContent>
          </Card>
        )}
        <p className="text-xs text-muted-foreground">
          ROI calculado con stake flat de 1 unidad por pick. Los resultados pasados no garantizan rendimiento futuro. Este sistema es experimental.
        </p>
      </section>

      <section aria-labelledby="kelly-dist-title" className="space-y-4">
        <SectionHeading
          id="kelly-dist-title"
          eyebrow="Kelly Criterion · Análisis histórico"
          title="ROI por rango de stake"
          description="Hipótesis a validar: picks con Kelly 2–4% (bien calibrados) deberían tener mejor ROI que picks con Kelly >8% (señal de edge inflado)."
        />
        {kellyDist ? (
          <KellyDistributionSection data={kellyDist} />
        ) : (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Sin datos suficientes aún. La sección se completará conforme los picks se liquiden.
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="picks-title" className="space-y-4">
        <SectionHeading
          id="picks-title"
          eyebrow="Mundial 2026 · Seguimiento en vivo"
          title="Historial de picks del torneo"
          description="Oportunidades identificadas por el modelo en partidos ya finalizados del Mundial 2026. P = Ganada · G = Perdida. Los resultados estadísticos no predicen rendimiento futuro."
        />
        {picks.length < 5 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="font-medium text-foreground">Datos insuficientes</p>
              <p className="mt-1">Se necesitan al menos 5 partidos finalizados con picks para mostrar esta sección.</p>
            </CardContent>
          </Card>
        ) : (
          <PicksHistoryTable picks={picks} />
        )}
        <p className="text-xs text-muted-foreground">
          Estos resultados corresponden a análisis estadístico previo al partido. No representan una recomendación de apuesta ni garantía de rentabilidad futura. El fútbol contiene azar inherente.
        </p>
      </section>
    </div>
  );
}

function PicksHistoryTable({ picks }: { picks: Awaited<ReturnType<typeof getFinishedPickHistory>> }) {
  const won = picks.filter((p) => p.won).length;
  const total = picks.length;
  const winRate = won / total;
  const roi = picks.reduce((acc, p) => {
    return acc + (p.won ? (p.decimalOdds - 1) : -1);
  }, 0) / total;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tasa de acierto</p><p className="mt-1 text-2xl font-bold tabular-nums">{pct(winRate, 1)}</p><p className="mt-1 text-xs text-muted-foreground">{won}P / {total - won}G de {total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">ROI medio</p><p className={`mt-1 text-2xl font-bold tabular-nums ${roi >= 0 ? "text-success" : "text-danger"}`}>{roi >= 0 ? "+" : ""}{pct(roi, 1)}</p><p className="mt-1 text-xs text-muted-foreground">por unidad apostada</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">EV medio</p><p className="mt-1 text-2xl font-bold tabular-nums text-primary">{pct(picks.reduce((a, p) => a + p.ev, 0) / total, 1)}</p><p className="mt-1 text-xs text-muted-foreground">valor esperado modelo</p></CardContent></Card>
      </div>
      <Card><CardContent className="pt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partido</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Mercado</TableHead>
              <TableHead>Pick</TableHead>
              <TableHead>Cuota</TableHead>
              <TableHead>EV</TableHead>
              <TableHead className="text-right">Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {picks.map((p, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{p.home} vs {p.away}</TableCell>
                <TableCell className="font-mono tabular-nums">{p.homeScore}–{p.awayScore}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.market}</TableCell>
                <TableCell className="text-xs">{p.outcome}</TableCell>
                <TableCell className="font-mono tabular-nums">{p.decimalOdds.toFixed(2)}</TableCell>
                <TableCell className="font-mono tabular-nums text-primary">{pct(p.ev, 1)}</TableCell>
                <TableCell className="text-right">
                  <span className={`font-mono text-xs font-semibold ${p.won ? "text-success" : "text-danger"}`}>
                    {p.won ? "P" : "G"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function SectionHeading({ id, eyebrow, title, description }: { id: string; eyebrow: string; title: string; description: string }) {
  return <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h2 id={id} className="mt-1 text-2xl font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <Card><CardContent className="p-4 sm:p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></CardContent></Card>;
}

function Improvement({ label, baseline, improvement }: { label: string; baseline: number; improvement: number }) {
  return <div className="rounded-md bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label} naïve {num(baseline)}</p><p className="mt-1 flex items-center gap-1 font-semibold text-success"><ArrowDownRight className="h-4 w-4" />{pct(improvement, 1)} menos error</p></div>;
}

function MetricCell({ value, average, higherIsBetter = false, percent = false }: { value: number; average: number; higherIsBetter?: boolean; percent?: boolean }) {
  const favorable = higherIsBetter ? value >= average : value <= average;
  return <TableCell className={`font-medium tabular-nums ${favorable ? "text-success" : "text-danger"}`}>{percent ? pct(value, 1) : num(value)}</TableCell>;
}

function MetricTable({ title, rows }: { title: string; rows: Array<{ label: string; metrics: PublicMetrics; note?: string }> }) {
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Segmento</TableHead><TableHead>Brier</TableHead><TableHead>Log Loss</TableHead><TableHead>Accuracy</TableHead><TableHead className="text-right">N</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.label}><TableCell><p className="font-medium">{row.label}</p>{row.note && <p className="max-w-44 text-[10px] text-muted-foreground">{row.note}</p>}</TableCell><TableCell className="tabular-nums">{num(row.metrics.brierScore)}</TableCell><TableCell className="tabular-nums">{num(row.metrics.logLoss)}</TableCell><TableCell className="tabular-nums">{pct(row.metrics.accuracy, 1)}</TableCell><TableCell className="text-right tabular-nums">{row.metrics.count}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}

function num(value: number): string { return value.toFixed(3); }

function KellyDistributionSection({ data }: { data: { bucket: string; picks: number; wins: number; winRate: number; roi: number }[] }) {
  const maxPicks = Math.max(...data.map((d) => d.picks), 1);
  return (
    <div className="space-y-3">
      <Card><CardContent className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Picks por rango de Kelly%
        </p>
        <div className="flex items-end gap-3 h-16">
          {data.map((d) => (
            <div key={d.bucket} className="flex flex-1 flex-col items-center gap-1">
              <span className="font-mono text-[10px] text-muted-foreground">{d.picks}</span>
              <div
                className={`w-full rounded-t ${d.bucket === ">8%" ? "bg-warning/60" : "bg-primary/60"}`}
                style={{ height: `${Math.max(4, (d.picks / maxPicks) * 44)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-3">
          {data.map((d) => (
            <div key={d.bucket} className="flex-1 text-center font-mono text-[9px] text-muted-foreground">{d.bucket}</div>
          ))}
        </div>
      </CardContent></Card>
      <Card><CardContent className="pt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rango Kelly</TableHead>
              <TableHead>Picks</TableHead>
              <TableHead>Win rate</TableHead>
              <TableHead className="text-right">ROI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.bucket}>
                <TableCell className={`font-mono font-medium ${d.bucket === ">8%" ? "text-warning" : ""}`}>
                  {d.bucket}
                  {d.bucket === ">8%" && <span className="ml-1 text-[10px] text-muted-foreground">(edge inflado?)</span>}
                </TableCell>
                <TableCell className="tabular-nums">
                  {d.picks < 10 ? <span className="text-muted-foreground">{d.picks} (datos insuficientes)</span> : d.picks}
                </TableCell>
                <TableCell className={`font-mono tabular-nums ${d.winRate >= 0.5 ? "text-success" : "text-danger"}`}>
                  {d.picks >= 10 ? pct(d.winRate, 1) : "–"}
                </TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${d.roi >= 0 ? "text-success" : "text-danger"}`}>
                  {d.picks >= 10 ? (d.roi >= 0 ? "+" : "") + pct(d.roi, 1) : "–"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function RoiDashboard({ stats }: { stats: RoiStats }) {
  const roiPositive = stats.roi >= 0;
  const winRateGood = stats.winRate >= 0.5;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Picks mostrados</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{stats.totalPicks}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stats.settled} liquidados</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Aciertos</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{stats.wins}W / {stats.losses}L</p>
          <p className="mt-1 text-xs text-muted-foreground">de {stats.settled} picks</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Win rate</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${winRateGood ? "text-success" : "text-danger"}`}>
            {pct(stats.winRate, 1)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">umbral referencia 50%</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">ROI medio</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${roiPositive ? "text-success" : "text-danger"}`}>
            {roiPositive ? "+" : ""}{pct(stats.roi, 1)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">por unidad apostada</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">P&L total</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${stats.totalPnl >= 0 ? "text-success" : "text-danger"}`}>
            {stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(2)}u
          </p>
          <p className="mt-1 text-xs text-muted-foreground">stake flat 1u/pick</p>
        </CardContent></Card>
      </div>
      {Object.keys(stats.byMarket).length > 0 && (
        <Card><CardContent className="pt-4 overflow-x-auto">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Por mercado</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mercado</TableHead>
                <TableHead>Picks</TableHead>
                <TableHead>Win rate</TableHead>
                <TableHead>ROI</TableHead>
                <TableHead className="text-right">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(stats.byMarket).map(([market, m]) => (
                <TableRow key={market}>
                  <TableCell className="font-medium">{market}</TableCell>
                  <TableCell className="tabular-nums">{m.picks}</TableCell>
                  <TableCell className={`font-mono tabular-nums ${m.wins / m.picks >= 0.5 ? "text-success" : "text-danger"}`}>
                    {pct(m.wins / m.picks, 1)}
                  </TableCell>
                  <TableCell className={`font-mono tabular-nums ${m.roi >= 0 ? "text-success" : "text-danger"}`}>
                    {m.roi >= 0 ? "+" : ""}{pct(m.roi, 1)}
                  </TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${m.pnl >= 0 ? "text-success" : "text-danger"}`}>
                    {m.pnl >= 0 ? "+" : ""}{m.pnl.toFixed(2)}u
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
