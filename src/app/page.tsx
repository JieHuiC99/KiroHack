import Link from "next/link";

const SCREENS = [
  { href: "/route", title: "Your way out (practice route)", text: "Mobile 3D map: follow the orange line from UC-3-3 to the exit and out to the field. No setup needed." },
  { href: "/me", title: "My evacuation", text: "Phone screen for students and staff. Voice, vibration and three big buttons." },
  { href: "/responder", title: "Responder", text: "Phone screen for helpers: accept a request, find the person, mark them evacuated." },
  { href: "/dashboard", title: "Control dashboard", text: "Trigger the alarm, block staircases, watch requests on the 3D floor map." },
  { href: "/monitor", title: "Venue monitor", text: "Emergency team: which classrooms have classes now, who has acknowledged the alarm, CCTV, repeat the siren." },
  { href: "/classroom", title: "Classroom alert", text: "Classroom computer: full-screen alert and siren until someone confirms the room is evacuating." },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-6 text-xl">
      <h1 className="text-4xl font-extrabold">SunSafe</h1>
      <p>Accessible evacuation guidance for blind, low-vision and mobility-impaired people on campus.</p>
      <ul className="flex flex-col gap-4">
        {SCREENS.map((screen) => (
          <li key={screen.href}>
            <Link href={screen.href} className="block rounded-xl border-2 border-black p-5 hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white">
              <span className="block text-2xl font-bold">{screen.title}</span>
              <span className="block">{screen.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-base">Prototype. Floor geometry and staircase positions are approximate and not verified for real evacuations.</p>
    </main>
  );
}
