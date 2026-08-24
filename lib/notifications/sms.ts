// SMS is optional, same pattern as lib/ai/client.ts. Without Twilio env vars
// configured, sendSms() returns a "not configured" result instead of
// throwing — callers log that outcome to NotificationLog and move on; no
// NexaMove workflow ever blocks on a message actually going out.
export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
  );
}

let client: import("twilio").Twilio | null = null;

async function getTwilioClient() {
  if (!isSmsConfigured()) {
    throw new Error("Twilio is not configured");
  }
  if (!client) {
    const { default: Twilio } = await import("twilio");
    client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  }
  return client;
}

export interface SendSmsResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  if (!isSmsConfigured()) {
    return { sent: false, error: "not_configured" };
  }
  try {
    const twilio = await getTwilioClient();
    const message = await twilio.messages.create({
      to,
      from: process.env.TWILIO_FROM_NUMBER!,
      body,
    });
    return { sent: true, providerMessageId: message.sid };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "unknown_error" };
  }
}
