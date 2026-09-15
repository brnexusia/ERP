import type { MembershipRole } from "@prisma/client";

export type Permission =
  | "organization:manage"
  | "users:manage"
  | "clients:read"
  | "clients:write"
  | "sales:read"
  | "sales:write"
  | "inventory:read"
  | "inventory:write"
  | "finance:read"
  | "finance:write"
  | "reports:read"
  | "integrations:manage";

const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  OWNER: [
    "organization:manage",
    "users:manage",
    "clients:read",
    "clients:write",
    "sales:read",
    "sales:write",
    "inventory:read",
    "inventory:write",
    "finance:read",
    "finance:write",
    "reports:read",
    "integrations:manage",
  ],
  ADMIN: [
    "organization:manage",
    "users:manage",
    "clients:read",
    "clients:write",
    "sales:read",
    "sales:write",
    "inventory:read",
    "inventory:write",
    "finance:read",
    "finance:write",
    "reports:read",
    "integrations:manage",
  ],
  MANAGER: [
    "clients:read",
    "clients:write",
    "sales:read",
    "sales:write",
    "inventory:read",
    "inventory:write",
    "finance:read",
    "reports:read",
  ],
  SELLER: ["clients:read", "clients:write", "sales:read", "sales:write", "inventory:read"],
  FINANCE: ["clients:read", "sales:read", "finance:read", "finance:write", "reports:read"],
  SUPPORT: ["clients:read", "clients:write", "sales:read", "inventory:read"],
  VIEWER: ["clients:read", "sales:read", "inventory:read", "finance:read", "reports:read"],
};

export function hasPermission(role: MembershipRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: MembershipRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permissão negada: ${permission}`);
  }
}
