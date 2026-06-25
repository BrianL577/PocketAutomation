import { NextResponse } from "next/server";
import { getTagRecipients, setTagRecipients } from "../../../lib/tagRecipients";

export async function GET() {
  const tagRecipients = await getTagRecipients();
  return NextResponse.json({ tagRecipients });
}

export async function POST(req: Request) {
  const { tag, emails } = await req.json();
  if (!tag || !Array.isArray(emails)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await setTagRecipients(tag, emails);
  const tagRecipients = await getTagRecipients();
  return NextResponse.json({ tagRecipients });
}
