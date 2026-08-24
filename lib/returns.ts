// 48-hour returns/exchange SLA — see prisma/schema.prisma's ReturnTask
// comment for the assumption this is built on (the clock starts at
// DRIVER_POSSESSION, not the original booking time, pending confirmation).

export const RETURN_SLA_HOURS = 48;
export const RETURN_SLA_WARNING_HOURS_REMAINING = 24;

export type ReturnSlaBand = "ON_TRACK" | "WARNING" | "OVERDUE" | "NOT_STARTED" | "CLOSED";

export function computeReturnSlaDeadline(collectedAt: Date): Date {
  return new Date(collectedAt.getTime() + RETURN_SLA_HOURS * 60 * 60 * 1000);
}

// Positive = time remaining, negative = hours overdue.
export function hoursRemaining(slaDeadline: Date, now: Date = new Date()): number {
  return (slaDeadline.getTime() - now.getTime()) / (60 * 60 * 1000);
}

export function computeReturnSlaBand(params: {
  status: string;
  slaDeadline: Date | null;
  now?: Date;
}): ReturnSlaBand {
  if (params.status === "CLOSED") return "CLOSED";
  if (!params.slaDeadline) return "NOT_STARTED";
  const remaining = hoursRemaining(params.slaDeadline, params.now ?? new Date());
  if (remaining < 0) return "OVERDUE";
  if (remaining <= RETURN_SLA_WARNING_HOURS_REMAINING) return "WARNING";
  return "ON_TRACK";
}

export const RETURN_TASK_STATUS_LABEL: Record<string, string> = {
  CUSTOMER_COLLECTION: "Customer collection",
  DRIVER_POSSESSION: "Driver possession",
  IN_TRANSIT_TO_WAREHOUSE: "In transit to warehouse",
  WAREHOUSE_RETURNED: "Warehouse returned",
  SCANNED_IN: "Scanned in",
  CLOSED: "Closed",
};

// A return task's status only ever moves forward — no state machine needed
// beyond "the next stage in the list", but jumping stages (e.g. straight
// from DRIVER_POSSESSION to SCANNED_IN because the warehouse step wasn't
// logged) is allowed rather than enforced strictly, since not every
// operational path will touch every stage in practice.
const ORDER: string[] = [
  "CUSTOMER_COLLECTION",
  "DRIVER_POSSESSION",
  "IN_TRANSIT_TO_WAREHOUSE",
  "WAREHOUSE_RETURNED",
  "SCANNED_IN",
  "CLOSED",
];

export function canAdvanceReturnTask(from: string, to: string): boolean {
  const fromIdx = ORDER.indexOf(from);
  const toIdx = ORDER.indexOf(to);
  return fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx;
}

export function nextReturnTaskStatus(current: string): string | null {
  const idx = ORDER.indexOf(current);
  if (idx === -1 || idx === ORDER.length - 1) return null;
  return ORDER[idx + 1];
}
