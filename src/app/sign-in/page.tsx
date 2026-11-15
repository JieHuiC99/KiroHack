"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BUTTON, FIELD, SCREEN, ScreenHeader, ScreenTitle } from "@/components/sunsafe-screen";
import { authClient, signIn, signUp } from "@/lib/auth-client";
import { homeFor, type AppUser } from "@/lib/roles";
import type { Profile } from "@/lib/validation/emergency";

// Asked at every sign-in, because it decides what the evacuation screen looks like and where the
// route goes. It is not a permission: roles are worked out on the server (src/lib/roles.ts).
const PROFILE_OPTIONS: { value: Profile; label: string; hint: string }[] = [
  { value: "other", label: "Normal: I can see the screen and use stairs", hint: "3D map and camera arrows to the nearest emergency staircase" },
  { value: "blind", label: "Blind or low vision", hint: "Spoken and vibration guidance, no map" },
  { value: "wheelchair", label: "Disabled: I use a wheelchair or cannot use stairs", hint: "Route to the Bomba lift, and a helper is sent to you" },
];

const CHOICE =
  "flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-[#cfe0dc] bg-white p-4 has-checked:border-[#1e4a55] has-checked:bg-[#eef7f4]";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [profile, setProfile] = useState<Profile>("other");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const result =
      mode === "sign-up"
        ? await signUp.email({ email, password, name: String(formData.get("name") || email.split("@")[0]), profile })
        : await signIn.email({ email, password });
    if (result.error) {
      setPending(false);
      return setError(result.error.message ?? "Something went wrong");
    }
    // Signing in to an existing account: keep the answer given just now.
    if (mode === "sign-in") await authClient.updateUser({ profile });

    const me = await fetch("/api/me", { cache: "no-store" });
    const user = me.ok ? ((await me.json()) as AppUser) : null;
    router.push(user ? homeFor(user.role) : "/");
    router.refresh();
  }

  return (
    <main className={`${SCREEN} text-lg`}>
      <ScreenHeader account={false} nav={false} pill={mode === "sign-in" ? "Sign in" : "New account"} tone="info" />
      <ScreenTitle
        title={mode === "sign-in" ? "Sign in to SunSafe" : "Create a SunSafe account"}
        subtitle="Your way out, read aloud and shown on a map, the moment an alarm starts."
      />
      {/* onSubmit, not a form action: React clears the fields after an action, and a mistyped password shouldn't cost the email too. */}
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(new FormData(event.currentTarget));
        }}
      >
        {mode === "sign-up" ? (
          <label className="flex flex-col gap-2 font-bold">
            Name
            <input name="name" required autoComplete="name" className={FIELD} />
          </label>
        ) : null}
        <label className="flex flex-col gap-2 font-bold">
          Email
          <input name="email" type="email" required autoComplete="email" className={FIELD} />
        </label>
        <label className="flex flex-col gap-2 font-bold">
          Password
          <input name="password" type="password" required minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} className={FIELD} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">In an emergency, which describes you?</legend>
          {PROFILE_OPTIONS.map((option) => (
            <label key={option.value} className={CHOICE}>
              <input type="radio" name="profile" value={option.value} checked={profile === option.value} onChange={() => setProfile(option.value)} className="size-6 shrink-0 accent-[#1e4a55]" />
              <span>
                <span className="block font-bold">{option.label}</span>
                <span className="block text-base text-[#4f6970]">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <button type="submit" disabled={pending} className={`${BUTTON.base} ${BUTTON.primary} min-h-20 text-2xl`}>
          {mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
        {error ? <p role="alert" className="rounded-2xl bg-[#fde8e7] px-4 py-3 font-bold text-[#8f1d14]">{error}</p> : null}
      </form>
      <button type="button" className="self-start px-1 font-semibold text-[#4f6970] underline" onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError(undefined);
        }}
      >
        {mode === "sign-in" ? "No account? Sign up" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
