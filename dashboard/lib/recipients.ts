import { kv } from "@vercel/kv";

const KEY = "recipients";

export async function listRecipients(): Promise<string[]> {
  const members = await kv.smembers(KEY);
  return (members as string[]).sort();
}

export async function addRecipient(email: string): Promise<void> {
  await kv.sadd(KEY, email.trim().toLowerCase());
}

export async function removeRecipient(email: string): Promise<void> {
  await kv.srem(KEY, email.trim().toLowerCase());
}
