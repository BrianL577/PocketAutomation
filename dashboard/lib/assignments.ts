import { kv } from "@vercel/kv";

const KEY = "assignments";

/** Manual recipient overrides per recording id. Only present once a user has
 * explicitly edited a panel's recipient chips - otherwise recipients are
 * derived automatically from the recording's tags (see tagRecipients.ts).
 */
export async function getAssignments(): Promise<Record<string, string[]>> {
  const raw = await kv.hgetall<Record<string, string[]>>(KEY);
  return raw ?? {};
}

export async function setAssignment(meetingId: string, emails: string[]): Promise<void> {
  await kv.hset(KEY, { [meetingId]: emails });
}
