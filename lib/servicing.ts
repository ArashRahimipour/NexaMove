import { prisma } from "@/lib/prisma";

// Configurable per-client (and, within a client, per-region) delivery
// days — e.g. Koala Living's non-regional QLD schedule is Tue-Sat, per
// their brief. A client with no ServicingSchedule row at all is
// unrestricted (this only ever adds a constraint, never removes the
// default "any day" behaviour every other client already has).
//
// A schedule with region === "" (the default) is the client's
// default/metro schedule; a named region (e.g. "Cairns", "Toowoomba") gets
// its own row with its own days and, optionally, a minimum order/volume
// threshold — nothing about regional frequency is hard-coded, per the
// brief's explicit instruction, because real regional schedules were never
// supplied.
//
// Note: this `region` is a distinct concept from Delivery.region (a state
// code like "QLD"). There's no field yet recording which named regional
// catchment a delivery falls into — that would need its own postcode-based
// resolution, itself dependent on Koala's regional definitions, which
// weren't supplied. Until that exists, callers only ever check the
// default/metro schedule (region omitted); pass a region explicitly once a
// delivery actually carries one.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayOfWeek(date: Date): number {
  return date.getDay(); // 0 = Sunday .. 6 = Saturday
}

export function formatDays(daysOfWeek: number[]): string {
  return [...daysOfWeek].sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join(", ");
}

export interface ServicingCheckResult {
  allowed: boolean;
  reason?: string;
  nextAvailableDate?: Date;
}

export async function checkServicingDay(params: {
  organisationId: string;
  region?: string;
  date: Date;
}): Promise<ServicingCheckResult> {
  const schedule = await resolveServicingSchedule(params.organisationId, params.region ?? "");
  if (!schedule || !schedule.active) return { allowed: true };

  const day = dayOfWeek(params.date);
  if (schedule.daysOfWeek.includes(day)) return { allowed: true };

  return {
    allowed: false,
    reason: `${schedule.region || "This client"} only services ${formatDays(schedule.daysOfWeek)} — ${DAY_NAMES[day]} is not an available delivery day.`,
    nextAvailableDate: nextAvailableDate(schedule.daysOfWeek, params.date),
  };
}

// A named region's schedule takes priority over the client's default; falls
// back to the default (region: "") schedule if the requested region has no
// schedule of its own.
export async function resolveServicingSchedule(organisationId: string, region: string) {
  if (region) {
    const regional = await prisma.servicingSchedule.findFirst({
      where: { organisationId, region, active: true },
    });
    if (regional) return regional;
  }
  return prisma.servicingSchedule.findFirst({ where: { organisationId, region: "", active: true } });
}

export function nextAvailableDate(daysOfWeek: number[], from: Date): Date | undefined {
  if (daysOfWeek.length === 0) return undefined;
  const candidate = new Date(from);
  for (let i = 0; i < 8; i++) {
    if (daysOfWeek.includes(dayOfWeek(candidate))) return candidate;
    candidate.setDate(candidate.getDate() + 1);
  }
  return undefined;
}
