import Link from "next/link";
import type { Match, Edge } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { RiskBadge } from "./risk-badge";
import { marketLabel, outcomeLabel } from "./outcome-label";
import { fmtKickoff, fmtEv } from "@/lib/utils";
import { TeamMark } from "@/components/team-mark";
import { isPreMatchEligible, matchStatusLabel } from "@/lib/matches/pre-match-eligibility";
import type { WorldCupGroupContext } from "@/lib/world-cup";

export function MatchCard({ match, best, groupContext }: { match: Match; best?: Edge; groupContext?: WorldCupGroupContext }) {
  const preMatchEligible = isPreMatchEligible(match);
  const showScore = !preMatchEligible && match.home_score != null && match.away_score != null;
  const activeBest = preMatchEligible ? best : undefined;

  return (
    <Link href={`/matches/${match.id}`}>
      <Card className="group overflow-hidden border-border bg-card transition-colors hover:border-primary/40">
        <CardContent className="p-0">
          {/* Header: stage + status + kickoff */}
          <div className="flex items-center justify-between border-b border-border bg-background/30 px-3 py-2">
            <span className="section-label">{match.stage}</span>
            <div className="flex items-center gap-2">
              {groupContext?.group && (
                <span className="font-mono text-[9px] text-muted-foreground">{groupContext.group}</span>
              )}
              <span className={[
                "font-mono text-[9px] font-medium uppercase tracking-wide",
                preMatchEligible ? "text-success-foreground" :
                match.status === "live" ? "text-warning" :
                match.status === "finished" ? "text-muted-foreground" : "text-muted-foreground",
              ].join(" ")}>
                {matchStatusLabel(match)}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">{fmtKickoff(match.kickoff)}</span>
            </div>
          </div>

          {/* Equipos */}
          <div className="px-3 py-3 space-y-2">
            {([["home", match.home_team, match.home_score], ["away", match.away_team, match.away_score]] as const).map(([side, team, score]) => (
              <div key={side} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <TeamMark team={team} />
                  <span className="truncate">{team?.name}</span>
                </span>
                {showScore && (
                  <span className="font-mono text-xl font-bold tabular-nums">{score}</span>
                )}
              </div>
            ))}
          </div>

          {/* Best edge (si existe) */}
          {activeBest && (
            <div className="border-t border-border px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="section-label">MEJOR OPORTUNIDAD</p>
                <p className="mt-1 truncate text-xs text-foreground">
                  {marketLabel(activeBest.market)} · {outcomeLabel(activeBest.market, activeBest.outcome, match)}
                  <span className="ml-1 font-mono text-muted-foreground">@ {activeBest.decimal_odds.toFixed(2)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-sm font-semibold tabular-nums text-success-foreground">
                  {fmtEv(activeBest.expected_value)}
                </span>
                <RiskBadge tier={activeBest.tier} />
              </div>
            </div>
          )}

          {!preMatchEligible && (
            <div className="border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground">
              Partido no elegible para análisis pre-partido
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
