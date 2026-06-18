"use client";

import { useMemo, useState } from "react";
import { GroupSimulationCard } from "@/components/group-simulation-card";
import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  selectWorldCup2026Group,
  type WorldCup2026GroupDataStatus,
  type WorldCup2026GroupId,
  type WorldCup2026GroupsUiData,
} from "@/lib/tournament";

export function WorldCupGroupsSimulation({ data }: { data: WorldCup2026GroupsUiData }) {
  const firstGroup = data.groups[0]?.schedule.groupId ?? "A";
  const [selectedId, setSelectedId] = useState<WorldCup2026GroupId>(firstGroup);
  const selected = useMemo(() => selectWorldCup2026Group(data.groups, selectedId), [data.groups, selectedId]);

  if (!selected) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Grupos Mundial 2026</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">No hay grupos disponibles para mostrar.</CardContent>
      </Card>
    );
  }

  const { schedule, simulation } = selected;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Grupos del Mundial 2026">
        {data.groups.map((entry) => {
          const groupId = entry.schedule.groupId;
          const active = groupId === selectedId;
          return (
            <button
              key={groupId}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`world-cup-group-${groupId}`}
              onClick={() => setSelectedId(groupId)}
              className={
                "min-w-10 rounded-md border px-3 py-2 text-sm font-medium transition "
                + (active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
              }
            >
              {groupId}
            </button>
          );
        })}
      </div>

      <section id={`world-cup-group-${schedule.groupId}`} role="tabpanel" className="space-y-4">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">Standings actuales · Grupo {schedule.groupId}</CardTitle>
                  <SourceBadge status={schedule.metadata.dataStatus} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {schedule.playedMatches.length} jugados · {schedule.pendingMatches.length} pendientes
                </p>
              </div>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Fuente y modelo</summary>
                <div className="mt-2 rounded-md border border-border bg-muted/20 p-2">
                  <p>{sourceLabel(schedule.metadata.source)}</p>
                  <p>xg-v2.1-prior8 + platt-blend-25</p>
                </div>
              </details>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Equipo</TableHead>
                  <TableHead className="text-right">PJ</TableHead>
                  <TableHead className="text-right">G</TableHead>
                  <TableHead className="text-right">E</TableHead>
                  <TableHead className="text-right">P</TableHead>
                  <TableHead className="text-right">GF</TableHead>
                  <TableHead className="text-right">GC</TableHead>
                  <TableHead className="text-right">DG</TableHead>
                  <TableHead className="text-right">PTS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.standings.map((standing) => (
                  <TableRow key={standing.teamId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TeamMark team={standing.team} />
                        <span className="font-medium">{standing.team.name}</span>
                      </div>
                    </TableCell>
                    <Stat value={standing.played} />
                    <Stat value={standing.won} />
                    <Stat value={standing.drawn} />
                    <Stat value={standing.lost} />
                    <Stat value={standing.goalsFor} />
                    <Stat value={standing.goalsAgainst} />
                    <Stat value={standing.goalDifference} signed />
                    <Stat value={standing.points} strong />
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {schedule.warnings.length > 0 && (
              <details className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Avisos de datos ({schedule.warnings.length})</summary>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {schedule.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>

        <GroupSimulationCard result={simulation} dataStatus={schedule.metadata.dataStatus} />
      </section>
    </div>
  );
}

function SourceBadge({ status }: { status: WorldCup2026GroupDataStatus }) {
  if (status === "current") return <Badge variant="success">Datos actuales</Badge>;
  if (status === "preview") return <Badge variant="outline">Preview</Badge>;
  return <Badge variant="warning">Demo</Badge>;
}

function Stat({ value, signed, strong }: { value: number; signed?: boolean; strong?: boolean }) {
  const formatted = signed && value > 0 ? `+${value}` : String(value);
  return <TableCell className={`text-right tabular-nums ${strong ? "font-bold text-foreground" : ""}`}>{formatted}</TableCell>;
}

function sourceLabel(source: string): string {
  if (source === "repository-current") return "Fixtures/resultados actuales del repositorio";
  if (source === "repository-plus-local-preview") return "Datos actuales + cruces preview para completar calendario";
  return "Fixture local de respaldo";
}
