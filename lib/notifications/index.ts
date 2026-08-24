import { prisma } from "@/lib/prisma";
import { sendSms, isSmsConfigured } from "@/lib/notifications/sms";
import { sendEmail, isEmailConfigured } from "@/lib/notifications/email";

export type CustomerNotificationType =
  | "TRACKING_LINK"
  | "DELIVERY_CONFIRMATION"
  | "DELIVERY_FAILED";

interface SendCustomerNotificationParams {
  deliveryId: string;
  notificationType: CustomerNotificationType;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  smsBody: string;
  emailSubject: string;
  emailHtml: string;
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export function trackingUrl(trackingCode: string): string {
  return `${baseUrl()}/track/${trackingCode}`;
}

// Best-effort, never throws and never blocks the caller's workflow: a
// delivery event (route started, POD captured, failure logged) must always
// succeed and commit regardless of whether a text/email actually goes out.
// Every attempt — sent, failed, or skipped because no provider is
// configured — is recorded on NotificationLog so operations can see what
// customers were actually told, same spirit as the OpenAI/Maps graceful
// degradation already used elsewhere in this app.
export async function sendCustomerNotification(params: SendCustomerNotificationParams): Promise<void> {
  const attempts: Promise<unknown>[] = [];

  if (params.customerPhone) {
    attempts.push(
      (async () => {
        const result = isSmsConfigured()
          ? await sendSms(params.customerPhone!, params.smsBody)
          : { sent: false, error: "not_configured" };
        await prisma.notificationLog.create({
          data: {
            deliveryId: params.deliveryId,
            channel: "SMS",
            recipient: params.customerPhone!,
            notificationType: params.notificationType,
            status: result.sent ? "SENT" : result.error === "not_configured" ? "NOT_CONFIGURED" : "FAILED",
            providerMessageId: result.providerMessageId,
          },
        });
      })()
    );
  }

  if (params.customerEmail) {
    attempts.push(
      (async () => {
        const result = isEmailConfigured()
          ? await sendEmail(params.customerEmail!, params.emailSubject, params.emailHtml)
          : { sent: false, error: "not_configured" };
        await prisma.notificationLog.create({
          data: {
            deliveryId: params.deliveryId,
            channel: "EMAIL",
            recipient: params.customerEmail!,
            notificationType: params.notificationType,
            status: result.sent ? "SENT" : result.error === "not_configured" ? "NOT_CONFIGURED" : "FAILED",
            providerMessageId: result.providerMessageId,
          },
        });
      })()
    );
  }

  await Promise.allSettled(attempts);
}

export function trackingLinkSmsBody(trackingCode: string): string {
  return `NexaMove: your delivery is on the way! Track it live: ${trackingUrl(trackingCode)}`;
}

export function trackingLinkEmailHtml(customerName: string, trackingCode: string): string {
  const url = trackingUrl(trackingCode);
  return `<p>Hi ${customerName},</p><p>Your delivery is on the way. You can track it live here:</p><p><a href="${url}">${url}</a></p>`;
}

export function deliveryConfirmationSmsBody(): string {
  return `NexaMove: your delivery has been completed. Thank you for choosing us!`;
}

export function deliveryConfirmationEmailHtml(customerName: string, trackingCode: string): string {
  return `<p>Hi ${customerName},</p><p>Your delivery has been completed. You can view the delivery confirmation here:</p><p><a href="${trackingUrl(trackingCode)}">${trackingUrl(trackingCode)}</a></p>`;
}

export function deliveryFailedSmsBody(): string {
  return `NexaMove: we were unable to complete your delivery today. We'll be in touch to reschedule.`;
}

export function deliveryFailedEmailHtml(customerName: string): string {
  return `<p>Hi ${customerName},</p><p>Unfortunately we were unable to complete your delivery today. Our team will be in touch shortly to reschedule.</p>`;
}
