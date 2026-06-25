import { NextResponse } from "next/server";
import { getAssignments, setAssignment } from "../../../lib/assignments";

export async function GET() {
  const assignments = await getAssignments();
  return NextResponse.json({ assignments });
}

export async function POST(req: Request) {
  const { meetingId, emails } = await req.json();
  if (!meetingId || !Array.isArray(emails)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await setAssignment(meetingId, emails);
  const assignments = await getAssignments();
  return NextResponse.json({ assignments });
}
