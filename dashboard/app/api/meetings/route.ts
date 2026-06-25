import { NextResponse } from "next/server";
import { getMeetingsSince } from "../../../lib/pocket";
import { pruneStaleMeetingState } from "../../../lib/cleanup";

export const maxDuration = 60;

export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  since.setHours(0, 0, 0, 0);

  try {
    const meetings = await getMeetingsSince(since.toISOString());
    await pruneStaleMeetingState(meetings.map((m) => m.id));
    return NextResponse.json({ meetings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
