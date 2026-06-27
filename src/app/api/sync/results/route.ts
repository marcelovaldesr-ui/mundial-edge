import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/data/sync";
import { isAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const result = await runJob("results");
  const status = result.status === "success" ? 200 : 500;
  return NextResponse.json(result, { status });
}

// Permite disparo manual por GET desde el panel admin/Vercel Cron.
export async function GET(req: NextRequest) {
  return POST(req);
}
