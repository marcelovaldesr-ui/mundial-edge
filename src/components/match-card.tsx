import Link from "next/link";
import type { Match, Edge } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { RiskBadge } from "./risk-badge";
import { marketLabel, outcomeLabel } from "./outcome-label";
import { fmtKickoff, fmtEv } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export function MatchCard({ match, best }: { match: Match; best?: Edge }) {
  return (
    <Link href={`/matches/${match.id}`}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{match.stage}</span>
            <span>{fmtKickoff(match.kickoff)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
              <span className="flex items-center gap-2">
                <span className="text-lg">{match.home_team?.flag}</span>
                {match.home_team?.name}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-lg">{match.away_team?.flag}</span>
                {match.away_team?.name}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          {best && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <div className="text-xs text-muted-foreground">
                Mejor oportunidad:{" "}
                <span className="text-foreground">
                  {marketLabel(best.market)} · {outcomeLabel(best.market, best.outcome, match)}
                </span>
                <span className="ml-1 text-muted-foreground">@ {best.decimal_odds.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{fmtEv(best.expected_value)}</span>
                <RiskBadge tier={best.tier} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
