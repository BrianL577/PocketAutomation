import nodemailer from "nodemailer";
import { getMeetingsSince, type Meeting } from "./pocket";
import { getAssignments } from "./assignments";
import { getSendEnabled, setSendEnabled } from "./sendEnabled";
import { getWorkspaces } from "./workspaces";
import { pushRecapEntry, RecapNotConfiguredError } from "./recap";
import { markdownToHtml } from "./markdown";

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
  h1 { font-size: 26px; }
  h2 { font-size: 22px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; }
  h3 { font-size: 17px; }
  h4 { font-size: 16px; }
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
  ${summaryHtml}
  <hr class="divider">
  <div class="section-label">Action Items</div>
  ${actionItemsHtml}
</body>
</html>`;
}

/** Recap entries get a "YY.MM.DD: Pocket Summary." line ahead of the actual
 * summary text, dated to when the meeting happened (not when it's pushed).
 */
function recapEntryText(m: Meeting): string {
  const d = new Date(m.createdAt);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}: Pocket Summary.\n\n${m.summaryMarkdown}`;
}

export interface SendResult {
  sent: string[];
  skipped: string[];
  recapPushed: { meetingId: string; workspaceId: string }[];
  recapFailed: { meetingId: string; workspaceId: string; error: string }[];
}

/** Delivers each meeting to whichever destination(s) a person has set up
 * for it - email recipients, Recap workspaces, or both. Either alone is
 * enough to act on; a meeting with only a workspace picked (no recipients)
 * still pushes to Recap and gets unchecked, and vice versa. A meeting with
 * neither, or explicitly toggled off, is skipped - there is no automatic
 * tag-based routing. A meeting only gets its "included" toggle flipped off
 * once something about it actually succeeded (an email sent, or at least
 * one Recap push), so a Recap-only meeting whose push fails stays checked
 * for the next attempt instead of silently disappearing.
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

  const sent: string[] = [];
  const skipped: string[] = [];
  const recapPushed: { meetingId: string; workspaceId: string }[] = [];
  const recapFailed: { meetingId: string; workspaceId: string; error: string }[] = [];
  const handled = new Set<string>();

  let transporter: nodemailer.Transporter | null = null;

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
    const meetingWorkspaces = workspaces[meeting.id] ?? [];

    if (recipients.length === 0 && meetingWorkspaces.length === 0) {
      skipped.push(meeting.id);
      continue;
    }

    if (recipients.length > 0) {
      if (!gmailAddress || !gmailAppPassword) {
        throw new Error("Gmail credentials not configured");
      }
      transporter ??= nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailAddress, pass: gmailAppPassword },
      });

      await transporter.sendMail({
        from: gmailAddress,
        to: recipients.join(", "),
        subject: `Meeting Summary: ${meeting.title}`,
        html: buildEmailHtml(meeting, meetingWorkspaces.map((w) => w.name)),
      });
      sent.push(meeting.id);
      handled.add(meeting.id);
    }

    // The email (if any) already went out - a Recap hiccup shouldn't be
    // reported as a failed send, just surfaced separately so it can be
    // retried/noticed. No workspace picked is a normal, non-error case.
    for (const workspace of meetingWorkspaces) {
      try {
        await pushRecapEntry(workspace.id, {
          source: "pocket",
          externalId: meeting.id,
          text: recapEntryText(meeting),
          title: meeting.title,
          tagNames: meeting.tags,
        });
        recapPushed.push({ meetingId: meeting.id, workspaceId: workspace.id });
        handled.add(meeting.id);
      } catch (err: any) {
        if (!(err instanceof RecapNotConfiguredError)) {
          recapFailed.push({ meetingId: meeting.id, workspaceId: workspace.id, error: err.message });
        }
      }
    }
  }

  await Promise.all(Array.from(handled).map((id) => setSendEnabled(id, false)));

  return { sent, skipped, recapPushed, recapFailed };
}
