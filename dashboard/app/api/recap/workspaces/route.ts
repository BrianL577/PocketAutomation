import { NextResponse } from "next/server";
import { listRecapWorkspaces, RecapNotConfiguredError } from "../../../../lib/recap";

export const revalidate = 30;

export async function GET() {
  try {
    const workspaces = await listRecapWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (err: any) {
    if (err instanceof RecapNotConfiguredError) {
      return NextResponse.json({ workspaces: [], configured: false });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
