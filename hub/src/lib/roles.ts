export type Role = "owner" | "staff" | "client_admin" | "client_ap" | "factory_admin" | "factory_user";

export const HOME_BY_ROLE: Record<Role, string> = {
  owner: "/admin",
  staff: "/admin",
  client_admin: "/portal",
  client_ap: "/portal",
  factory_admin: "/factory",
  factory_user: "/factory",
};

export const AREA_ALLOWED: Record<string, Role[]> = {
  "/admin": ["owner", "staff"],
  "/portal": ["client_admin", "client_ap"],
  "/factory": ["factory_admin", "factory_user", "owner"],  // owner = preview mode
};
