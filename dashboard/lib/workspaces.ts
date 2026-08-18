import { kv } from "@vercel/kv";

const KEY = "workspaces";

export interface MeetingWorkspace {
  id: string;
  name: string;
}

/** The Recap workspace a meeting's digest/entry should be filed under.
 * Picked per recording from the live workspace dropdown - there is no
 * automatic assignment.
 */
export async function getWorkspaces(): Promise<Record<string, MeetingWorkspace>> {
  const raw = await kv.hgetall<Record<string, MeetingWorkspace>>(KEY);
  return raw ?? {};
}

export async function setWorkspace(meetingId: string, workspace: MeetingWorkspace): Promise<void> {
  await kv.hset(KEY, { [meetingId]: workspace });
}
