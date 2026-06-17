import { NextRequest } from "next/server";

/**
 * Valida el secreto de sincronización.
 * Acepta: header "Authorization: Bearer <CRON_SECRET>",
 *         header "x-cron-secret", o query ?secret=.
 * Vercel Cron envía automáticamente "Authorization: Bearer $CRON_SECRET".
 * En modo mock sin CRON_SECRET configurado, se permite (solo dev/demo).
 */
export function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  const querySecret = new URL(req.url).searchParams.get("secret");
  return (
    auth === `Bearer ${secret}` ||
    headerSecret === secret ||
    querySecret === secret
  );
}
