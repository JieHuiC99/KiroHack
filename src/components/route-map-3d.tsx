"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { floors, getFloor, toMetres, toMetresLength } from "@/lib/floor/building";
import type { Floor, Point, Rect, Room, RoutePoint, Turn } from "@/lib/floor/types";
import { turnBetween } from "@/lib/floor/routing";

/**
 * "Your way out" map: one floor at a time in 3D with the route drawn on top, a blue "You are here"
 * pin, the first turn and the exit. Drag rotates, pinch zooms, "Show full route" puts the camera back.
 * Labels are HTML laid over the canvas and placed every frame so they never sit on the orange line.
 * The canvas is aria-hidden: the page lists the same directions as text.
 */

type Props = {
  route: RoutePoint[];
  startFloorId: string;
  startRoomId: string;
  shownFloorId: string;
  onShowFloor: (floorId: string) => void;
  /** Text on the blue start pin. */
  hereLabel?: string;
  /** Text on the end of the line on the starting floor. */
  exitLabel?: string;
  /** Staircases the emergency team has marked unusable: drawn dark red and labelled. */
  blockedStairIds?: string[];
  /** People waiting for help, pinned to their room on whichever floor has that room. */
  pins?: MapPin[];
  className?: string;
};

export type MapPin = { id: string; roomId: string; label: string };

const COLOURS = {
  background: 0x1e4a55,
  corridor: 0xf4efe6,
  field: 0x9ccb8e,
  edge: 0xb89466,
  route: 0xff7a1a,
  here: 0x2f6fed,
  room: { room: 0xe8cfa6, office: 0xdcc096, toilet: 0xc9dceb, stairs: 0xa8dcc0, bombaLift: 0xf2a7a7, lift: 0xd5dbd9 } satisfies Record<Room["kind"], number>,
  startRoom: 0xa9c5f5,
  blocked: 0xb42318,
  pin: 0xd92d20,
};
const WALL = 1.0; // low walls, so they never hide the route in the corridor
const RIBBON = 2.0; // route width, metres
const ARROW_SPACING = 4.5;
const ARROW_SPEED = 2.2;
const VIEW = new THREE.Vector3(0.42, 0.78, 0.55).normalize(); // from the south-east, looking down at about 50°: the route runs corner to corner

const centreOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const world = (floor: Floor, p: Point, y = 0) => {
  const { x, z } = toMetres(floor, p);
  return new THREE.Vector3(x, y, z);
};
const shortLabel = (f: Floor) => (f.label.startsWith("Level ") ? `L${f.label.slice(6)}` : f.label[0]);

type Tone = "here" | "turn" | "exit" | "stairs" | "blocked" | "pin" | "room";
type Label = { id: string; text: string; tone: Tone; at: THREE.Vector3 };
type Flow = { mesh: THREE.Object3D; from: THREE.Vector3; dir: THREE.Vector3; length: number; offset: number };

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) m.dispose();
  });
}

function buildFloor(floor: Floor, startRoomId: string | null, blocked: Set<string>, pins: MapPin[]) {
  const group = new THREE.Group();
  const plate = new THREE.MeshStandardMaterial({ color: COLOURS.corridor });
  for (const r of [...floor.corridors, ...floor.rooms]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(toMetresLength(floor, r.w), 0.8, toMetresLength(floor, r.h)), plate);
    m.position.copy(world(floor, centreOf(r), -0.4));
    group.add(m);
  }
  if (floor.field) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(toMetresLength(floor, floor.field.w), 0.8, toMetresLength(floor, floor.field.h)),
      new THREE.MeshStandardMaterial({ color: COLOURS.field }),
    );
    m.position.copy(world(floor, centreOf(floor.field), -0.3));
    group.add(m);
  }
  const edge = new THREE.LineBasicMaterial({ color: COLOURS.edge });
  for (const room of floor.rooms) {
    const colour = blocked.has(room.id) ? COLOURS.blocked : room.id === startRoomId ? COLOURS.startRoom : COLOURS.room[room.kind];
    const g = new THREE.BoxGeometry(Math.max(toMetresLength(floor, room.w) - 0.4, 0.5), WALL, Math.max(toMetresLength(floor, room.h) - 0.4, 0.5));
    const box = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: colour }));
    box.position.copy(world(floor, centreOf(room), WALL / 2));
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(g), edge);
    lines.position.copy(box.position);
    group.add(box, lines);
  }
  const red = new THREE.MeshStandardMaterial({ color: COLOURS.pin, emissive: COLOURS.pin, emissiveIntensity: 0.4 });
  for (const pin of pins) {
    const room = floor.rooms.find((r) => r.id === pin.roomId);
    if (!room) continue;
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 20), red);
    head.position.copy(world(floor, centreOf(room), 4));
    const stem = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 14), red);
    stem.rotation.x = Math.PI;
    stem.position.copy(world(floor, centreOf(room), 2));
    group.add(head, stem);
  }
  return group;
}

