// Email is optional, same pattern as lib/ai/client.ts and lib/notifications/sms.ts.
// Without RESEND_API_KEY configured, sendEmail() returns a "not configured"
// result instead of throwing.
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATIONS_FROM_EMAIL);
}

let client: import("resend").Resend | null = null;

async function getResendClient() {
  if (!isEmailConfigured()) {
    throw new Error("Resend is not configured");
  }
  if (!client) {
    const { Resend } = await import("resend");
    client = new Resend(process.env.RESEND_API_KEY!);
  }
  return client;
}

export interface SendEmailResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { sent: false, error: "not_configured" };
  }
  try {
    const resend = await getResendClient();
    const { data, error } = await resend.emails.send({
      to,
      from: process.env.NOTIFICATIONS_FROM_EMAIL!,
      subject,
      html,
    });
    if (error) {
      return { sent: false, error: error.message };
    }
    return { sent: true, providerMessageId: data?.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "unknown_error" };
  }
}
