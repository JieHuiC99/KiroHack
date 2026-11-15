# SunSafe

Accessible evacuation guidance for campus emergencies. Hackathon prototype (Disaster Recovery theme),
modelled on the Sunway University building: Ground, Mezzanine and Levels 1 to 3 in 3D, one floor at a time,
with the field as the assembly point.

> ⚠ **Prototype only.** Every floor was traced by hand from screenshots of the campus app. Room shapes and
> the scale are approximate. The four corner stair blocks are **assumed** to be the fire staircases, and the
> ground-floor walk from each staircase to the field is a **guess** (the app map does not show exit doors).
> Do not use it for a real evacuation until every route is checked against the posted evacuation plans
> and confirmed with the Health & Safety Office.

## Screens

| URL | For | What it does |
|---|---|---|
| `/` | Emergency administrator | Opens the control dashboard immediately |
| `/me` | Students and staff (phone) | One-time setup, then a 3D map with moving arrows: your floor to the best open staircase, **one floor at a time** on the way down (Continue to Level 2, Level 1, …), then across the ground floor to the field. The floor buttons on the map (G, M, L1, L2, L3) show any other level; the next step brings the map back to you. A turn arrow with each written step, Next step / Repeat / I need help, "I'm safe" check-in. Blind profile: same steps as audio + vibration with three full-width buttons and no map |
| `/responder` | Helpers (phone) | Buzzes on new or escalated requests, Accept, 3D map of the fire floor with the person's waiting point, Mark evacuated |
| `/monitor` | Emergency team (laptop) | Which teaching venues (UC, UE, UW, lecture theatres, JCs) have a class right now and what it is; during an alarm, which rooms have acknowledged, a CCTV tile per room, **Repeat siren** and **Room is empty** |
| `/classroom/<venue>` | Classroom computer | Quiet until the alarm; then a full-screen alert and siren that stay until someone presses **I'll evacuate right now**. Comes back if the team repeats the siren |
| `/dashboard` | Emergency team (laptop) | Simulate the alarm, block staircases (every phone re-routes), live 3D map with pins and a floor switcher, escalation banner, headcount |

## Run it

```bash
cp .env.example .env          # database defaults; no auth secret, email lists or device key needed
npm install
npm run setup                 # Docker Postgres + emergency tables (resets demo state)
npm run dev                   # http://localhost:3000
```

No Docker? Point `DATABASE_URL` in `.env` and `.env.test` at any Postgres that has `app` and `app_test` databases,
then run `npm run db:seed` with `DB_SYNC=true` for local table creation.

To try it on real phones, deploy to Vercel (or run `npm run build && npm start` and open
`http://<laptop-ip>:3000` on the same Wi-Fi). `npm run db:seed` resets the demo state.

```bash
npm run lint && npm run typecheck
npm test                      # unit: routing + floor data
npm run test:integration      # services against real Postgres
npm run test:e2e              # the demo, end to end (needs: npx playwright install chromium)
```

## Default role

Every screen uses one shared **Emergency administrator** identity. Opening `/` goes directly to
`/dashboard`. There are no accounts, passwords, session cookies, role switches or classroom device keys.
The dashboard links to all demo screens, including camera routes and venue monitoring.

On `/me`, choose the room and accessibility preferences for this visit. These are guidance settings,
not a role or an account. Help requests and check-ins use the shared administrator identity across devices.
All demo controls are public; this prototype does not provide production access control.

## Camera arrows

On `/me` during an alarm, **Camera arrows** swaps the 3D map for the phone camera with an arrow lying on the
floor ahead, turning as the phone turns (green when you face the right way) and the distance to the next turn.

What it is: the phone's compass plus the route from the map. What it is not: it does not recognise the corridor
in the picture and does not know where you are standing, so **Next step** is still pressed at each checkpoint.
Real visual positioning indoors needs the building scanned in advance (or markers on the walls) and is not
something a web page can do reliably in a fire. The picture never leaves the phone.

- Needs HTTPS (or `localhost`): browsers refuse the camera and compass on plain `http://<laptop-ip>`.
- The map's "up" is assumed to be north, which is unverified. If the arrow is off, face along the route and press
  **Arrow wrong?**: the correction is remembered on that phone.
