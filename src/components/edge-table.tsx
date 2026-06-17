"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Edge } from "@/lib/types";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RiskBadge } from "./risk-badge";
import { marketLabel, outcomeLabel } from "./outcome-label";
import { pct, fmtEv } from "@/lib/utils";
import { ArrowUpDown, ExternalLink } from "lucide-react";

type SortKey = "expected_value" | "edge" | "model_probability" | "decimal_odds";

export function EdgeTable({ edges, showMatch = true }: { edges: Edge[]; showMatch?: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>("expected_value");
  const [asc, setAsc] = useState(false);
  const [onlyValue, setOnlyValue] = useState(false);

  const rows = useMemo(() => {
    let r = [...edges];
    if (onlyValue) r = r.filter((e) => e.expected_value >= 0.03);
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
        Mostrar solo apuestas con valor (EV ≥ 3%)
      </label>
      <Table>
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
              <TableCell><RiskBadge tier={e.tier} /></TableCell>
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
  );
}
