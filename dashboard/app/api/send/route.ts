import { NextResponse } from "next/server";
import { sendAssignedDigests } from "../../../lib/send";

export const maxDuration = 60;

export async function POST() {
  try {
    const result = await sendAssignedDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
