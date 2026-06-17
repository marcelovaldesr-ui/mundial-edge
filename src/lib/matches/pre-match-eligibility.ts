import type { Edge, Match, MatchStatus } from "../types";

export type NormalizedMatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled"
  | "suspended"
  | "unknown";

type MatchLike = Partial<Match> & {
  kickoffAt?: unknown;
  startTime?: unknown;
  utcDate?: unknown;
  commence_time?: unknown;
};
type EdgeLike = Pick<Edge, "match_id"> & { match?: Match };
type ParlayLike = { picks: Array<{ matchId: string; match?: Match; startsAt?: string; matchStatus?: MatchStatus }> };

const ALLOWED_PRE_MATCH = new Set(["SCHEDULED", "TIMED", "UPCOMING", "PRE_MATCH", "NS", "TBD"]);
const LIVE_STATUSES = new Set(["LIVE", "IN_PLAY", "PAUSED", "1H", "2H", "HT", "ET", "BT", "P", "INT"]);
const FINISHED_STATUSES = new Set(["FINISHED", "FT", "AET", "PEN", "AWARDED", "WALKOVER"]);
const CANCELLED_POSTPONED_STATUSES = new Set(["POSTPONED", "CANCELLED", "CANCELED", "SUSPENDED"]);

export function getMatchKickoffTime(match: MatchLike | null | undefined): number {
  if (!match) return Number.NaN;
  const raw =
    match.kickoff ??
    match.kickoffAt ??
    match.startTime ??
    match.utcDate ??
    match.commence_time;
  if (typeof raw !== "string" && typeof raw !== "number" && !(raw instanceof Date)) return Number.NaN;
  const time = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

export function normalizeMatchStatus(status: unknown): NormalizedMatchStatus {
  const raw = String(status ?? "").trim().toUpperCase();
  if (!raw) return "unknown";
  if (ALLOWED_PRE_MATCH.has(raw)) return "scheduled";
  if (LIVE_STATUSES.has(raw)) return "live";
  if (FINISHED_STATUSES.has(raw)) return "finished";
  if (CANCELLED_POSTPONED_STATUSES.has(raw)) {
    if (raw === "SUSPENDED") return "suspended";
    if (raw === "CANCELLED" || raw === "CANCELED") return "cancelled";
    return "postponed";
  }
  if (raw === "LIVE") return "live";
  if (raw === "FINISHED") return "finished";
  if (raw === "POSTPONED") return "postponed";
  return "unknown";
}

export function isFinishedMatch(match: MatchLike | null | undefined): boolean {
  return normalizeMatchStatus(match?.status) === "finished";
}

export function isLiveMatch(match: MatchLike | null | undefined): boolean {
  return normalizeMatchStatus(match?.status) === "live";
}

export function isCancelledOrPostponedMatch(match: MatchLike | null | undefined): boolean {
  const status = normalizeMatchStatus(match?.status);
  return status === "postponed" || status === "cancelled" || status === "suspended";
}

export function isUpcomingMatch(match: MatchLike | null | undefined, now: Date | string | number = new Date()): boolean {
  const kickoff = getMatchKickoffTime(match);
  const nowMs = normalizeNow(now);
  return Number.isFinite(kickoff) && Number.isFinite(nowMs) && kickoff > nowMs;
}

export function isPreMatchEligible(match: MatchLike | null | undefined, now: Date | string | number = new Date()): boolean {
  if (!match) return false;
  return normalizeMatchStatus(match.status) === "scheduled" && isUpcomingMatch(match, now);
}

export function filterPreMatchMatches<T extends MatchLike>(matches: T[], now: Date | string | number = new Date()): T[] {
  return matches.filter((match) => isPreMatchEligible(match, now));
}

export function filterPreMatchEdges<T extends EdgeLike>(
  edges: T[],
  matches: Array<MatchLike & { id?: string }> = [],
  now: Date | string | number = new Date()
): T[] {
  const matchById = new Map(matches.filter((match) => typeof match.id === "string").map((match) => [match.id as string, match]));
  return edges.filter((edge) => {
    const match = edge.match ?? matchById.get(edge.match_id);
    return isPreMatchEligible(match, now);
  });
}

export function filterPreMatchParlays<T extends ParlayLike>(
  parlays: T[],
  matches: Array<MatchLike & { id?: string }> = [],
  now: Date | string | number = new Date()
): T[] {
  const matchById = new Map(matches.filter((match) => typeof match.id === "string").map((match) => [match.id as string, match]));
  return parlays.filter((parlay) =>
    parlay.picks.every((pick) => {
      const match = pick.match ?? matchById.get(pick.matchId) ?? {
        status: pick.matchStatus,
        kickoff: pick.startsAt,
      };
      return isPreMatchEligible(match, now);
    })
  );
}

export function matchStatusLabel(match: MatchLike | null | undefined): string {
  const status = normalizeMatchStatus(match?.status);
  if (status === "scheduled") return "Próximo";
  if (status === "live") return "En vivo";
  if (status === "finished") return "Finalizado";
  if (status === "postponed") return "Postergado";
  if (status === "cancelled") return "Cancelado";
  if (status === "suspended") return "Suspendido";
  return "Estado desconocido";
}

function normalizeNow(now: Date | string | number): number {
  if (now instanceof Date) return now.getTime();
  if (typeof now === "number") return now;
  return new Date(now).getTime();
}