- No compass (laptops) or permission refused: the arrow shows the turn for the current step instead.

### Landmark route with QR codes: Lecture Theatre 5 to the Green zone

`/guide/lt5-green-zone` is a second kind of camera route, for places the floor map can't route yet. It is a
chain of eight landmarks (LT5 sign → Gallery sign → ocean poster → staircase 1 → M → G → exit door → Green
zone), each with a photo, a spoken instruction and a QR code on the wall.

- Point the camera at a landmark's QR code and the route jumps to that checkpoint, so the app knows where you
  are without typing. Scanning also means you are facing the landmark, so that compass reading fixes which way
  "turn right from here" really is, and the arrow then stays put as the phone turns.
- The codes are plain links (`/guide/lt5-green-zone?at=<checkpoint>`), so the phone's own camera app opens
  the guide at the right checkpoint too. In-page scanning needs Chrome on Android; on iPhone use the camera
  app or the **I've reached** button.
- The disaster recovery team prints the codes from `/guide/lt5-green-zone/print`. Print from the address
  people will really use: the codes point back to wherever the page was opened.
- The route is in `src/lib/landmark-routes.ts`. It was written from eight photos and the walker's answers, so
  walk it once with the app before relying on it.

## Who goes where

The floor plans follow the fire plans posted on Levels 1 to 3, and the map key shows the same three things:

- **Emergency staircase** (green): everyone who can walk. The route goes down floor by floor to the field.
- **Bomba lift** (red with a white cross): people who can't use stairs. They are routed to the nearest Bomba
  lift to wait; a helper or the fire crew rides down with them, then the route carries on from the ground floor.
  If both Bomba lifts are reported blocked, they wait on a staircase landing instead.
- **Ordinary lift** (grey): never used in a fire.

The arrows only show the way still to go: each **Next step** moves the "You" marker to the next checkpoint and
removes the trail behind it.

## Classroom alert: startup script, not a desktop app

A web page on its own can't do this job: it can't open itself, can't come in front of a lecturer's slides, and
browsers won't play sound until the page has been clicked. A full desktop app (Electron or similar) would work
but is far more than is needed. What is needed is one small thing running on the PC, so `desktop/` has a
Windows startup script instead:

```powershell
# once per classroom PC; no admin rights, nothing to install
powershell -ExecutionPolicy Bypass -File desktop\install-startup.ps1 -Server https://<your-safeway-address> -Venue uc-3-3
```

It adds a shortcut to the user's Startup folder. From then on `safeway-classroom-agent.ps1` runs hidden after
every login, asks `GET /api/venues/<venue>` every 3 seconds, and when the room has an unanswered alarm opens
`/classroom/<venue>` full-screen in Edge (kiosk mode, sound allowed). When the button is pressed it closes the
window; if the emergency team presses **Repeat siren** it opens again. `-Remove` uninstalls it.

Without the script, `/classroom/<venue>` still works in any browser tab that is left open. No device key is
needed; the siren needs one click on the page first ("Test the siren" does it).

### Sounding the siren, step by step

1. Open `/dashboard`; the Emergency administrator role is already selected.
2. Press **Simulate fire alarm**. Every registered classroom screen goes full-screen red with the siren.
3. In the classroom, someone presses **I'll evacuate right now…**: the siren stops there.
4. Open `/monitor`, find the room, **View CCTV**. Still people inside? Press **Still occupied: repeat siren**
   and the alert and siren come back in that room. Empty? Press **Room is empty**.
5. **End emergency (all clear)** on the dashboard stops everything.

CCTV: set `NEXT_PUBLIC_CCTV_URL_TEMPLATE` (see `.env.example`) to an MJPEG or snapshot URL with `{venue}` in it
and the monitor shows the live picture. Without it the tile says no camera is connected. The class timetable in
`src/lib/venues.ts` is generated demo data.

## Demo script (about 90 seconds)