function chevron() {
  const s = new THREE.Shape();
  // Points along +y; laid flat and turned to the direction of travel below.
  s.moveTo(0, 0.75);
  s.lineTo(0.75, -0.25);
  s.lineTo(0.4, -0.25);
  s.lineTo(0, 0.3);
  s.lineTo(-0.4, -0.25);
  s.lineTo(-0.75, -0.25);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/** The stretch of route on this floor, its markers and the labels that go with them. */
function buildRoute(shown: Floor, full: RoutePoint[], startFloorId: string, turnText: (t: Turn) => string, names: { here: string; exit?: string }) {
  const group = new THREE.Group();
  const flows: Flow[] = [];
  const pulsing: THREE.Object3D[] = [];
  const labels: Label[] = [];
  const onFloor = full.filter((p) => p.floorId === shown.id);
  const pts = onFloor.map((p) => world(shown, p, 0.15));
  if (pts.length === 0) return { group, flows, pulsing, labels, pts };

  const orange = new THREE.MeshStandardMaterial({ color: COLOURS.route, emissive: COLOURS.route, emissiveIntensity: 0.35 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const arrowGeometry = chevron();

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const length = a.distanceTo(b);
    if (length < 0.01) continue;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(RIBBON, 0.3, length + RIBBON), orange);
    leg.position.copy(a).add(b).multiplyScalar(0.5);
    leg.lookAt(b);
    group.add(leg);

    const dir = b.clone().sub(a).normalize();
    const count = Math.max(1, Math.floor(length / ARROW_SPACING));
    for (let n = 0; n < count; n++) {
      const arrow = new THREE.Mesh(arrowGeometry, white);
      // Tilt flat (tip now faces -z), then turn the tip towards the exit.
      arrow.rotation.set(-Math.PI / 2, Math.atan2(-dir.x, -dir.z), 0, "YXZ");
      arrow.scale.setScalar(1.3);
      group.add(arrow);
      flows.push({ mesh: arrow, from: a.clone().setY(0.32), dir, length, offset: (n * length) / count });
    }
  }

  const isLastFloor = onFloor[onFloor.length - 1] === full[full.length - 1];
  const isStartFloor = shown.id === startFloorId;
  const start = pts[0];
  const end = pts[pts.length - 1];

  if (isStartFloor) {
    // Blue pin: a ball on a short stem, plus a pulsing ring on the floor.
    const blue = new THREE.MeshStandardMaterial({ color: COLOURS.here, emissive: COLOURS.here, emissiveIntensity: 0.4 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 24), blue);
    head.position.copy(start).setY(4.2);
    const stem = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 16), blue);
    stem.rotation.x = Math.PI;
    stem.position.copy(start).setY(2.2);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.1, 32), new THREE.MeshBasicMaterial({ color: COLOURS.here, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(start).setY(0.35);
    group.add(head, stem, ring);
    pulsing.push(ring);
    labels.push({ id: "here", text: names.here, tone: "here", at: start.clone().setY(5.5) });
  } else if (pts.length > 1) {
    labels.push({ id: "stairs-in", text: "From the stairs", tone: "stairs", at: start.clone().setY(1) });
  }

  if (onFloor.length > 2) {
    const t = turnBetween(
      { x: onFloor[1].x - onFloor[0].x, y: onFloor[1].y - onFloor[0].y },
      { x: onFloor[2].x - onFloor[1].x, y: onFloor[2].y - onFloor[1].y },
    );
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.35, 28), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    disc.position.copy(pts[1]).setY(0.35);
    group.add(disc);
    labels.push({ id: "turn", text: turnText(t), tone: "turn", at: pts[1].clone().setY(1) });
  }

  if (pts.length === 1) {
    // One point left: either a floor you only pass through on the stairs, or you have arrived.
    labels.push(
      isLastFloor
        ? { id: "pass", text: "You have arrived", tone: "exit", at: start.clone().setY(4.5) }
        : { id: "pass", text: "Keep going down", tone: "stairs", at: start.clone().setY(1) },
    );
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.2, 32), new THREE.MeshBasicMaterial({ color: COLOURS.route, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(start).setY(0.4);
    group.add(ring);
    pulsing.push(ring);
  } else {
    // Exit post: an orange beacon standing at the end of the line.
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.5, 20), orange);
    post.position.copy(end).setY(1.75);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 }));
    cap.position.copy(end).setY(3.8);
    group.add(post, cap);
    pulsing.push(cap);
    labels.push({ id: "exit", text: isStartFloor && names.exit ? names.exit : isLastFloor ? "Exit · assembly point" : "Exit", tone: "exit", at: end.clone().setY(4.5) });
  }
  return { group, flows, pulsing, labels, pts };
}

