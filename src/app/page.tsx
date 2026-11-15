import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { SCREENS } from "@/lib/roles";
import { getAppUser } from "@/lib/session";

const ROLE_LABEL = { student: "Student or staff", responder: "Responder", team: "Disaster recovery team" };
const PROFILE_LABEL = { other: "can see the screen and use stairs", blind: "blind or low vision", wheelchair: "wheelchair user or cannot use stairs" };
const card = "block rounded-xl border-2 border-black p-5 hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white";

/** The screens this person's role may open. Reads the session, so it renders per request inside <Suspense>. */
async function Screens({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [user, query] = await Promise.all([getAppUser(), searchParams]);
  if (!user) {
    return (
      <Link href="/sign-in" className={card}>
        <span className="block text-2xl font-bold">Sign in</span>
        <span className="block">Students, staff, responders and the disaster recovery team.</span>
      </Link>
    );
  }
  return (
    <>
      {query.denied ? <p role="alert" className="rounded-xl bg-red-800 p-4 font-bold text-white">Your account is not allowed to open that screen.</p> : null}
      <p>
        Signed in as <strong>{user.name}</strong> · {ROLE_LABEL[user.role]} · {PROFILE_LABEL[user.profile]}
      </p>
      <ul className="flex flex-col gap-4">
        {SCREENS.filter((screen) => screen.roles.includes(user.role)).map((screen) => (
          <li key={screen.href}>
            <Link href={screen.href} className={card}>
              <span className="block text-2xl font-bold">{screen.title}</span>
              <span className="block">{screen.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <SignOutButton />
    </>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-6 text-xl">
      <h1 className="text-4xl font-extrabold">SafeWay</h1>
      <p>Accessible evacuation guidance for blind, low-vision and mobility-impaired people on campus.</p>
      <Suspense>
        <Screens searchParams={searchParams} />
      </Suspense>
      <p className="text-base">Prototype. Floor geometry and staircase positions are approximate and not verified for real evacuations.</p>
    </main>
  );
}
