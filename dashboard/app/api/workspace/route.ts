import { NextResponse } from "next/server";
import { getWorkspaces, setWorkspace } from "../../../lib/workspaces";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaces = await getWorkspaces();
  return NextResponse.json({ workspaces });
}

export async function POST(req: Request) {
  const { meetingId, workspaceId, workspaceName } = await req.json();
  if (!meetingId || typeof workspaceId !== "string" || typeof workspaceName !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await setWorkspace(meetingId, { id: workspaceId, name: workspaceName });
  const workspaces = await getWorkspaces();
  return NextResponse.json({ workspaces });
}
