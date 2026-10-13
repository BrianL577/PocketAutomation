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

const SENT_KEY = "sentAt";

/** Durable record of which recordings have already gone out (id -> ISO time).
 * The "included" toggle alone can't answer "was this already sent?": it
 * defaults to true for anything missing from KV, so if that flag was ever
 * lost, cleared by a bulk "select all", or never written because a run died
 * midway, an already-delivered meeting looked brand new and went out again.
 * Sending skips anything in here, and only an explicit per-meeting re-check
 * (clearSent) lets it be sent again.
 */
export async function getSent(): Promise<Record<string, string>> {
  const raw = await kv.hgetall<Record<string, string>>(SENT_KEY);
  return raw ?? {};
}

export async function markSent(meetingId: string): Promise<void> {
  await kv.hset(SENT_KEY, { [meetingId]: new Date().toISOString() });
}

export async function clearSent(meetingId: string): Promise<void> {
  await kv.hdel(SENT_KEY, meetingId);
}

export async function setSendEnabled(meetingId: string, enabled: boolean): Promise<void> {
  await kv.hset(KEY, { [meetingId]: enabled });
}
