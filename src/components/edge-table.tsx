"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Edge } from "@/lib/types";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RiskBadge } from "./risk-badge";
import { marketLabel, outcomeLabel } from "./outcome-label";
import { pct, fmtEv } from "@/lib/utils";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { signalBadgesForEdge } from "@/lib/markets/signal-badges";
import { CopyButton } from "@/components/copy-button";

type SortKey = "expected_value" | "edge" | "model_probability" | "decimal_odds" | "final_probability";

export function EdgeTable({ edges, showMatch = true }: { edges: Edge[]; showMatch?: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>("expected_value");
  const [asc, setAsc] = useState(false);
  const [onlyValue, setOnlyValue] = useState(false);

  const rows = useMemo(() => {
    let r = [...edges];
    if (onlyValue) r = r.filter((e) => e.qualifies);
    r.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      return asc ? av - bv : bv - av;
    });
    return r;
  }, [edges, sortKey, asc, onlyValue]);

  const sortBtn = (key: SortKey, label: string) => (
    <button
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => {
        if (sortKey === key) setAsc(!asc);
        else { setSortKey(key); setAsc(false); }
      }}
    >
      {label} <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={onlyValue} onChange={(e) => setOnlyValue(e.target.checked)} />
        Mostrar solo picks de calidad (filtros de tipster)
      </label>

      <div className="grid gap-3 md:hidden">
        {rows.map((e) => (
          <div key={e.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                {showMatch && (
                  <Link href={`/matches/${e.match_id}`} className="inline-flex items-center gap-1 text-sm font-semibold hover:text-primary">
                    {e.match?.home_team?.code ?? "?"}-{e.match?.away_team?.code ?? "?"}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                <p className="font-medium">{outcomeLabel(e.market, e.outcome, e.match)}</p>
                <p className="text-xs text-muted-foreground">{marketLabel(e.market)} · {e.bookmaker}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold tabular-nums">{e.decimal_odds.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">cuota</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <MobileMetric label="Prob. mercado" value={pct(e.implied_probability)} />
              <MobileMetric label="Prob. final" value={pct(e.final_probability ?? e.model_probability)} />
              <MobileMetric label="EV final" value={fmtEv(e.final_expected_value ?? e.expected_value)} accent={(e.final_expected_value ?? e.expected_value) >= 0} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RiskBadge tier={e.final_tier ?? e.tier} />
              {e.qualifies ? <Badge variant="success">Pick calidad</Badge> : <Badge variant="muted">Atípico</Badge>}
              {signalBadgesForEdge(e).map((badge) => (
                <Badge key={badge.label} variant={badge.variant} title={badge.title}>{badge.label}</Badge>
              ))}
              <CopyButton text={edgeToText(e)} label="Copiar pick" />
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded border border-border bg-card px-4 py-8 text-center">
            <p className="font-mono text-xs text-muted-foreground tracking-wide">NO SE ENCONTRARON OPORTUNIDADES CON ESOS FILTROS</p>
          </div>
        )}
      </div>

      <div className="hidden md:block">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            {showMatch && <TableHead>Partido</TableHead>}
            <TableHead>Mercado</TableHead>
            <TableHead>Selección</TableHead>
            <TableHead className="text-right">{sortBtn("decimal_odds", "Cuota")}</TableHead>
            <TableHead className="text-right">Prob. mercado</TableHead>
            <TableHead className="text-right">{sortBtn("model_probability", "Modelo base")}</TableHead>
            <TableHead className="text-right">{sortBtn("final_probability", "Prob. final")}</TableHead>
            <TableHead className="text-right">{sortBtn("edge", "Edge final")}</TableHead>
            <TableHead className="text-right">{sortBtn("expected_value", "EV final")}</TableHead>
            <TableHead>Riesgo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              {showMatch && (
                <TableCell>
                  <Link href={`/matches/${e.match_id}`} className="inline-flex items-center gap-1 hover:text-primary">
                    {e.match?.home_team?.code ?? "?"}–{e.match?.away_team?.code ?? "?"}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </TableCell>
              )}
              <TableCell className="text-muted-foreground">{marketLabel(e.market)}</TableCell>
              <TableCell className="font-medium">{outcomeLabel(e.market, e.outcome, e.match)}</TableCell>
              <TableCell className="text-right tabular-nums">{e.decimal_odds.toFixed(2)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{pct(e.implied_probability)}</TableCell>
              <TableCell className="text-right tabular-nums">{pct(e.model_probability)}</TableCell>
              <TableCell className="text-right tabular-nums">{pct(e.final_probability ?? e.model_probability)}</TableCell>
              <TableCell className={"text-right tabular-nums " + ((e.final_edge ?? e.edge) >= 0 ? "text-success-foreground" : "text-danger-foreground")}>
                {fmtEv(e.final_edge ?? e.edge)}
              </TableCell>
              <TableCell className={"text-right font-semibold tabular-nums " + ((e.final_expected_value ?? e.expected_value) >= 0 ? "text-success-foreground" : "text-danger-foreground")}>
                {fmtEv(e.final_expected_value ?? e.expected_value)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <RiskBadge tier={e.final_tier ?? e.tier} />
                  {e.qualifies === false && (
                    <span
                      title="No pasa los filtros de calidad: cuota fuera de rango o EV atípico (posible error del modelo)."
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                    >
                      atípico
                    </span>
                  )}
                  {signalBadgesForEdge(e).map((badge) => (
                    <Badge key={badge.label} variant={badge.variant} title={badge.title}>{badge.label}</Badge>
                  ))}
                  <CopyButton text={edgeToText(e)} label="Copiar" />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={showMatch ? 10 : 9} className="py-10 text-center">
              <span className="font-mono text-xs tracking-wide text-muted-foreground">NO SE ENCONTRARON OPORTUNIDADES CON ESOS FILTROS</span>
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function edgeToText(e: Edge): string {
  return `${e.match?.home_team?.code ?? "?"}-${e.match?.away_team?.code ?? "?"} · ${marketLabel(e.market)} · ${outcomeLabel(e.market, e.outcome, e.match)} @ ${e.decimal_odds.toFixed(2)} (prob final ${pct(e.final_probability ?? e.model_probability)}, EV ${fmtEv(e.final_expected_value ?? e.expected_value)})`;
}

function sortValue(edge: Edge, key: SortKey): number {
  if (key === "final_probability") return edge.final_probability ?? edge.model_probability;
  if (key === "expected_value") return edge.final_expected_value ?? edge.expected_value;
  if (key === "edge") return edge.final_edge ?? edge.edge;
  return edge[key];
}

function MobileMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md bg-muted/30 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={"font-semibold tabular-nums " + (accent ? "text-success-foreground" : "")}>{value}</p>
    </div>
  );
}
