import { NextRequest, NextResponse } from "next/server";
import { getEdges, getMatches, getTeamStats } from "@/lib/data/repository";
import {
  buildParlayStatModel,
  buildCandidatePicks,
  edgeToParlayPick,
  generateParlaysWithFallback,
  generateSuggestedParlays,
  type GenerateParlaysOptions,
  type ParlayProfile,
} from "@/lib/parlays";
import { maxParlaysPerRequest, minimumConfidenceFilter, minimumEdgeDefault } from "@/lib/config/runtime";
import { decorateEdgesWithFinalProbability } from "@/lib/model/final-probability";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const riskConfig: Record<string, { profile: ParlayProfile } & Pick<GenerateParlaysOptions, "minEdge" | "minConfidence" | "allowLowConfidence">> = {
  conservative: { profile: "conservative", minEdge: 0.05, minConfidence: "medium", allowLowConfidence: false },
  balanced: { profile: "balanced", minEdge: 0.02, minConfidence: "low", allowLowConfidence: true },
  opportunistic: { profile: "aggressive", minEdge: 0, minConfidence: "low", allowLowConfidence: true },
};

export async function GET(request: NextRequest) {
  const selectedRisk = request.nextUrl.searchParams.get("risk") ?? "balanced";
  const config = riskConfig[selectedRisk] ?? riskConfig.balanced;
  const [edges, matches, teamStats] = await Promise.all([getEdges(), getMatches(), getTeamStats()]);
  const statModel = buildParlayStatModel(matches, teamStats, "recommended");
  const decoratedEdges = decorateEdgesWithFinalProbability(edges, statModel.predictions);
  const picks = buildCandidatePicks(decoratedEdges, statModel.predictions, matches);
  const common = {
    scoreMatricesByMatchId: statModel.scoreMatricesByMatchId,
    predictionMetadata: {
      modelVariantUsed: statModel.modelVariantUsed,
      calibrationUsed: statModel.calibrationUsed,
      configSource: statModel.configSource,
      warnings: statModel.warnings,
    },
  };
  const result = generateParlaysWithFallback(picks, {
    ...common,
    minEdge: minimumEdgeDefault(),
    minConfidence: minimumConfidenceFilter(),
    ...config,
    maxResults: maxParlaysPerRequest(),
  });
  const suggestions = generateSuggestedParlays(picks, common);

  return NextResponse.json({
    risk: selectedRisk in riskConfig ? selectedRisk : "balanced",
    count: result.parlays.length,
    parlays: result.parlays,
    relaxedAlternatives: result.relaxedAlternatives,
    relaxationsApplied: result.relaxationsApplied,
    emptyStateMessage: result.emptyStateMessage,
    suggestions,
    rejectionCounts: Object.fromEntries(countBy(result.rejected.map((row) => row.reason))),
  });
}

function countBy<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}