1. Open `/me` on a phone, choose the wheelchair preference and room UC-3-4. Open `/responder` on another device and `/dashboard` on the laptop. All use the shared administrator; no sign-in is needed. Use another `/me` window to demonstrate a stairs-capable route.
2. Laptop: `/dashboard` → **Simulate fire alarm**. Both phones vibrate and speak.
3. Phone B: follow the arrows to the staircase, then **Continue to Level 2 … Ground**, out to the field, and check in safe.
4. Laptop (while Phone B is still on Level 3): tick that staircase as blocked → Phone B's arrows switch to another staircase.
5. Phone A: **I need help** → pin appears on the 3D map. Wait 15 s → "ESCALATED", 30 s → marshal banner.
6. Phone C: **Accept** → Phone A says who is coming. Then **Mark evacuated**.
7. Second laptop: `/classroom/uc-3-4` shows the full-screen alert → press the button. First laptop: `/monitor` shows it acknowledged → **Still occupied: repeat siren** → the alert comes back.

## Where things are

- `src/lib/floor/level3.ts` — Level 3 in full: rooms, corridors, doors, walkways, staircases.
- `src/lib/floor/lower-floors.ts` — Ground, Mezzanine, Level 1, Level 2 (shapes only) and the ground-floor
  walks from each staircase to the field (`groundExits`).
- `src/lib/floor/building.ts` — lists the floors, lines them up, and builds the full route
  (room → staircase → down each floor → field).
- `src/lib/floor/routing.ts` — shortest route on one floor + the written steps.
- `src/components/floor-map-3d.tsx` — Three.js model. Draws one floor at a time, never the stack; the floor buttons switch level and the camera fits the floor (or the route on it) to the screen, upright or sideways.
- `src/server/emergency.ts` — all business rules (alarm, help requests, escalation, check-in).
- `src/lib/venues.ts`, `src/server/venues.ts` — teaching venues, the demo timetable, and classroom alerts (acknowledge, repeat siren, room empty).
- `desktop/` — the Windows startup script for classroom PCs.
- `src/app/api/*` — thin JSON routes; every screen polls `GET /api/state`.

**People can only pick a room on Level 3 for now.** To make another floor selectable, give its rooms
`door` points and add `walkways` (copy the pattern in `level3.ts`); the setup form and routing pick it up
from `routableFloors`. Each floor has its own `transform` because each screenshot had a different zoom.

## Accessibility rules we follow

- Status and instructions live in `aria-live` regions, so TalkBack/VoiceOver read them. The app's own
  voice can be switched off in setup so two voices don't overlap.
- Mobile-first layouts; on wider screens the map sits beside the controls.
- Emergency screen: large buttons, high contrast, text ≥ 24 px, no timeouts, nothing to type.
- Vibration cues: one buzz = left, two = right, long = arrived.
- People who can't use stairs are routed to a Bomba lift to wait for a helper, never to an ordinary lift, and are told not to ride alone.
- The 3D map is `aria-hidden`; everything on it is also shown as text.

## Decisions

- **Polling (1.5 s) instead of WebSockets/MQTT**: runs unchanged on Vercel; nobody notices the delay.
- **One Next.js app instead of React Native + Electron + NestJS**: three pages, one deploy, 4-hour build.
- **One default Emergency administrator role without authentication**: all demo screens and controls are available immediately.
- **Location = the room the person picks each visit**, not GPS/beacons, and it is not stored. QR codes are
  hard to aim at when you can't see; NFC door tags are the planned next step.
- **Escalation is computed from waiting time** (`ESCALATION_SECONDS`, default 15), so no background job.
- **System fonts**: nothing to download during an emergency.
- **Camera arrows use the compass, not computer vision**, and the classroom alert is a startup script, not a desktop app. No offline database in this cut.

## Known limits

- Vibration does not work in iPhone Safari. Demo on Android.
- Browsers only speak after the first tap on the page; the Save button in setup counts.
- Alerts only arrive while the page is open (no background push notifications yet).
- shadcn/ui was not initialised (the registry was unreachable when scaffolding). Plain Tailwind is used.
  Optional: `npx shadcn@latest init -d -y`.
- No migrations yet: before the first deploy, run `npm run db:generate -- src/db/migrations/Init` against an empty database and commit it.
