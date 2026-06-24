import { NextResponse } from "next/server";
import { getMeetingsSince } from "../../../lib/pocket";

export const maxDuration = 60;

export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - 1);
  since.setHours(0, 0, 0, 0);

  try {
    const meetings = await getMeetingsSince(since.toISOString());
    return NextResponse.json({ meetings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
