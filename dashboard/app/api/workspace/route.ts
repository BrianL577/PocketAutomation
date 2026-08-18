import { NextResponse } from "next/server";
import { getWorkspaces, setWorkspaces } from "../../../lib/workspaces";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaces = await getWorkspaces();
  return NextResponse.json({ workspaces });
}

export async function POST(req: Request) {
  const { meetingId, workspaces: meetingWorkspaces } = await req.json();
  if (
    !meetingId ||
    !Array.isArray(meetingWorkspaces) ||
    !meetingWorkspaces.every((w) => w && typeof w.id === "string" && typeof w.name === "string")
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await setWorkspaces(meetingId, meetingWorkspaces);
  const workspaces = await getWorkspaces();
  return NextResponse.json({ workspaces });
}
