export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    publicKey: process.env.DISCORD_PUBLIC_KEY?.slice(0, 8) ?? "MISSING",
    appId: process.env.DISCORD_APP_ID?.slice(0, 8) ?? "MISSING",
  });
}