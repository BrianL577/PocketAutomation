import nodemailer from "nodemailer";
import { getMeetingsSince, type Meeting } from "./pocket";
import { getAssignments } from "./assignments";
import { getSendEnabled, setSendEnabled } from "./sendEnabled";
import { getWorkspaces } from "./workspaces";
import { pushRecapEntry, RecapNotConfiguredError } from "./recap";

function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/\n{2,}/g, "</p><p>")
    .trim();
}

function buildEmailHtml(m: Meeting, workspaceNames: string[]): string {
  const actionItemsHtml = m.actionItems.length
    ? "<ul>" +
      m.actionItems
        .map((a) => {
          const priority = a.priority ? `<strong>[${a.priority}]</strong> ` : "";
          const due = a.dueDate ? ` <em>(due ${a.dueDate})</em>` : "";
          return `<li>${priority}${a.label}${due}</li>`;
        })
        .join("") +
      "</ul>"
    : "<p>None</p>";

  const summaryHtml = markdownToHtml(m.summaryMarkdown);
  const date = new Date(m.createdAt).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const workspaceMeta =
    workspaceNames.length > 0 ? ` &middot; Recap: ${workspaceNames.join(", ")}` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Nunito', Arial, sans-serif; font-size: 15px; color: #111; max-width: 680px; margin: 0 auto; padding: 24px; }
  h1, h2, h3, h4 { color: #1a1a1a; margin-top: 24px; }
  h2 { font-size: 22px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; }
  h3 { font-size: 17px; }
  p { line-height: 1.6; }
  ul { padding-left: 20px; line-height: 1.8; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  .section-label { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin-top: 28px; margin-bottom: 8px; }
  .divider { border: none; border-top: 1px solid #e0e0e0; margin: 24px 0; }
</style>
</head>
<body>
  <h2>${m.title}</h2>
  <div class="meta">${date}${workspaceMeta}</div>
  <hr class="divider">
  <div class="section-label">Summary</div>
  <p>${summaryHtml}</p>
  <hr class="divider">
  <div class="section-label">Action Items</div>
  ${actionItemsHtml}
</body>
</html>`;
}

export interface SendResult {
  sent: string[];
  skipped: string[];
  recapPushed: { meetingId: string; workspaceId: string }[];
  recapFailed: { meetingId: string; workspaceId: string; error: string }[];
}

/** Sends one digest email per recording to the recipients a person has
 * manually assigned to it - that's the only requirement to send. Recap
 * workspaces are optional and independent: a meeting with recipients but no
 * workspace still emails fine, it just doesn't sync to Recap. A meeting can
 * also be filed under more than one workspace, each pushed separately.
 * Explicitly toggled-off recordings are skipped - there is no automatic
 * tag-based routing. Anything successfully emailed gets its "included"
 * toggle flipped off afterward, so the next send (manual or the 5am cron)
 * doesn't re-send the same recording unless a person manually re-checks it.
 */
export async function sendAssignedDigests(): Promise<SendResult> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  since.setHours(0, 0, 0, 0);

  const [meetings, assignments, sendEnabled, workspaces] = await Promise.all([
    getMeetingsSince(since.toISOString()),
    getAssignments(),
    getSendEnabled(),
    getWorkspaces(),
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
  const recapPushed: { meetingId: string; workspaceId: string }[] = [];
  const recapFailed: { meetingId: string; workspaceId: string; error: string }[] = [];

  for (const meeting of meetings) {
    if (sendEnabled[meeting.id] === false) {
      skipped.push(meeting.id);
      continue;
    }

    if (!meeting.isProcessingComplete || !meeting.summaryMarkdown) {
      skipped.push(meeting.id);
      continue;
    }

    const recipients = assignments[meeting.id] ?? [];
    if (recipients.length === 0) {
      skipped.push(meeting.id);
      continue;
    }

    const meetingWorkspaces = workspaces[meeting.id] ?? [];

    await transporter.sendMail({
      from: gmailAddress,
      to: recipients.join(", "),
      subject: `Meeting Summary: ${meeting.title}`,
      html: buildEmailHtml(meeting, meetingWorkspaces.map((w) => w.name)),
    });
    sent.push(meeting.id);

    // The email already went out - a Recap hiccup shouldn't be reported as a
    // failed send, just surfaced separately so it can be retried/noticed.
    // No workspace picked is a normal, non-error case - nothing to push.
    for (const workspace of meetingWorkspaces) {
      try {
        await pushRecapEntry(workspace.id, {
          source: "pocket",
          externalId: meeting.id,
          text: meeting.summaryMarkdown,
          title: meeting.title,
          tagNames: meeting.tags,
        });
        recapPushed.push({ meetingId: meeting.id, workspaceId: workspace.id });
      } catch (err: any) {
        if (!(err instanceof RecapNotConfiguredError)) {
          recapFailed.push({ meetingId: meeting.id, workspaceId: workspace.id, error: err.message });
        }
      }
    }
  }

  await Promise.all(sent.map((id) => setSendEnabled(id, false)));

  return { sent, skipped, recapPushed, recapFailed };
}
