"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

const field = "rounded-lg border-2 border-black p-3 text-lg font-normal";

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
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 p-4 text-lg sm:p-6">
      <h1 className="text-3xl font-bold">{mode === "sign-in" ? "Sign in to SafeWay" : "Create a SafeWay account"}</h1>
      {/* onSubmit, not a form action: React clears the fields after an action, and a mistyped password shouldn't cost the email too. */}
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(new FormData(event.currentTarget));
        }}
      >
        {mode === "sign-up" ? (
          <label className="flex flex-col gap-1 font-semibold">
            Name
            <input name="name" required autoComplete="name" className={field} />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 font-semibold">
          Email
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          Password
          <input name="password" type="password" required minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} className={field} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">In an emergency, which describes you?</legend>
          {PROFILE_OPTIONS.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-black p-3 has-checked:bg-black has-checked:text-white">
              <input type="radio" name="profile" value={option.value} checked={profile === option.value} onChange={() => setProfile(option.value)} className="size-6 shrink-0" />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-base">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <button type="submit" disabled={pending} className="min-h-16 rounded-xl bg-black p-4 text-2xl font-bold text-white disabled:opacity-50">
          {mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
        {error ? <p role="alert" className="font-semibold text-red-800">{error}</p> : null}
      </form>
      <button type="button" className="self-start underline" onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError(undefined);
        }}
      >
        {mode === "sign-in" ? "No account? Sign up" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
