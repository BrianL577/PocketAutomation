import { NextResponse } from "next/server";
import { getSendEnabled, setSendEnabled, getSent, clearSent } from "../../../lib/sendEnabled";

export const dynamic = "force-dynamic";

export async function GET() {
  const [sendEnabled, sent] = await Promise.all([getSendEnabled(), getSent()]);
  return NextResponse.json({ sendEnabled, sent });
}

export async function POST(req: Request) {
  const { meetingId, enabled } = await req.json();
  if (!meetingId || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await setSendEnabled(meetingId, enabled);
  // Re-checking a meeting is the one explicit way to say "send this again".
  if (enabled) await clearSent(meetingId);
  const [sendEnabled, sent] = await Promise.all([getSendEnabled(), getSent()]);
  return NextResponse.json({ sendEnabled, sent });
}
