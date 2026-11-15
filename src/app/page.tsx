import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { ScreenHeader } from "@/components/sunsafe-screen";
import { PROFILE_LABEL, ROLE_LABEL, SCREENS } from "@/lib/roles";
import { getAppUser } from "@/lib/session";

const card = "block rounded-2xl border-2 border-[#cfe0dc] bg-white p-4 hover:border-[#1e4a55] hover:bg-[#eef7f4] focus-visible:border-[#1e4a55] focus-visible:bg-[#eef7f4]";

/** The screens this person's role may open. Reads the session, so it renders per request inside <Suspense>. */
async function Screens({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [user, query] = await Promise.all([getAppUser(), searchParams]);
  if (!user) {
    return (
      <Link href="/sign-in" className={card}>
        <span className="block text-xl font-extrabold">Sign in</span>
        <span className="block text-[15px] text-[#4f6970]">Students, staff, responders and the disaster recovery team.</span>
      </Link>
    );
  }
  return (
    <>
      {query.denied ? <p role="alert" className="rounded-2xl bg-[#fde8e7] px-4 py-3 font-bold text-[#8f1d14]">Your account is not allowed to open that screen.</p> : null}
      <p className="rounded-2xl bg-[#eef7f4] px-4 py-3 text-[15px]">
        Signed in as <strong>{user.name}</strong> · {ROLE_LABEL[user.role]} · {PROFILE_LABEL[user.profile]}
      </p>
      <ul className="flex flex-col gap-3">
        {SCREENS.filter((screen) => screen.roles.includes(user.role)).map((screen) => (
          <li key={screen.href}>
            <Link href={screen.href} className={card}>
              <span className="block text-xl font-extrabold">{screen.title}</span>
              <span className="block text-[15px] text-[#4f6970]">{screen.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <SignOutButton className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#c62828] text-xl font-extrabold text-white" />
    </>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 bg-white px-3 pt-3 pb-10 text-lg text-[#17323a]">
      <ScreenHeader />
      <div className="px-1">
        <h1 className="text-[28px] leading-tight font-extrabold">Get everyone out safely</h1>
        <p className="text-[15px] text-[#4f6970]">Accessible evacuation guidance for blind, low-vision and mobility-impaired people on campus.</p>
      </div>
      <Suspense>
        <Screens searchParams={searchParams} />
      </Suspense>
      <p className="px-1 text-xs text-[#6b8288]">Prototype. Floor geometry and staircase positions are approximate and not verified for real evacuations.</p>
    </main>
  );
}
