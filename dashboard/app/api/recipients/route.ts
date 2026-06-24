import { NextResponse } from "next/server";
import { listRecipients, addRecipient, removeRecipient } from "../../../lib/recipients";

export async function GET() {
  const recipients = await listRecipients();
  return NextResponse.json({ recipients });
}

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  await addRecipient(email);
  const recipients = await listRecipients();
  return NextResponse.json({ recipients });
}

export async function DELETE(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  await removeRecipient(email);
  const recipients = await listRecipients();
  return NextResponse.json({ recipients });
}
