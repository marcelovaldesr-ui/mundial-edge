import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorldCupGroupContext } from "@/lib/world-cup";
import { phaseLabel } from "@/lib/world-cup";

export function WorldCupContextCard({
  context,
  compact = false,
}: {
  context: WorldCupGroupContext;
  compact?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Contexto Mundial 2026</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{phaseLabel(context.phase)}</Badge>
            {context.group && <Badge variant="muted">{context.group}</Badge>}
            {context.groupMatchNumber && <Badge variant="outline">Partido {context.groupMatchNumber} de grupo</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{context.summary}</p>
        {!compact && context.homeStanding && context.awayStanding && (
          <div className="grid gap-2 sm:grid-cols-2">
            <StandingMini standing={context.homeStanding} />
            <StandingMini standing={context.awayStanding} />
          </div>
        )}
        {context.warnings.slice(0, compact ? 1 : 3).map((warning) => (
          <p key={warning} className="text-xs text-warning">{warning}</p>
        ))}
      </CardContent>
    </Card>
  );
}

function StandingMini({ standing }: { standing: NonNullable<WorldCupGroupContext["homeStanding"]> }) {
  return (
    <div className="rounded-md bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{standing.team?.code ?? standing.teamId}</p>
        <Badge variant="outline">#{standing.position}</Badge>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
        <Stat label="Pts" value={standing.points} />
        <Stat label="PJ" value={standing.played} />
        <Stat label="DG" value={standing.goalDifference} />
        <Stat label="Rest." value={standing.remainingMatches} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p>{label}</p>
      <p className="font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
