import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type { Meeting } from "../../../lib/pocket";

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

export async function POST(req: Request) {
  const { meetings, recipients } = (await req.json()) as {
    meetings: Meeting[];
    recipients: string[];
  };

  if (!meetings?.length) {
    return NextResponse.json({ error: "No meetings selected" }, { status: 400 });
  }
  if (!recipients?.length) {
    return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
  }

  const gmailAddress = process.env.GMAIL_ADDRESS;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailAddress || !gmailAppPassword) {
    return NextResponse.json({ error: "Gmail credentials not configured" }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailAddress, pass: gmailAppPassword },
  });

  const subject =
    meetings.length === 1
      ? `Meeting Summary: ${meetings[0].title}`
      : `Meeting Summaries: ${meetings.length} meetings`;

  try {
    await transporter.sendMail({
      from: gmailAddress,
      to: recipients.join(", "),
      subject,
      text: buildEmailBody(meetings),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
