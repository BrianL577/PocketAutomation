import { kv } from "@vercel/kv";
import { getAssignments, setAssignment } from "./assignments";
import { getTagRecipients, setTagRecipients } from "./tagRecipients";

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

  const [assignments, tagRecipients] = await Promise.all([getAssignments(), getTagRecipients()]);
  await Promise.all([
    ...Object.entries(assignments)
      .filter(([, emails]) => emails.includes(normalized))
      .map(([meetingId, emails]) => setAssignment(meetingId, emails.filter((e) => e !== normalized))),
    ...Object.entries(tagRecipients)
      .filter(([, emails]) => emails.includes(normalized))
      .map(([tag, emails]) => setTagRecipients(tag, emails.filter((e) => e !== normalized))),
  ]);
}
