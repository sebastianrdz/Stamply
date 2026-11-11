import { Resend } from "resend";
import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";
import { emailFromAddress } from "@/lib/email/resend";

export const runtime = "nodejs";

/** Resend `email.received` webhook → forward of the received email to NOTIFY_EMAIL. */
export async function POST(req: NextRequest) {
  // Reading received mail needs a full-access key; the app's RESEND_API_KEY is send-only.
  const resend = new Resend(
    requireEnv("RESEND_INBOUND_API_KEY", "inbound email alerts"),
  );
  let event;
  try {
    event = resend.webhooks.verify({
      payload: await req.text(),
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: requireEnv("RESEND_WEBHOOK_SECRET", "inbound email alerts"),
    });
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "email.received") return NextResponse.json({ ok: true });

  // Passthrough forward keeps the original body and attachments.
  const { error } = await resend.emails.receiving.forward({
    emailId: event.data.email_id,
    to: requireEnv("NOTIFY_EMAIL", "inbound email alerts"),
    from: emailFromAddress(),
  });
  // 500 makes Resend retry the webhook.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
