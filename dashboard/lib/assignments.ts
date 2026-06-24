import { kv } from "@vercel/kv";

const KEY = "assignments";

/** Maps a meeting series' context key to the list of emails assigned to it. */
export async function getAssignments(): Promise<Record<string, string[]>> {
  const raw = await kv.hgetall<Record<string, string[]>>(KEY);
  return raw ?? {};
}

export async function setAssignment(contextKey: string, emails: string[]): Promise<void> {
  await kv.hset(KEY, { [contextKey]: emails });
}
