import nodemailer from "nodemailer";
import { getMeetingsSince, type Meeting } from "./pocket";
import { getAssignments } from "./assignments";
import { getSendEnabled, setSendEnabled } from "./sendEnabled";
import { getTagRecipients, recipientsForTags } from "./tagRecipients";

function buildEmailBody(m: Meeting): string {
  const actionItemsText = m.actionItems.length
    ? m.actionItems
        .map((a) => `- [${a.priority ?? "n/a"}] ${a.label}${a.dueDate ? ` (due ${a.dueDate})` : ""}`)
        .join("\n")
    : "None";

  return `## ${m.title}\n\n${m.summaryMarkdown}\n\n### Action Items\n${actionItemsText}`;
}

export interface SendResult {
  sent: string[];
  skipped: string[];
}

/** Sends one digest email per recording to whichever recipients are
 * currently assigned (manual override, falling back to tag-based routing).
 * Recordings with no recipients, or explicitly toggled off, are skipped.
 * Anything successfully sent gets its "included" toggle flipped off
 * afterward, so the next send (manual or the 5am cron) doesn't re-send the
 * same recording unless a person manually re-checks it.
 */
export async function sendAssignedDigests(): Promise<SendResult> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  since.setHours(0, 0, 0, 0);

  const [meetings, assignments, sendEnabled, tagRecipients] = await Promise.all([
    getMeetingsSince(since.toISOString()),
    getAssignments(),
    getSendEnabled(),
    getTagRecipients(),
  ]);

  const gmailAddress = process.env.GMAIL_ADDRESS;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailAddress || !gmailAppPassword) {
    throw new Error("Gmail credentials not configured");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailAddress, pass: gmailAppPassword },
  });

  const sent: string[] = [];
  const skipped: string[] = [];

  for (const meeting of meetings) {
    if (sendEnabled[meeting.id] === false) {
      skipped.push(meeting.id);
      continue;
    }

    const recipients = assignments[meeting.id] ?? recipientsForTags(meeting.tags, tagRecipients);
    if (recipients.length === 0) {
      skipped.push(meeting.id);
      continue;
    }

    await transporter.sendMail({
      from: gmailAddress,
      to: recipients.join(", "),
      subject: `Meeting Summary: ${meeting.title}`,
      text: buildEmailBody(meeting),
    });
    sent.push(meeting.id);
  }

  await Promise.all(sent.map((id) => setSendEnabled(id, false)));

  return { sent, skipped };
}
