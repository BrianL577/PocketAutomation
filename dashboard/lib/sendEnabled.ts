import { kv } from "@vercel/kv";

const KEY = "sendEnabled";

/** Whether a meeting series should be included the next time someone sends
 * (manually or via the daily cron). Defaults to true for any series that
 * hasn't been explicitly toggled off, so newly-seen meetings are included
 * by default.
 */
export async function getSendEnabled(): Promise<Record<string, boolean>> {
  const raw = await kv.hgetall<Record<string, boolean>>(KEY);
  return raw ?? {};
}

export async function setSendEnabled(contextKey: string, enabled: boolean): Promise<void> {
  await kv.hset(KEY, { [contextKey]: enabled });
}
