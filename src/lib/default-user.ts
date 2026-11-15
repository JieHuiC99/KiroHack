import type { AppUser } from "./roles";

// Shared prototype identity. No account, session or role selection is required.
export const DEFAULT_USER = {
  id: "emergency-administrator",
  name: "Emergency administrator",
  role: "administrator",
  profile: "other",
} as const satisfies AppUser;
