import { kv } from "@vercel/kv";
import { getAssignments, setAssignment } from "./assignments";

const KEY = "recipients";

export async function listRecipients(): Promise<string[]> {
  const members = await kv.smembers(KEY);
  return (members as string[]).sort();
}

export async function addRecipient(email: string): Promise<void> {
  await kv.sadd(KEY, email.trim().toLowerCase());
}

export async function removeRecipient(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await kv.srem(KEY, normalized);

  const assignments = await getAssignments();
  await Promise.all(
    Object.entries(assignments)
      .filter(([, emails]) => emails.includes(normalized))
      .map(([contextKey, emails]) => setAssignment(contextKey, emails.filter((e) => e !== normalized)))
  );
}
