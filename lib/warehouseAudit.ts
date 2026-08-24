// Weekly warehouse driver compliance audit — checklist categories per the
// Koala brief, in the order given there.

export const WAREHOUSE_AUDIT_CATEGORIES = [
  "COMPANY_UNIFORM",
  "VISIBLE_LOGO",
  "SAFETY_VEST_PPE",
  "SAFETY_SHOES",
  "STANDARD_TOOLS",
  "FURNITURE_BLANKETS",
  "STRAPS_TIE_DOWNS",
  "TROLLEY",
  "DRILL_TOOLS",
  "VACUUM",
  "CLEANING_PRODUCTS",
  "VEHICLE_CLEANLINESS",
  "VEHICLE_CONDITION",
  "REQUIRED_DOCUMENTATION",
] as const;

export type WarehouseAuditCategory = (typeof WAREHOUSE_AUDIT_CATEGORIES)[number];

export const WAREHOUSE_AUDIT_CATEGORY_LABEL: Record<WarehouseAuditCategory, string> = {
  COMPANY_UNIFORM: "Company uniform",
  VISIBLE_LOGO: "Visible company logo",
  SAFETY_VEST_PPE: "Safety vest / PPE",
  SAFETY_SHOES: "Safety shoes",
  STANDARD_TOOLS: "Standard tools",
  FURNITURE_BLANKETS: "Furniture blankets",
  STRAPS_TIE_DOWNS: "Straps / tie-downs",
  TROLLEY: "Trolley",
  DRILL_TOOLS: "Drill / tools (where required)",
  VACUUM: "Vacuum",
  CLEANING_PRODUCTS: "Cleaning products",
  VEHICLE_CLEANLINESS: "Vehicle cleanliness",
  VEHICLE_CONDITION: "Vehicle condition",
  REQUIRED_DOCUMENTATION: "Required documentation",
};

// The brief says "failed critical items should create an alert" but
// doesn't say which of the 14 items are actually safety-critical for a
// given client — that's a policy call, not something to invent. These are
// pre-ticked as a sensible starting suggestion in the audit form (PPE/
// safety items), but `critical` is stored per item at audit time and can
// be changed for any item on any audit — this is not a settled rule.
export const SUGGESTED_CRITICAL_CATEGORIES: WarehouseAuditCategory[] = ["SAFETY_VEST_PPE", "SAFETY_SHOES"];
