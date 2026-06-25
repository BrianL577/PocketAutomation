import { kv } from "@vercel/kv";

const KEY = "sendEnabled";

/** Whether a recording should be included the next time someone sends
 * (manually or via the daily cron). Defaults to true for any recording that
 * hasn't been explicitly toggled, so newly-seen recordings are included by
 * default. Flipped to false automatically right after a successful send, so
 * the same recording isn't re-sent until a person manually re-checks it.
 */
export async function getSendEnabled(): Promise<Record<string, boolean>> {
  const raw = await kv.hgetall<Record<string, boolean>>(KEY);
  return raw ?? {};
}

export async function setSendEnabled(meetingId: string, enabled: boolean): Promise<void> {
  await kv.hset(KEY, { [meetingId]: enabled });
}
