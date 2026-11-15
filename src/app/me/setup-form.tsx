"use client";
import Link from "next/link";
import { useState } from "react";
import { BUTTON, FIELD, SCREEN, ScreenHeader, ScreenTitle } from "@/components/sunsafe-screen";
import { speak } from "@/lib/client/announce";
import { useStored } from "@/lib/client/stored";
import type { Floor } from "@/lib/floor/types";
import { selectableRooms } from "@/lib/floor/routing";
import type { AppUser } from "@/lib/roles";
import type { Profile } from "@/lib/validation/emergency";

/** Where the person is right now, and whether the app should talk. */
export type Place = { roomId: string; voice: boolean; profile: Profile };

const CHOICE =
  "flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-[#cfe0dc] bg-white p-4 has-checked:border-[#1e4a55] has-checked:bg-[#eef7f4]";

/**
 * Asked on every visit. The answer lives in memory for this visit only: it is not written to the
 * phone's storage or to the account, so nobody's whereabouts are kept. Only the voice on/off
 * preference is remembered on the phone. Accessibility preferences are chosen for this visit.
 */
export function LocationForm({ floor, user, alarm, onSave }: { floor: Floor; user: AppUser; alarm: boolean; onSave: (place: Place) => void }) {
  const rooms = selectableRooms(floor);
  const { value: savedVoice, save: saveVoice } = useStored<boolean>("safeway.voice");
  const [roomId, setRoomId] = useState("");
  const [profile, setProfile] = useState<Profile>(user.profile);
  const [voiceChoice, setVoiceChoice] = useState<boolean | null>(null);
  // Blind profile: voice on unless they have switched it off before.
  const voice = voiceChoice ?? savedVoice ?? profile === "blind";

  return (
    <main className={`${SCREEN} text-lg`}>
      <ScreenHeader pill={alarm ? "Fire emergency" : "Where are you?"} tone={alarm ? "alarm" : "info"} />
      {alarm ? (
        <p role="alert" className="rounded-2xl bg-[#c62828] p-4 text-2xl font-extrabold text-white">
          FIRE EMERGENCY. Tell us where you are to get your way out.
        </p>
      ) : null}
      <ScreenTitle title={`Where are you now, ${user.name}?`} subtitle="We ask every time and do not keep it: your location is forgotten when you close this page." />
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!roomId) return;
          saveVoice(voice);
          onSave({ roomId, voice, profile });
          // This tap also unlocks speech for the rest of the visit (browsers require one).
          if (voice) speak("SunSafe is ready. You will hear instructions here if there is an emergency.");
        }}
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-bold">In an emergency</legend>
          {([
            ["other", "I can see the screen and use stairs"],
            ["wheelchair", "I use a wheelchair or cannot use stairs"],
            ["blind", "I am blind or have low vision"],
          ] as const).map(([value, label]) => (
            <label key={value} className={CHOICE}>
              <input type="radio" name="profile" value={value} checked={profile === value} onChange={() => setProfile(value)} className="size-6" />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-2 font-bold">
          Room you are in ({floor.building}, {floor.label})
          <select required value={roomId} onChange={(event) => setRoomId(event.target.value)} className={FIELD}>
            <option value="" disabled>
              Choose your room
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>

        <Link href="/guide/lt5-green-zone" className={`${CHOICE} flex-col items-start gap-1`}>
          <span className="block font-bold">In Lecture Theatre 5 (Level 1)?</span>
          <span className="block text-base text-[#4f6970]">Open the camera route: scan the QR codes on the walls and follow the arrow to the Green zone.</span>
        </Link>

        <label className={`${CHOICE} items-start`}>
          <input type="checkbox" checked={voice} onChange={(event) => setVoiceChoice(event.target.checked)} className="mt-1 size-6 accent-[#1e4a55]" />
          <span>
            <span className="block font-bold">Read instructions aloud</span>
            <span className="block text-base text-[#4f6970]">Switch this off if you use TalkBack or VoiceOver, so two voices don&apos;t talk at once.</span>
          </span>
        </label>

        <button type="submit" className={`${BUTTON.base} ${BUTTON.primary} min-h-20 text-2xl`}>
          {alarm ? "Show my way out" : "Continue"}
        </button>
      </form>
    </main>
  );
}
