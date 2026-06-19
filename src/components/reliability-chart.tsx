"use client";

import { useState } from "react";
import type { TransparencyReport } from "@/lib/transparency/report";
import { pct } from "@/lib/utils";

type Series = TransparencyReport["reliability"][number];

export function ReliabilityChart({ series }: { series: Series[] }) {
  const [activeMarket, setActiveMarket] = useState(series[0]?.market);
  const active = series.find((row) => row.market === activeMarket) ?? series[0];
  if (!active) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Mercado del diagrama de fiabilidad">
        {series.map((row) => (
          <button
            key={row.market}
            type="button"
            role="tab"
            aria-selected={row.market === active.market}
            onClick={() => setActiveMarket(row.market)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${row.market === active.market ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
          >
            {row.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="rounded-lg bg-muted/25 p-2 sm:p-4">
          <svg viewBox="0 0 440 350" className="h-auto w-full" role="img" aria-labelledby={`chart-title-${active.market} chart-desc-${active.market}`}>
            <title id={`chart-title-${active.market}`}>Calibración de {active.label}</title>
            <desc id={`chart-desc-${active.market}`}>La diagonal representa calibración perfecta. Cada punto compara probabilidad media y frecuencia observada; su tamaño refleja la muestra.</desc>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => {
              const x = scaleX(tick);
              const y = scaleY(tick);
              return (
                <g key={tick}>
                  <line x1={x} x2={x} y1={20} y2={300} className="stroke-border" strokeWidth="1" />
                  <line x1={55} x2={420} y1={y} y2={y} className="stroke-border" strokeWidth="1" />
                  <text x={x} y={322} textAnchor="middle" className="fill-muted-foreground text-[11px]">{Math.round(tick * 100)}%</text>
                  <text x={45} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{Math.round(tick * 100)}%</text>
                </g>
              );
            })}
            <line x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(1)} y2={scaleY(1)} className="stroke-muted-foreground" strokeWidth="2" strokeDasharray="6 6" />
            {active.bins.filter((bin) => bin.count > 0 && bin.meanPredicted != null && bin.actualFrequency != null).map((bin) => (
              <circle
                key={bin.bin}
                cx={scaleX(bin.meanPredicted!)}
                cy={scaleY(bin.actualFrequency!)}
                r={Math.min(15, 4 + Math.sqrt(bin.count) * 0.8)}
                className="fill-primary/75 stroke-primary"
                strokeWidth="2"
              >
                <title>{`${pct(bin.meanPredicted!)} previsto · ${pct(bin.actualFrequency!)} observado · n=${bin.count}`}</title>
              </circle>
            ))}
            <text x="238" y="345" textAnchor="middle" className="fill-muted-foreground text-xs">Probabilidad predicha</text>
            <text x="14" y="160" textAnchor="middle" transform="rotate(-90 14 160)" className="fill-muted-foreground text-xs">Frecuencia observada</text>
          </svg>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Error de calibración (ECE)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{pct(active.expectedCalibrationError)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Menor es mejor. Resume la distancia ponderada respecto de la diagonal.</p>
          </div>
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Un punto sobre la diagonal significa que, cuando el modelo dijo 40%, el evento ocurrió aproximadamente 40% de las veces.
          </div>
        </div>
      </div>
    </div>
  );
}

function scaleX(value: number): number { return 55 + value * 365; }
function scaleY(value: number): number { return 300 - value * 280; }
