import { kv } from "@vercel/kv";

const KEY = "workspaces";

export interface MeetingWorkspace {
  id: string;
  name: string;
}

/** The Recap workspace(s) a meeting's digest/entry should be filed under.
 * Picked per recording from the live workspace list - optional, and a
 * meeting can go to more than one. There is no automatic assignment.
 */
export async function getWorkspaces(): Promise<Record<string, MeetingWorkspace[]>> {
  const raw = await kv.hgetall<Record<string, MeetingWorkspace[]>>(KEY);
  return raw ?? {};
}

export async function setWorkspaces(meetingId: string, workspaces: MeetingWorkspace[]): Promise<void> {
  await kv.hset(KEY, { [meetingId]: workspaces });
}
