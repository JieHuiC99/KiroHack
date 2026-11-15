"use client";
import { useState } from "react";
import { speak } from "@/lib/client/announce";
import type { Floor } from "@/lib/floor/types";
import { selectableRooms } from "@/lib/floor/routing";
import type { Profile } from "@/lib/validation/emergency";

export type Settings = { name: string; profile: Profile; roomId: string; voice: boolean };

const PROFILE_OPTIONS: { value: Profile; label: string; hint: string }[] = [
  { value: "other", label: "I can see the screen and use stairs", hint: "3D map with arrows to the nearest staircase" },
  { value: "wheelchair", label: "I use a wheelchair or cannot use stairs", hint: "3D map, and a helper is sent to you" },
  { value: "blind", label: "I am blind or have low vision", hint: "Spoken and vibration guidance, no map" },
];

/** Filled in once, on a calm day. Nothing here has to be touched during an emergency. */
export function SetupForm({ floor, initial, onSave }: { floor: Floor; initial: Settings | null; onSave: (s: Settings) => void }) {
  const rooms = selectableRooms(floor);
  const [name, setName] = useState(initial?.name ?? "");
  const [profile, setProfile] = useState<Profile>(initial?.profile ?? "other");
  const [roomId, setRoomId] = useState(initial?.roomId ?? rooms[0]?.id ?? "");
  const [voice, setVoice] = useState(initial?.voice ?? false);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 p-4 text-lg sm:gap-8 sm:p-6 sm:text-xl">
      <h1 className="text-3xl font-bold">Set up SafeWay</h1>
      <form
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          const settings = { name: name.trim(), profile, roomId, voice };
          onSave(settings);
          // This tap also unlocks speech for the rest of the session (browsers require one).
          if (voice) speak("SafeWay is ready. You will hear instructions here if there is an emergency.");
        }}
      >
        <label className="flex flex-col gap-2 font-semibold">
          Your name
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border-2 border-black p-4 text-xl font-normal"
          />
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-semibold">In an emergency</legend>
          {PROFILE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-4 rounded-lg border-2 border-black p-4 has-checked:bg-black has-checked:text-white"
            >
              <input
                type="radio"
                name="profile"
                value={option.value}
                checked={profile === option.value}
                onChange={() => {
                  setProfile(option.value);
                  setVoice(option.value === "blind"); // sensible default; the checkbox below can override it
                }}
                className="size-6"
              />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-lg">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-2 font-semibold">
          Room you are usually in ({floor.building}, {floor.label})
          <select
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className="rounded-lg border-2 border-black bg-white p-4 text-xl font-normal text-black"
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-start gap-4 rounded-lg border-2 border-black p-4">
          <input type="checkbox" checked={voice} onChange={(event) => setVoice(event.target.checked)} className="mt-1 size-6" />
          <span>
            <span className="block font-semibold">Read instructions aloud</span>
            <span className="block text-lg">Switch this off if you use TalkBack or VoiceOver, so two voices don&apos;t talk at once.</span>
          </span>
        </label>

        <button type="submit" className="min-h-20 rounded-xl bg-black p-4 text-2xl font-bold text-white">
          Save
        </button>
      </form>
    </main>
  );
}
