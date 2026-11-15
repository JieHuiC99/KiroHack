"use client";
import Link from "next/link";
import { useState } from "react";
import { speak } from "@/lib/client/announce";
import { useStored } from "@/lib/client/stored";
import type { Floor } from "@/lib/floor/types";
import { selectableRooms } from "@/lib/floor/routing";
import type { AppUser } from "@/lib/roles";

/** Where the person is right now, and whether the app should talk. */
export type Place = { roomId: string; voice: boolean };

/**
 * Asked on every visit. The answer lives in memory for this visit only: it is not written to the
 * phone's storage or to the account, so nobody's whereabouts are kept. Only the voice on/off
 * preference is remembered on the phone.
 */
export function LocationForm({ floor, user, alarm, onSave }: { floor: Floor; user: AppUser; alarm: boolean; onSave: (place: Place) => void }) {
  const rooms = selectableRooms(floor);
  const { value: savedVoice, save: saveVoice } = useStored<boolean>("safeway.voice");
  const [roomId, setRoomId] = useState("");
  const [voiceChoice, setVoiceChoice] = useState<boolean | null>(null);
  // Blind profile: voice on unless they have switched it off before.
  const voice = voiceChoice ?? savedVoice ?? user.profile === "blind";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 p-4 text-lg sm:gap-8 sm:p-6 sm:text-xl">
      {alarm ? (
        <p role="alert" className="rounded-xl bg-red-800 p-4 text-2xl font-extrabold text-white">
          FIRE EMERGENCY. Tell us where you are to get your way out.
        </p>
      ) : null}
      <h1 className="text-3xl font-bold">Where are you now, {user.name}?</h1>
      <form
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (!roomId) return;
          saveVoice(voice);
          onSave({ roomId, voice });
          // This tap also unlocks speech for the rest of the visit (browsers require one).
          if (voice) speak("SafeWay is ready. You will hear instructions here if there is an emergency.");
        }}
      >
        <label className="flex flex-col gap-2 font-semibold">
          Room you are in ({floor.building}, {floor.label})
          <select
            required
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className="rounded-lg border-2 border-black bg-white p-4 text-xl font-normal text-black"
          >
            <option value="" disabled>
              Choose your room
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
          <span className="text-base font-normal">We ask every time and do not keep it: your location is forgotten when you close this page.</span>
        </label>

        <Link href="/guide/lt5-green-zone" className="rounded-lg border-2 border-black p-4 hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white">
          <span className="block font-semibold">In Lecture Theatre 5 (Level 1)?</span>
          <span className="block text-lg">Open the camera route: scan the QR codes on the walls and follow the arrow to the Green zone.</span>
        </Link>

        <label className="flex cursor-pointer items-start gap-4 rounded-lg border-2 border-black p-4">
          <input type="checkbox" checked={voice} onChange={(event) => setVoiceChoice(event.target.checked)} className="mt-1 size-6" />
          <span>
            <span className="block font-semibold">Read instructions aloud</span>
            <span className="block text-lg">Switch this off if you use TalkBack or VoiceOver, so two voices don&apos;t talk at once.</span>
          </span>
        </label>

        <button type="submit" className="min-h-20 rounded-xl bg-black p-4 text-2xl font-bold text-white">
          {alarm ? "Show my way out" : "Continue"}
        </button>
      </form>
    </main>
  );
}
