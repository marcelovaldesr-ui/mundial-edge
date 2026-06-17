import { NextRequest, NextResponse } from "next/server";
import { runAll, runJob, type SyncJob } from "@/lib/data/sync";
import { isAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOBS: SyncJob[] = ["fixtures", "results", "odds", "predictions"];

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const job = new URL(req.url).searchParams.get("job") as SyncJob | null;
  if (job && JOBS.includes(job)) {
    return NextResponse.json({ ran: [await runJob(job)] });
  }
  const results = await runAll();
  const ok = results.every((r) => r.status === "success");
  return NextResponse.json({ ran: results }, { status: ok ? 200 : 207 });
}
