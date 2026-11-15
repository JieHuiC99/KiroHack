import type { Metadata } from "next";
import Link from "next/link";
import { venueGroups, venues } from "@/lib/venues";

export const metadata: Metadata = { title: "SunSafe — Classroom alert" };

/** Pick which room this computer is in. Done once per classroom PC; the startup agent then opens it directly. */
export default function ClassroomPicker() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 p-4 text-lg sm:p-6 sm:text-xl">
      <h1 className="text-3xl font-bold">Classroom alert</h1>
      <p>Which room is this computer in? It will show a full-screen alert with a siren when the emergency team triggers the fire alarm.</p>
      {venueGroups.map((group) => (
        <section key={group}>
          <h2 className="mb-2 text-xl font-bold">{group}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {venues
              .filter((v) => v.group === group)
              .map((venue) => (
                <li key={venue.id}>
                  <Link
                    href={`/classroom/${venue.id}`}
                    className="block min-h-14 rounded-xl border-2 border-black p-4 font-bold hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white"
                  >
                    {venue.name} <span className="font-normal">· {venue.level}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
