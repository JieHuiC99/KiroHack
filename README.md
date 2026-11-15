# SafeWay

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
| `/me` | Students and staff (phone) | One-time setup, then a 3D map with moving arrows: your floor to the best open staircase, **one floor at a time** on the way down (Continue to Level 2, Level 1, …), then across the ground floor to the field. The floor buttons on the map (G, M, L1, L2, L3) show any other level; the next step brings the map back to you. A turn arrow with each written step, Next step / Repeat / I need help, "I'm safe" check-in. Blind profile: same steps as audio + vibration with three full-width buttons and no map |
| `/responder` | Helpers (phone) | Buzzes on new or escalated requests, Accept, 3D map of the fire floor with the person's waiting point, Mark evacuated |
| `/dashboard` | Emergency team (laptop) | Simulate the alarm, block staircases (every phone re-routes), live 3D map with pins and a floor switcher, escalation banner, headcount |

## Run it

```bash
cp .env.example .env          # then set BETTER_AUTH_SECRET (npx auth@latest secret)
npm install
npm run setup                 # Docker Postgres + tables
npm run dev                   # http://localhost:3000
```

No Docker? Point `DATABASE_URL` in `.env` and `.env.test` at any Postgres that has `app` and `app_test` databases,
then run `npm run auth:migrate && npm run auth:migrate:test && npm run db:seed`.

To try it on real phones, deploy to Vercel (or run `npm run build && npm start` and open
`http://<laptop-ip>:3000` on the same Wi-Fi). `npm run db:seed` resets the demo state.

```bash
npm run lint && npm run typecheck
npm test                      # unit: routing + floor data
npm run test:integration      # services against real Postgres
npm run test:e2e              # the demo, end to end (needs: npx playwright install chromium)
```

## Demo script (about 90 seconds)

1. Phone A: `/me` → set up as **wheelchair**, room UC-3-4. Phone B: `/me` → default profile (sees the map), room UC-3-3. Phone C: `/responder`.
2. Laptop: `/dashboard` → **Simulate fire alarm**. Both phones vibrate and speak.
3. Phone B: follow the arrows to the staircase, then **Continue to Level 2 … Ground**, out to the field, and check in safe.
4. Laptop (while Phone B is still on Level 3): tick that staircase as blocked → Phone B's arrows switch to another staircase.
5. Phone A: **I need help** → pin appears on the 3D map. Wait 15 s → "ESCALATED", 30 s → marshal banner.
6. Phone C: **Accept** → Phone A says who is coming. Then **Mark evacuated**.

## Where things are

- `src/lib/floor/level3.ts` — Level 3 in full: rooms, corridors, doors, walkways, staircases.
- `src/lib/floor/lower-floors.ts` — Ground, Mezzanine, Level 1, Level 2 (shapes only) and the ground-floor
  walks from each staircase to the field (`groundExits`).
- `src/lib/floor/building.ts` — lists the floors, lines them up, and builds the full route
  (room → staircase → down each floor → field).
- `src/lib/floor/routing.ts` — shortest route on one floor + the written steps.
- `src/components/floor-map-3d.tsx` — Three.js model. Draws one floor at a time, never the stack; the floor buttons switch level and the camera fits the floor (or the route on it) to the screen, upright or sideways.
- `src/server/emergency.ts` — all business rules (alarm, help requests, escalation, check-in).
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
- People who can't use stairs are routed to a staircase landing to wait for a helper, never to a lift.
- The 3D map is `aria-hidden`; everything on it is also shown as text.

## Decisions

- **Polling (1.5 s) instead of WebSockets/MQTT**: runs unchanged on Vercel; nobody notices the delay.
- **One Next.js app instead of React Native + Electron + NestJS**: three pages, one deploy, 4-hour build.
- **No sign-in on the demo flows**: people type a name; anyone with the URL can trigger the alarm.
  Better Auth and `/sign-in` are still in the project. Before real use: add roles, `requireUser()` in
  `src/server/emergency.ts`, and guard `/dashboard` in `src/proxy.ts`.
- **Location = the room saved in setup**, not GPS/beacons. QR codes are hard to aim at when you can't
  see; NFC door tags are the planned next step.
- **Escalation is computed from waiting time** (`ESCALATION_SECONDS`, default 15), so no background job.
- **System fonts**: nothing to download during an emergency.
- **No AR, no desktop app, no offline database** in this cut.

## Known limits

- Vibration does not work in iPhone Safari. Demo on Android.
- Browsers only speak after the first tap on the page; the Save button in setup counts.
- Alerts only arrive while the page is open (no background push notifications yet).
- shadcn/ui was not initialised (the registry was unreachable when scaffolding). Plain Tailwind is used.
  Optional: `npx shadcn@latest init -d -y`.
- No migrations yet: before the first deploy, run `npm run db:generate -- src/db/migrations/Init` against an empty database and commit it.
