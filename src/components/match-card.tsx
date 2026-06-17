import Link from "next/link";
import type { Match, Edge } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { RiskBadge } from "./risk-badge";
import { marketLabel, outcomeLabel } from "./outcome-label";
import { fmtKickoff, fmtEv } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { TeamMark } from "@/components/team-mark";
import { Badge } from "@/components/ui/badge";
import { isPreMatchEligible, matchStatusLabel } from "@/lib/matches/pre-match-eligibility";

export function MatchCard({ match, best }: { match: Match; best?: Edge }) {
  const preMatchEligible = isPreMatchEligible(match);
  const showScore = !preMatchEligible && match.home_score != null && match.away_score != null;
  const activeBest = preMatchEligible ? best : undefined;

  return (
    <Link href={`/matches/${match.id}`}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{match.stage}</span>
            <Badge variant={preMatchEligible ? "success" : match.status === "live" ? "warning" : match.status === "finished" ? "muted" : "outline"}>
              {matchStatusLabel(match)}
            </Badge>
            <span>{fmtKickoff(match.kickoff)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <TeamMark team={match.home_team} />
                  {match.home_team?.name}
                </span>
                {showScore && <span className="text-lg font-bold tabular-nums">{match.home_score}</span>}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <TeamMark team={match.away_team} />
                  {match.away_team?.name}
                </span>
                {showScore && <span className="text-lg font-bold tabular-nums">{match.away_score}</span>}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          {!preMatchEligible && (
            <div className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              No elegible para pre-partido.
            </div>
          )}
          {activeBest && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <div className="text-xs text-muted-foreground">
                Mejor oportunidad:{" "}
                <span className="text-foreground">
                  {marketLabel(activeBest.market)} · {outcomeLabel(activeBest.market, activeBest.outcome, match)}
                </span>
                <span className="ml-1 text-muted-foreground">@ {activeBest.decimal_odds.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{fmtEv(activeBest.expected_value)}</span>
                <RiskBadge tier={activeBest.tier} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
