import type { TopRecommendation } from "@/lib/model/recommendations";
import { marketLabel, outcomeLabel } from "@/components/outcome-label";
import { pct, fmtEv } from "@/lib/utils";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface TopRecommendationsProps {
  recommendations: TopRecommendation[];
}

const MODE_META = {
  realistic: {
    badge: "REALISTA",
    badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    cardClass: "border-amber-500/20",
    headerClass: "text-amber-400",
    desc: "Edge + probabilidad combinados",
  },
  conservative: {
    badge: "CONSERVADOR",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    cardClass: "border-emerald-500/20",
    headerClass: "text-emerald-400",
    desc: "Máxima probabilidad de acierto",
  },
  value: {
    badge: "VALOR",
    badgeClass: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    cardClass: "border-blue-500/20",
    headerClass: "text-blue-400",
    desc: "Mayor edge frente al mercado",
  },
} as const;

export function TopRecommendations({ recommendations }: TopRecommendationsProps) {
  if (!recommendations.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Top picks del día
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {recommendations.map((rec) => {
          const meta = MODE_META[rec.mode];
          const e = rec.edge;
          const prob = e.final_probability ?? e.model_probability;
          const edgeVal = e.final_edge ?? e.edge;
          const ev = e.final_expected_value ?? e.expected_value;

          return (
            <div
              key={rec.mode}
              className={`rounded-lg border bg-card/60 p-4 space-y-3 ${meta.cardClass}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`inline-block rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${meta.badgeClass}`}>
                    {meta.badge}
                  </span>
                  <p className={`mt-1 text-xs text-muted-foreground`}>{meta.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold tabular-nums">{e.decimal_odds.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">cuota</p>
                </div>
              </div>

              <div>
                <Link
                  href={`/matches/${e.match_id}`}
                  className="inline-flex items-center gap-1 font-semibold hover:text-primary text-sm"
                >
                  {e.match?.home_team?.code ?? "?"} — {e.match?.away_team?.code ?? "?"}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </Link>
                <p className="text-sm font-medium mt-0.5">{outcomeLabel(e.market, e.outcome, e.match)}</p>
                <p className="text-xs text-muted-foreground">{marketLabel(e.market)} · {e.bookmaker}</p>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <Metric label="Probabilidad" value={pct(prob)} highlight={prob >= 0.5} />
                <Metric label="Edge" value={fmtEv(edgeVal)} highlight={edgeVal > 0} />
                <Metric label="EV final" value={fmtEv(ev)} highlight={ev > 0} />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                {rec.justification}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded bg-muted/30 p-1.5">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p className={`font-semibold tabular-nums ${highlight ? "text-success-foreground" : ""}`}>{value}</p>
    </div>
  );
}
