import { kv } from "@vercel/kv";

const KEY = "tagRecipients";

/** Maps a Pocket tag name (e.g. "wsd", "financial") to the list of emails
 * that should automatically receive any recording carrying that tag.
 */
export async function getTagRecipients(): Promise<Record<string, string[]>> {
  const raw = await kv.hgetall<Record<string, string[]>>(KEY);
  return raw ?? {};
}

export async function setTagRecipients(tag: string, emails: string[]): Promise<void> {
  await kv.hset(KEY, { [tag]: emails });
}

/** Recipients implied by a recording's tags - the union across all of them. */
export function recipientsForTags(tags: string[], tagRecipients: Record<string, string[]>): string[] {
  const set = new Set<string>();
  for (const tag of tags) {
    for (const email of tagRecipients[tag] ?? []) set.add(email);
  }
  return Array.from(set);
}
