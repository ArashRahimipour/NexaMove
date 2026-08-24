import type { Role } from "@prisma/client";

// Central role-permission table. Server-side only — never trust a role claim
// that didn't come from the authenticated session (see lib/auth.ts / api-auth.ts).

const BACK_OFFICE_ROLES: Role[] = ["ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE"];

export const canDrive = (role: Role) => role === "DRIVER";
export const isRetailClient = (role: Role) => role === "RETAIL_CLIENT";

export const canViewAdminDashboard = (role: Role) => BACK_OFFICE_ROLES.includes(role);

export const canManageUsers = (role: Role) => role === "ADMIN";
export const canManageDrivers = (role: Role) => role === "ADMIN" || role === "OPERATIONS_MANAGER";
export const canManageVehicles = (role: Role) => role === "ADMIN" || role === "OPERATIONS_MANAGER";

export const canManageRoutes = (role: Role) => role === "ADMIN" || role === "DISPATCHER";
export const canDispatch = (role: Role) => role === "ADMIN" || role === "DISPATCHER";
export const canCreateDeliveries = (role: Role) =>
  role === "ADMIN" || role === "OPERATIONS_MANAGER" || role === "DISPATCHER" || role === "RETAIL_CLIENT";

export const canViewKpi = (role: Role) => role === "ADMIN" || role === "OPERATIONS_MANAGER";
export const canViewAlerts = (role: Role) =>
  role === "ADMIN" || role === "OPERATIONS_MANAGER" || role === "DISPATCHER";

export const canManageCustomerService = (role: Role) =>
  role === "ADMIN" || role === "OPERATIONS_MANAGER" || role === "CUSTOMER_SERVICE";

export const canSetDamageResponsibility = (role: Role) =>
  role === "ADMIN" || role === "OPERATIONS_MANAGER";

export const canManageSettlements = (role: Role) => role === "ADMIN" || role === "OPERATIONS_MANAGER";
export const canApproveSettlements = (role: Role) => role === "ADMIN";

export const canManageSettings = (role: Role) => role === "ADMIN";
export const canManageOrganisations = (role: Role) => role === "ADMIN";

export const canUsePricingCalculator = (role: Role) =>
  role === "ADMIN" || role === "OPERATIONS_MANAGER" || role === "DISPATCHER";
export const canManagePricingData = (role: Role) => role === "ADMIN" || role === "OPERATIONS_MANAGER";
export const canOverrideFuelLevy = (role: Role) => role === "ADMIN";

export const canViewAuditLog = (role: Role) => role === "ADMIN" || role === "OPERATIONS_MANAGER";

export const canViewReturns = (role: Role) =>
  role === "ADMIN" || role === "OPERATIONS_MANAGER" || role === "DISPATCHER" || role === "CUSTOMER_SERVICE";

// Nav sections a role sees in the back-office shell. Used to render the sidebar
// and as a second line of defence alongside server-side route checks.
export function visibleNavSections(role: Role): string[] {
  switch (role) {
    case "ADMIN":
      return ["dashboard", "ai", "routes", "drivers", "vehicles", "dispatch", "pricing", "kpi", "alerts", "returns", "customer-service", "settlements", "organisations", "settings", "audit"];
    case "OPERATIONS_MANAGER":
      return ["dashboard", "ai", "routes", "drivers", "dispatch", "pricing", "kpi", "alerts", "returns", "customer-service", "settlements"];
    case "DISPATCHER":
      return ["dashboard", "ai", "routes", "dispatch", "pricing", "alerts", "returns"];
    case "CUSTOMER_SERVICE":
      return ["ai", "returns", "customer-service"];
    case "RETAIL_CLIENT":
      return ["client-portal"];
    default:
      return [];
  }
}
