import { kv } from "@vercel/kv";

const KEY = "workspaces";

/** The Recap workspace a meeting's digest should be filed under. Manually
 * typed per recording - there is no automatic assignment.
 */
export async function getWorkspaces(): Promise<Record<string, string>> {
  const raw = await kv.hgetall<Record<string, string>>(KEY);
  return raw ?? {};
}

export async function setWorkspace(meetingId: string, workspace: string): Promise<void> {
  await kv.hset(KEY, { [meetingId]: workspace });
}
