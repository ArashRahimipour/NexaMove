// Morning warehouse communication log — issue types per the Koala brief.

export const MORNING_COMM_ISSUE_TYPES = [
  "WAREHOUSE_ISSUE",
  "DELIVERY_INCIDENT",
  "DAMAGED_GOODS",
  "RETURNED_STOCK",
  "ITEMS_RECEIVED",
  "MISSING_STOCK",
  "OVERNIGHT_EXCEPTION",
  "CUSTOMER_COMPLAINT",
  "DRIVER_ISSUE",
  "OTHER",
] as const;

export type MorningCommIssueType = (typeof MORNING_COMM_ISSUE_TYPES)[number];

export const MORNING_COMM_ISSUE_LABEL: Record<MorningCommIssueType, string> = {
  WAREHOUSE_ISSUE: "Warehouse issue",
  DELIVERY_INCIDENT: "Delivery incident",
  DAMAGED_GOODS: "Damaged goods",
  RETURNED_STOCK: "Returned stock",
  ITEMS_RECEIVED: "Items received",
  MISSING_STOCK: "Missing stock",
  OVERNIGHT_EXCEPTION: "Overnight exception",
  CUSTOMER_COMPLAINT: "Customer complaint",
  DRIVER_ISSUE: "Driver issue",
  OTHER: "Other",
};
