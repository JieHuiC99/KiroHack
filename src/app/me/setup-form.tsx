"use client";
import { useState } from "react";
import { BUTTON, FIELD, SCREEN, ScreenHeader, ScreenTitle } from "@/components/sunsafe-screen";
import { speak } from "@/lib/client/announce";
import type { Floor } from "@/lib/floor/types";
import { selectableRooms } from "@/lib/floor/routing";
import type { Profile } from "@/lib/validation/emergency";

export type Settings = { name: string; profile: Profile; roomId: string; voice: boolean };

const PROFILE_OPTIONS: { value: Profile; label: string; hint: string }[] = [
  { value: "other", label: "I can see the screen and use stairs", hint: "3D map with arrows to the nearest staircase" },
  { value: "wheelchair", label: "I use a wheelchair or cannot use stairs", hint: "3D map to the Bomba lift, and a helper is sent to you" },
  { value: "blind", label: "I am blind or have low vision", hint: "Spoken and vibration guidance, no map" },
];

const CHOICE =
  "flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-[#cfe0dc] bg-white p-4 has-checked:border-[#1e4a55] has-checked:bg-[#eef7f4]";

/** Filled in once, on a calm day. Nothing here has to be touched during an emergency. */
export function SetupForm({ floor, initial, onSave }: { floor: Floor; initial: Settings | null; onSave: (s: Settings) => void }) {
  const rooms = selectableRooms(floor);
  const [name, setName] = useState(initial?.name ?? "");
  const [profile, setProfile] = useState<Profile>(initial?.profile ?? "other");
  const [roomId, setRoomId] = useState(initial?.roomId ?? rooms[0]?.id ?? "");
  const [voice, setVoice] = useState(initial?.voice ?? false);

  return (
    <main className={`${SCREEN} text-lg`}>
      <ScreenHeader pill="Setup · 1 minute" tone="info" />
      <ScreenTitle title="Set up SunSafe" subtitle="Do this once, on a calm day. In an emergency you won't need to type anything." />
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          const settings = { name: name.trim(), profile, roomId, voice };
          onSave(settings);
          // This tap also unlocks speech for the rest of the session (browsers require one).
          if (voice) speak("SunSafe is ready. You will hear instructions here if there is an emergency.");
        }}
      >
        <label className="flex flex-col gap-2 font-bold">
          Your name
          <input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={FIELD} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">In an emergency</legend>
          {PROFILE_OPTIONS.map((option) => (
            <label key={option.value} className={CHOICE}>
              <input
                type="radio"
                name="profile"
                value={option.value}
                checked={profile === option.value}
                onChange={() => {
                  setProfile(option.value);
                  setVoice(option.value === "blind"); // sensible default; the checkbox below can override it
                }}
                className="size-6 accent-[#1e4a55]"
              />
              <span>
                <span className="block font-bold">{option.label}</span>
                <span className="block text-base text-[#4f6970]">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-2 font-bold">
          Room you are usually in ({floor.building}, {floor.label})
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)} className={FIELD}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>

        <label className={`${CHOICE} items-start`}>
          <input type="checkbox" checked={voice} onChange={(event) => setVoice(event.target.checked)} className="mt-1 size-6 accent-[#1e4a55]" />
          <span>
            <span className="block font-bold">Read instructions aloud</span>
            <span className="block text-base text-[#4f6970]">Switch this off if you use TalkBack or VoiceOver, so two voices don&apos;t talk at once.</span>
          </span>
        </label>

        <button type="submit" className={`${BUTTON.base} ${BUTTON.primary} min-h-20 text-2xl`}>
          Save
        </button>
      </form>
    </main>
  );
}
