import type { DeliveryStatus } from "@prisma/client";

// The delivery status state machine. A transition is only valid if the target
// status is listed for the current status — this is what stops a driver (or a
// buggy client) from jumping e.g. ASSIGNED straight to DELIVERED.
//
// Key business rule: ARRIVED is a distinct, required step before DELIVERED.
// DELIVERED is only reachable after the full completion flow (photo,
// signature/receiver, damage check) records ARRIVED first.
const TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["ASSIGNED", "CANCELLED"],
  // LOADED/ROUTE_STARTED are available for route-level dispatch workflows, but a
  // driver's per-stop "I'm on my way" action may go straight to IN_TRANSIT when
  // those aren't tracked separately for a given delivery.
  ASSIGNED: ["LOADED", "READY_FOR_DISPATCH", "IN_TRANSIT", "CANCELLED"],
  LOADED: ["ROUTE_STARTED", "CANCELLED"],
  ROUTE_STARTED: ["IN_TRANSIT"],
  IN_TRANSIT: ["DRIVER_NEARBY", "ARRIVED", "FAILED"],
  DRIVER_NEARBY: ["ARRIVED", "FAILED"],
  ARRIVED: ["UNLOADING", "DELIVERED", "FAILED", "PARTIALLY_DELIVERED", "DAMAGED"],
  UNLOADING: ["ASSEMBLY_IN_PROGRESS", "DELIVERED", "PARTIALLY_DELIVERED", "DAMAGED", "FAILED"],
  ASSEMBLY_IN_PROGRESS: ["DELIVERED", "PARTIALLY_DELIVERED", "DAMAGED"],
  DELIVERED: [],
  FAILED: ["RESCHEDULED", "RETURN_REQUIRED", "CANCELLED"],
  DAMAGED: ["DELIVERED", "RETURN_REQUIRED", "PARTIALLY_DELIVERED"],
  PARTIALLY_DELIVERED: ["RETURN_REQUIRED", "DELIVERED"],
  RETURN_REQUIRED: ["RETURNED"],
  RETURNED: [],
  RESCHEDULED: ["READY_FOR_DISPATCH", "ASSIGNED"],
  CANCELLED: [],
};

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: DeliveryStatus, to: DeliveryStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid delivery status transition: ${from} -> ${to}`);
  }
}

export const DELIVERY_STATUS_COLOR: Record<DeliveryStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-500",
  PENDING: "bg-slate-100 text-slate-600",
  READY_FOR_DISPATCH: "bg-slate-100 text-slate-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  LOADED: "bg-blue-100 text-blue-700",
  ROUTE_STARTED: "bg-amber-100 text-amber-700",
  IN_TRANSIT: "bg-amber-100 text-amber-700",
  DRIVER_NEARBY: "bg-amber-100 text-amber-700",
  ARRIVED: "bg-purple-100 text-purple-700",
  UNLOADING: "bg-purple-100 text-purple-700",
  ASSEMBLY_IN_PROGRESS: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  DAMAGED: "bg-red-100 text-red-700",
  PARTIALLY_DELIVERED: "bg-orange-100 text-orange-700",
  RETURN_REQUIRED: "bg-orange-100 text-orange-700",
  RETURNED: "bg-slate-100 text-slate-600",
  RESCHEDULED: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  READY_FOR_DISPATCH: "Ready for dispatch",
  ASSIGNED: "Assigned",
  LOADED: "Loaded",
  ROUTE_STARTED: "Route started",
  IN_TRANSIT: "In transit",
  DRIVER_NEARBY: "Driver nearby",
  ARRIVED: "Arrived",
  UNLOADING: "Unloading",
  ASSEMBLY_IN_PROGRESS: "Assembly in progress",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  DAMAGED: "Damaged",
  PARTIALLY_DELIVERED: "Partially delivered",
  RETURN_REQUIRED: "Return required",
  RETURNED: "Returned",
  RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled",
};
