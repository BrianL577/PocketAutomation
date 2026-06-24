import { NextResponse } from "next/server";
import { getSendEnabled, setSendEnabled } from "../../../lib/sendEnabled";

export async function GET() {
  const sendEnabled = await getSendEnabled();
  return NextResponse.json({ sendEnabled });
}

export async function POST(req: Request) {
  const { contextKey, enabled } = await req.json();
  if (!contextKey || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await setSendEnabled(contextKey, enabled);
  const sendEnabled = await getSendEnabled();
  return NextResponse.json({ sendEnabled });
}