function roomLabels(floor: Floor, startRoomId: string | null, blocked: Set<string>, pins: MapPin[]): Label[] {
  const pinned: Label[] = pins.flatMap((pin) => {
    const room = floor.rooms.find((r) => r.id === pin.roomId);
    return room ? [{ id: `pin-${pin.id}`, text: pin.label, tone: "pin" as const, at: world(floor, centreOf(room), 5.5) }] : [];
  });
  const named: Label[] = floor.rooms
    .filter((r) => r.name && r.id !== startRoomId && (r.kind === "room" || r.kind === "stairs" || r.kind === "bombaLift"))
    .map((r) =>
      blocked.has(r.id)
        ? { id: r.id, text: "Blocked", tone: "blocked" as const, at: world(floor, centreOf(r), WALL + 0.2) }
        : { id: r.id, text: r.kind === "stairs" ? "Stairs" : r.kind === "bombaLift" ? "Bomba lift" : r.name, tone: "room" as const, at: world(floor, centreOf(r), WALL + 0.2) },
    );
  // Key labels first: the layout places them before ordinary room names.
  return [...pinned, ...named.filter((l) => l.tone === "blocked"), ...named.filter((l) => l.tone === "room")];
}

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Does the segment pass through the box? Liang–Barsky clip. */
function segmentHits(p: THREE.Vector2, q: THREE.Vector2, b: Box) {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const edges: [number, number][] = [
    [-dx, p.x - b.x],
    [dx, b.x + b.w - p.x],
    [-dy, p.y - b.y],
    [dy, b.y + b.h - p.y],
  ];
  for (const [pp, qq] of edges) {
    if (pp === 0) {
      if (qq < 0) return false;
      continue;
    }
    const r = qq / pp;
    if (pp < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

type SceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  flows: Flow[];
  pulsing: THREE.Object3D[];
  routePts: THREE.Vector3[];
  dirty: boolean;
  tween: { from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; start: number } | null;
  home: { pos: THREE.Vector3; target: THREE.Vector3 } | null;
};

/** Where the camera goes to fit the box, leaving room for the controls over the top and bottom edges. */
function framing(camera: THREE.PerspectiveCamera, box: THREE.Box3, heightPx: number) {
  const target = box.getCenter(new THREE.Vector3());
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), VIEW).normalize();
  const up = new THREE.Vector3().crossVectors(VIEW, right);
  const usable = Math.max(0.4, (heightPx - 130) / Math.max(heightPx, 1));
  const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * usable;
  const horizontal = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect * 0.9;
  let distance = 20;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const c = new THREE.Vector3(x, y, z).sub(target);
        const depth = c.dot(VIEW);
        distance = Math.max(distance, depth + Math.abs(c.dot(right)) / horizontal, depth + Math.abs(c.dot(up)) / vertical);
      }
  // Nudge the target down a little so the top label row and the floor buttons both have space.
  return { pos: target.clone().addScaledVector(VIEW, distance * 1.05), target };
}

