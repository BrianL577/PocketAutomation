import nodemailer from "nodemailer";
import { getMeetingsSince, type Meeting } from "./pocket";
import { getAssignments } from "./assignments";

function buildEmailBody(meetings: Meeting[]): string {
  return meetings
    .map((m) => {
      const actionItemsText = m.actionItems.length
        ? m.actionItems
            .map((a) => `- [${a.priority ?? "n/a"}] ${a.label}${a.dueDate ? ` (due ${a.dueDate})` : ""}`)
            .join("\n")
        : "None";

      return `## ${m.title}\n\n${m.summaryMarkdown}\n\n### Action Items\n${actionItemsText}`;
    })
    .join("\n\n---\n\n");
}

export interface SendResult {
  sent: string[];
  skipped: string[];
}

/** Sends one digest email per meeting series (context key) to whichever
 * recipients are currently assigned to that series. Series with no
 * assigned recipients are skipped, not sent to nobody.
 */
export async function sendAssignedDigests(): Promise<SendResult> {
  const since = new Date();
  since.setDate(since.getDate() - 1);
  since.setHours(0, 0, 0, 0);

  const [meetings, assignments] = await Promise.all([
    getMeetingsSince(since.toISOString()),
    getAssignments(),
  ]);

  const grouped = new Map<string, Meeting[]>();
  for (const m of meetings) {
    if (!grouped.has(m.contextKey)) grouped.set(m.contextKey, []);
    grouped.get(m.contextKey)!.push(m);
  }

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

  for (const [contextKey, group] of grouped) {
    const recipients = assignments[contextKey] ?? [];
    if (recipients.length === 0) {
      skipped.push(contextKey);
      continue;
    }

    const subject =
      group.length === 1 ? `Meeting Summary: ${group[0].title}` : `Meeting Summaries: ${contextKey}`;

    await transporter.sendMail({
      from: gmailAddress,
      to: recipients.join(", "),
      subject,
      text: buildEmailBody(group),
    });
    sent.push(contextKey);
  }

  return { sent, skipped };
}
