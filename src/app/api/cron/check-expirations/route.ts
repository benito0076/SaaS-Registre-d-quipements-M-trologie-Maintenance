import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { appUrl, getEmailSender } from "@/lib/email";
import { runExpirationCheck } from "@/server/alert-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Déclenché chaque jour à 06:00 UTC (vercel.json). Vercel Cron envoie
 * « Authorization: Bearer $CRON_SECRET » ; tout autre appelant reçoit 401.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runExpirationCheck({ sender: getEmailSender(), appUrl: appUrl() });
    return NextResponse.json(summary, { status: summary.status === "success" ? 200 : 207 });
  } catch (e) {
    console.error("[cron] check-expirations a échoué", e);
    return NextResponse.json({ error: "Cron execution failed" }, { status: 500 });
  }
}