export function RouteMap3D({
  route,
  startFloorId,
  startRoomId,
  shownFloorId,
  onShowFloor,
  hereLabel = "You are here",
  exitLabel,
  blockedStairIds = [],
  pins = [],
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState>(null);
  const labelRefs = useRef(new Map<string, HTMLSpanElement>());
  const floorTagRef = useRef<HTMLParagraphElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const floorsRef = useRef<HTMLDivElement>(null);
  const [resetCount, setResetCount] = useState(0);
  const shown = getFloor(shownFloorId) ?? floors[floors.length - 1];
  const startRoom = shown.id === startFloorId ? startRoomId : null;

  const turnText = (t: Turn) => (t === "straight" ? "Go straight" : t === "back" ? "Turn around" : `Turn ${t}`);
  // Keyed by value: live screens pass new arrays on every poll.
  const routeKey = JSON.stringify(route);
  const blockedKey = blockedStairIds.join(",");
  const pinsKey = JSON.stringify(pins);
  const extras = useMemo(
    () => ({ blocked: new Set(blockedKey ? blockedKey.split(",") : []), pins: JSON.parse(pinsKey) as MapPin[] }),
    [blockedKey, pinsKey],
  );
  const built = useMemo(() => {
    const r = JSON.parse(routeKey) as RoutePoint[];
    return {
      ...buildRoute(shown, r, startFloorId, turnText, { here: hereLabel, exit: exitLabel }),
      rooms: roomLabels(shown, startRoom, extras.blocked, extras.pins),
    };
  }, [shown, routeKey, startFloorId, startRoom, hereLabel, exitLabel, extras]);
  const labels = useMemo(() => [...built.labels, ...built.rooms], [built]);
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
    if (stateRef.current) stateRef.current.dirty = true;
  }, [labels]);

  // Renderer, camera, controls, render loop: once.
  useEffect(() => {
    const mount = mountRef.current;
    const wrap = wrapRef.current;
    if (!mount || !wrap) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLOURS.background);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa8a8, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(50, 200, 120);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false; // one finger rotates, two fingers zoom: nothing else to learn
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.maxPolarAngle = 1.3;
    controls.minDistance = 15;
    controls.maxDistance = 600;

    const state: SceneState = { scene, camera, controls, renderer, flows: [], pulsing: [], routePts: [], dirty: true, tween: null, home: null };
    stateRef.current = state;
    controls.addEventListener("change", () => (state.dirty = true));
    controls.addEventListener("start", () => {
      state.tween = null;
      controls.enableDamping = true;
    });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      state.dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const v = new THREE.Vector3();
    const layout = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      const toScreen = (p: THREE.Vector3) => {
        v.copy(p).project(camera);
        return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, behind: v.z > 1 };
      };
      const segs = state.routePts.map((p) => toScreen(p)).map((s) => new THREE.Vector2(s.x, s.y));
      const wrapRect = wrap.getBoundingClientRect();
      const blocked: Box[] = [floorTagRef.current, resetRef.current, floorsRef.current]
        .flatMap((el) => (el ? [el.getBoundingClientRect()] : []))
        .map((r) => ({ x: r.left - wrapRect.left - 4, y: r.top - wrapRect.top - 4, w: r.width + 8, h: r.height + 8 }));
      const hitsRoute = (b: Box) => {
        const grown = { x: b.x - 6, y: b.y - 6, w: b.w + 12, h: b.h + 12 };
        if (segs.length === 1) return overlap(grown, { x: segs[0].x - 8, y: segs[0].y - 8, w: 16, h: 16 });
        for (let i = 1; i < segs.length; i++) if (segmentHits(segs[i - 1], segs[i], grown)) return true;
        return false;
      };
      const placed: Box[] = [];
      const inView = (b: Box) => b.x >= 2 && b.y >= 2 && b.x + b.w <= w - 2 && b.y + b.h <= h - 2;

      for (const label of labelsRef.current) {
        const el = labelRefs.current.get(label.id);
        if (!el) continue;
        const s = toScreen(label.at);
        const lw = el.offsetWidth;
        const lh = el.offsetHeight;
        const isKey = label.tone !== "room";
        // Above, right, left, below, then the diagonals; a second ring further out if the first is full.
        const around = (gap: number): Box[] => [
          { x: s.x - lw / 2, y: s.y - lh - gap, w: lw, h: lh },
          { x: s.x + gap, y: s.y - lh / 2, w: lw, h: lh },
          { x: s.x - lw - gap, y: s.y - lh / 2, w: lw, h: lh },
          { x: s.x - lw / 2, y: s.y + gap, w: lw, h: lh },
          { x: s.x + gap * 0.6, y: s.y - lh - gap, w: lw, h: lh },
          { x: s.x - lw - gap * 0.6, y: s.y - lh - gap, w: lw, h: lh },
          { x: s.x + gap * 0.6, y: s.y + gap, w: lw, h: lh },
          { x: s.x - lw - gap * 0.6, y: s.y + gap, w: lw, h: lh },
        ];
        const candidates: Box[] = isKey ? [...around(10), ...around(30)] : [{ x: s.x - lw / 2, y: s.y - lh / 2, w: lw, h: lh }];
        const clear = (b: Box) => inView(b) && !blocked.some((c) => overlap(b, c)) && !placed.some((c) => overlap(b, c));
        let pick = s.behind ? undefined : candidates.find((b) => clear(b) && !hitsRoute(b));
        // Route markers must always show: next best is a spot that only touches the line, then clamp into view.
        const mustShow = label.tone === "here" || label.tone === "turn" || label.tone === "exit" || label.tone === "stairs";
        if (!pick && mustShow && !s.behind) {
          const b = candidates.find(clear) ?? candidates[0];
          pick = { ...b, x: Math.min(Math.max(b.x, 4), w - b.w - 4), y: Math.min(Math.max(b.y, 4), h - b.h - 4) };
        }
        if (pick) {
          placed.push(pick);
          el.style.transform = `translate(${Math.round(pick.x)}px, ${Math.round(pick.y)}px)`;
          el.style.visibility = "visible";
        } else {
          el.style.visibility = "hidden";
        }
      }
    };

    renderer.setAnimationLoop((time) => {
      if (state.tween) {
        const t = Math.min(1, (time - state.tween.start) / 550);
        const e = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(state.tween.from, state.tween.to, e);
        controls.target.lerpVectors(state.tween.fromT, state.tween.toT, e);
        state.dirty = true;
        if (t >= 1) {
          state.tween = null;
          controls.enableDamping = true;
        }
      }
      const pulse = 1 + 0.22 * Math.sin(time / 200);
      for (const o of state.pulsing) o.scale.setScalar(pulse);
      for (const f of state.flows) f.mesh.position.copy(f.from).addScaledVector(f.dir, (f.offset + (time / 1000) * ARROW_SPEED) % f.length);
      controls.update();
      renderer.render(scene, camera);
      if (state.dirty) {
        state.dirty = false;
        layout();
      }
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      dispose(scene);
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, []);

  // Floor model + route on it.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const model = buildFloor(shown, startRoom, extras.blocked, extras.pins);
    state.scene.add(model, built.group);
    state.flows = built.flows;
    state.pulsing = built.pulsing;
    state.routePts = built.pts;
    state.dirty = true;
    return () => {
      state.scene.remove(model, built.group);
      dispose(model);
      dispose(built.group);
    };
  }, [shown, startRoom, built, extras]);

  // Camera: fit this floor's part of the route (start, turn and exit together), with some floor around it.
  useEffect(() => {
    const state = stateRef.current;
    const mount = mountRef.current;
    if (!state || !mount) return;
    const box = new THREE.Box3();
    if (built.pts.length > 1) {
      box.setFromPoints(built.pts);
      box.expandByVector(new THREE.Vector3(5, 0, 6));
      box.max.y = 6; // the pin and labels stand above the floor
    } else {
      for (const r of [...shown.corridors, ...shown.rooms]) {
        box.expandByPoint(world(shown, { x: r.x, y: r.y }));
        box.expandByPoint(world(shown, { x: r.x + r.w, y: r.y + r.h }, WALL));
      }
    }
    const view = framing(state.camera, box, mount.clientHeight);
    state.home = view;
    if (resetCount === 0 && state.camera.position.lengthSq() === 0) {
      state.camera.position.copy(view.pos);
      state.controls.target.copy(view.target);
    } else {
      // Damping off while flying, or the spin left over from the last drag carries the camera past its mark.
      state.controls.enableDamping = false;
      state.tween = { from: state.camera.position.clone(), to: view.pos, fromT: state.controls.target.clone(), toT: view.target, start: performance.now() };
    }
    state.dirty = true;
  }, [shown, built, resetCount]);

  const routeFloors = new Set(route.map((p) => p.floorId));
  const showFullRoute = () => {
    if (shownFloorId !== startFloorId) onShowFloor(startFloorId);
    setResetCount((n) => n + 1);
  };

  return (
    <div ref={wrapRef} className={`relative isolate overflow-hidden rounded-[28px] bg-[#1e4a55] ${className ?? "h-96"}`}>
      <div ref={mountRef} aria-hidden="true" data-testid="route-map-3d" className="absolute inset-0" />

      {/* Labels: positioned by the render loop. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {labels.map((l) => (
          <span
            key={`${shown.id}:${l.id}`}
            ref={(el) => {
              if (el) labelRefs.current.set(l.id, el);
              else labelRefs.current.delete(l.id);
            }}
            style={{ visibility: "hidden" }}
            className={`absolute top-0 left-0 whitespace-nowrap will-change-transform ${
              l.tone === "here"
                ? "rounded-full bg-[#2f6fed] px-3 py-1 text-[13px] font-bold text-white shadow-md ring-2 ring-white"
                : l.tone === "exit"
                  ? "rounded-full bg-[#ff7a1a] px-3 py-1 text-[13px] font-bold text-white shadow-md ring-2 ring-white"
                  : l.tone === "turn"
                    ? "rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-[#17323a] shadow"
                    : l.tone === "stairs"
                      ? "rounded-full bg-[#dff3e8] px-2.5 py-0.5 text-[12px] font-semibold text-[#14532d]"
                      : l.tone === "pin"
                        ? "rounded-full bg-[#d92d20] px-3 py-1 text-[13px] font-bold text-white shadow-md ring-2 ring-white"
                        : l.tone === "blocked"
                          ? "rounded-md bg-[#b42318] px-2 py-0.5 text-[12px] font-bold text-white"
                          : "max-w-28 truncate rounded-md bg-[#17323a]/70 px-1.5 py-0.5 text-[11px] font-medium text-white/95"
            }`}
          >
            {l.text}
          </span>
        ))}
      </div>

      <p ref={floorTagRef} className="pointer-events-none absolute top-3 left-3 rounded-full bg-[#0f2a31]/80 px-3 py-1 text-sm font-semibold text-white">
        {shown.label}
      </p>
      <button
        ref={resetRef}
        type="button"
        onClick={showFullRoute}
        className="absolute top-2.5 right-2.5 flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold text-[#17323a] shadow-md active:scale-95"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
        Show full route
      </button>
      <div ref={floorsRef} role="group" aria-label="Floor shown on the map" className="absolute inset-x-0 bottom-3 mx-auto flex w-fit justify-center gap-1.5 px-2">
        {floors.map((f) => {
          const isShown = f.id === shown.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={isShown}
              aria-label={`${f.label}${routeFloors.has(f.id) ? ", on your route" : ""}${f.id === startFloorId ? ", you are here" : ""}`}
              onClick={() => onShowFloor(f.id)}
              className={`relative min-h-11 min-w-11 rounded-xl px-2 text-[15px] font-extrabold transition-colors ${
                isShown ? "bg-[#ffd84d] text-[#3d2c00] shadow-md" : "bg-[#0f2a31]/85 text-white"
              }`}
            >
              {shortLabel(f)}
              {routeFloors.has(f.id) && !isShown ? (
                <span aria-hidden="true" className={`absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full border border-white ${f.id === startFloorId ? "bg-[#2f6fed]" : "bg-[#ff7a1a]"}`} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
