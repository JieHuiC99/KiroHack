import type { AppUser } from "@/lib/roles";
import type { Profile } from "@/lib/validation/emergency";

/** Distinct demo people for testing the emergency services; all have the default role. */
export function person(name: string, profile: Profile = "other"): AppUser {
  return { id: `test-${name.toLowerCase()}`, name, role: "administrator", profile };
}

export function request(options: { body?: unknown } = {}) {
  return new Request("http://localhost:3100/api/test", {
    method: options.body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}
