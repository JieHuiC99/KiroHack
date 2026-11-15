"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";

// Minimal email/password sign-in + sign-up. Swap the raw elements for shadcn components when available.
export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const result =
      mode === "sign-up"
        ? await signUp.email({ email, password, name: String(formData.get("name") || email.split("@")[0]) })
        : await signIn.email({ email, password });
    setPending(false);
    if (result.error) return setError(result.error.message ?? "Something went wrong");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{mode === "sign-in" ? "Sign in" : "Create an account"}</h1>
      <form action={onSubmit} className="flex flex-col gap-2">
        {mode === "sign-up" ? (
          <>
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <input id="name" name="name" autoComplete="name" className="rounded-md border px-3 py-2" />
          </>
        ) : null}
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="rounded-md border px-3 py-2" />
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" required minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"} className="rounded-md border px-3 py-2" />
        <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50">
          {mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
      <button type="button" className="text-sm underline" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
        {mode === "sign-in" ? "No account? Sign up" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
