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

type SortKey = "expected_value" | "edge" | "model_probability" | "decimal_odds";

export function EdgeTable({ edges, showMatch = true }: { edges: Edge[]; showMatch?: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>("expected_value");
  const [asc, setAsc] = useState(false);
  const [onlyValue, setOnlyValue] = useState(false);

  const rows = useMemo(() => {
    let r = [...edges];
    if (onlyValue) r = r.filter((e) => e.qualifies);
    r.sort((a, b) => (asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
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
              <MobileMetric label="Modelo" value={pct(e.model_probability)} />
              <MobileMetric label="Edge" value={fmtEv(e.edge)} accent={e.edge >= 0} />
              <MobileMetric label="EV" value={fmtEv(e.expected_value)} accent={e.expected_value >= 0} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RiskBadge tier={e.tier} />
              {e.qualifies ? <Badge variant="success">Pick calidad</Badge> : <Badge variant="muted">Atípico</Badge>}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Sin selecciones para los filtros actuales.
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
            <TableHead className="text-right">Impl.</TableHead>
            <TableHead className="text-right">{sortBtn("model_probability", "Modelo")}</TableHead>
            <TableHead className="text-right">{sortBtn("edge", "Edge")}</TableHead>
            <TableHead className="text-right">{sortBtn("expected_value", "EV")}</TableHead>
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
              <TableCell className={"text-right tabular-nums " + (e.edge >= 0 ? "text-success" : "text-danger")}>
                {fmtEv(e.edge)}
              </TableCell>
              <TableCell className={"text-right font-semibold tabular-nums " + (e.expected_value >= 0 ? "text-success" : "text-danger")}>
                {fmtEv(e.expected_value)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <RiskBadge tier={e.tier} />
                  {e.qualifies === false && (
                    <span
                      title="No pasa los filtros de calidad: cuota fuera de rango o EV atípico (posible error del modelo)."
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                    >
                      atípico
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={showMatch ? 9 : 8} className="py-8 text-center text-muted-foreground">
              Sin selecciones para los filtros actuales.
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function MobileMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md bg-muted/30 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={"font-semibold tabular-nums " + (accent ? "text-success" : "")}>{value}</p>
    </div>
  );
}
