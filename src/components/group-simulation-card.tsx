import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GroupSimulationServiceResult } from "@/lib/tournament";

export function GroupSimulationCard({
  result,
  preview = false,
  dataStatus,
}: {
  result?: GroupSimulationServiceResult | null;
  preview?: boolean;
  dataStatus?: "current" | "preview" | "demo";
}) {
  const isDemo = preview || dataStatus === "demo";
  if (!result || result.standings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Simulación Monte Carlo de grupo</CardTitle>
            {isDemo && <Badge variant="warning">Demo</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aún no hay resultados de simulación disponibles.</p>
        </CardContent>
      </Card>
    );
  }

  const teamsById = new Map(result.teams.map((team) => [team.id, team]));
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">Simulación Grupo {result.groupId}</CardTitle>
              {isDemo && <Badge variant="warning">Demo</Badge>}
              {dataStatus === "preview" && <Badge variant="outline">Preview</Badge>}
              {dataStatus === "current" && <Badge variant="success">Datos actuales</Badge>}
              <Badge variant="outline">Monte Carlo</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatInteger(result.simulations)} simulaciones · probabilidades de posición y clasificación.
            </p>
          </div>
          <div className="flex max-w-xl flex-wrap gap-2">
            <Badge variant="muted">Modelo: {result.modelVariant}</Badge>
            <Badge variant="muted">Calibración: {result.calibration}</Badge>
            <Badge variant={result.modelSelection === "recommended-simulation-default" ? "success" : "outline"}>
              {selectionLabel(result.modelSelection)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isDemo && (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            Fixture ilustrativo aislado. No representa el grupo real ni datos productivos del Mundial 2026.
          </div>
        )}

        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow>
              <TableHead>Equipo</TableHead>
              <TableHead className="text-right">Pts. esp.</TableHead>
              <TableHead className="text-right">Clasifica</TableHead>
              <TableHead className="text-right">Como Top-2</TableHead>
              <TableHead className="text-right">Mejor 3.º</TableHead>
              <TableHead className="text-right">Eliminado</TableHead>
              <TableHead className="text-right">1.º / gana</TableHead>
              <TableHead className="text-right">2.º</TableHead>
              <TableHead className="text-right">3.º</TableHead>
              <TableHead className="text-right">4.º</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.standings.map((standing) => {
              const team = teamsById.get(standing.teamId);
              return (
                <TableRow key={standing.teamId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TeamMark team={team} />
                      <div>
                        <p className="font-medium">{standing.teamName}</p>
                        <p className="text-xs text-muted-foreground">{standing.teamCode}</p>
                      </div>
                    </div>
                  </TableCell>
                  <NumberCell value={standing.expectedPoints.toFixed(2)} />
                  <ProbabilityCell value={standing.probabilityAdvance} emphasized />
                  <ProbabilityCell value={standing.probabilityAdvanceAsTop2} />
                  <ProbabilityCell value={standing.probabilityAdvanceAsThird} />
                  <ProbabilityCell value={standing.probabilityEliminated} />
                  <ProbabilityCell value={standing.probabilityWinGroup} />
                  <ProbabilityCell value={standing.probabilityFinishSecond} />
                  <ProbabilityCell value={standing.probabilityFinishThird} />
                  <ProbabilityCell value={standing.probabilityFinishFourth} />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {result.warnings.length > 0 && (
          <details className="rounded-md border border-border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium text-warning">
              Avisos y limitaciones ({result.warnings.length})
            </summary>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function NumberCell({ value }: { value: string }) {
  return <TableCell className="text-right font-medium tabular-nums">{value}</TableCell>;
}

function ProbabilityCell({ value, emphasized = false }: { value: number; emphasized?: boolean }) {
  return (
    <TableCell className={`text-right tabular-nums ${emphasized ? "font-semibold text-success" : ""}`}>
      {formatPercent(value)}
    </TableCell>
  );
}

function selectionLabel(selection: GroupSimulationServiceResult["modelSelection"]): string {
  return selection === "recommended-simulation-default" ? "Default recomendado simulación" : "Override explícito";
}

function formatPercent(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function formatInteger(value: number): string { return new Intl.NumberFormat("es-CL").format(value); }
