"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { floors, getFloor, toMetres, toMetresLength } from "@/lib/floor/building";
import type { Floor, Point, Rect, Room, RoutePoint } from "@/lib/floor/types";

export type MapPin = {
  id: string;
  roomId: string;
  label: string;
  tone: "pending" | "escalated" | "accepted" | "resolved";
};

type Props = {
  /** The floor the emergency is on: pins and the highlighted room are looked up here. */
  floor: Floor;
  /** Route to draw. It can cross floors: each point says which floor it is on. */
  route?: RoutePoint[];
  pins?: MapPin[];
  blockedStairIds?: string[];
  /** Room to colour as the person's own room. */
  highlightRoomId?: string;
  /** Where the person is on the route right now. Drawn as a blue "You" marker. */
  position?: RoutePoint;
  /** Points the camera should frame. Only the ones on the floor being shown count; with fewer than two, the whole floor is framed. */
  focus?: RoutePoint[];
  /** Floor to show. The map follows it when it changes; the floor buttons let people look at the others. Defaults to `floor`. */
  showFloorId?: string;
  /** Change this (the step number, say) to send the map back to `showFloorId` after someone has looked at another floor. */
  returnKey?: string | number;
  /** An alarm is active on `floor`: it is marked as the fire floor. */
  alarm?: boolean;
  className?: string;
};

const WALL_HEIGHT = 1.8; // low walls: rooms read as open boxes, like a doll's house
const ROOM_COLOURS: Record<Room["kind"], number> = {
  room: 0xd9b382,
  office: 0xb9763a,
  toilet: 0x2f5fb3,
  stairs: 0x1fa971,
  bombaLift: 0xdc2626,
  lift: 0x9fb8b0,
};
/** The same three colours, as CSS, for the key drawn over the map. */
const KEY = [
  { colour: "#1fa971", label: "Emergency stairs", cross: false },
  { colour: "#dc2626", label: "Bomba lift", cross: true },
  { colour: "#9fb8b0", label: "Lift: do not use", cross: false },
];
const PIN_COLOURS: Record<MapPin["tone"], number> = {
  pending: 0xe11d48,
  escalated: 0xe11d48,
  accepted: 0xf59e0b,
  resolved: 0x16a34a,
};
const SLAB_COLOUR = 0xe7e2da;
const FIELD_COLOUR = 0x4d8a1f;
const BLOCKED_COLOUR = 0x7f1d1d;
const ROUTE_COLOUR = 0xff6a00;
const HERE_COLOUR = 0x2563eb;
const MIN_VIEW_METRES = 40; // the camera never zooms in closer than this much floor
const ARROW_SPACING = 3.5; // metres between direction arrows
const ARROW_SPEED = 2.5; // metres per second

const centreOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function world(floor: Floor, p: Point, height = 0) {
  const { x, z } = toMetres(floor, p);
  // Only one floor is ever in the scene, so every floor sits at height 0.
  return new THREE.Vector3(x, height, z);
}

/** `onTop` labels show through walls and floors; the rest are hidden by whatever is in front of them. */
function textSprite(text: string, colour = "#111827", height = 2.2, onTop = false) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const font = "600 44px Arial, sans-serif";
  context.font = font;
  canvas.width = Math.ceil(context.measureText(text).width) + 32;
  canvas.height = 64;
  context.font = font;
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = colour;
  context.textBaseline = "middle";
  context.fillText(text, 16, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: !onTop }));
  sprite.scale.set((canvas.width / canvas.height) * height, height, 1);
  sprite.renderOrder = onTop ? 10 : 0;
  return sprite;
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      (material as THREE.SpriteMaterial).map?.dispose();
      material.dispose();
    }
  });
}

function slab(floor: Floor, rect: Rect, colour: number, thickness: number, top: number) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(toMetresLength(floor, rect.w), thickness, toMetresLength(floor, rect.h)),
    new THREE.MeshStandardMaterial({ color: colour }),
  );
  mesh.position.copy(world(floor, centreOf(rect), top - thickness / 2));
  return mesh;
}

/** One floor: its platform, rooms, staircases and (on the ground floor) the assembly field. */
function buildFloor(floor: Floor, active: Floor, blocked: Set<string>, highlightRoomId: string | undefined) {
  const group = new THREE.Group();

  // A solid plate under everything gives the level its "platform" look.
  for (const rect of [...floor.corridors, ...floor.rooms]) group.add(slab(floor, rect, SLAB_COLOUR, 1.2, 0));
  if (floor.field) {
    group.add(slab(floor, floor.field, FIELD_COLOUR, 1.2, 0.2));
    const label = textSprite("Assembly point", "#14532d", 6, true);
    label.position.copy(world(floor, centreOf(floor.field), 7));
    group.add(label);
  }

  for (const room of floor.rooms) {
    const isExit = room.kind === "stairs" || room.kind === "bombaLift";
    const isBlocked = isExit && blocked.has(room.id);
    const isHere = floor === active && room.id === highlightRoomId;
    const colour = isBlocked ? BLOCKED_COLOUR : isHere ? HERE_COLOUR : ROOM_COLOURS[room.kind];
    const geometry = new THREE.BoxGeometry(
      Math.max(toMetresLength(floor, room.w) - 0.3, 0.5),
      WALL_HEIGHT,
      Math.max(toMetresLength(floor, room.h) - 0.3, 0.5),
    );
    const box = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: colour }));
    box.position.copy(world(floor, centreOf(room), WALL_HEIGHT / 2));
    group.add(box);

    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x4b3a26 }));
    outline.position.copy(box.position);
    group.add(outline);

    // The Bomba lift carries the white cross it has on the posted fire plans, so it can't be taken for an ordinary lift.
    if (room.kind === "bombaLift") {
      const width = toMetresLength(floor, room.w) - 0.3;
      const depth = toMetresLength(floor, room.h) - 0.3;
      for (const angle of [Math.atan2(depth, width), -Math.atan2(depth, width)]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(width, depth) * 0.9, 0.12, 0.35), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        bar.position.copy(world(floor, centreOf(room), WALL_HEIGHT + 0.06));
        bar.rotation.y = angle;
        group.add(bar);
      }
    }

    if (room.name !== "" && (room.kind === "room" || isExit)) {
      const text = isBlocked ? `${room.name} — BLOCKED` : room.name;
      const colour = isBlocked ? "#7f1d1d" : room.kind === "stairs" ? "#065f46" : room.kind === "bombaLift" ? "#991b1b" : "#111827";
      const label = textSprite(text, colour, 2.2, isExit);
      label.position.copy(world(floor, centreOf(room), WALL_HEIGHT + 1.6));
      group.add(label);
    }
  }
  return group;
}

type Flow = { mesh: THREE.Object3D; from: THREE.Vector3; direction: THREE.Vector3; length: number; offset: number };

/** The part of the route, the "You" marker and the pins that are on the floor being shown. */
function buildOverlay(shown: Floor, active: Floor, fullRoute: RoutePoint[], pins: MapPin[], position: RoutePoint | undefined) {
  const group = new THREE.Group();
  const pulsing: THREE.Object3D[] = [];
  const flowing: Flow[] = [];
  // A route never returns to a floor it has left, so filtering keeps one continuous stretch.
  const route = fullRoute.filter((p) => p.floorId === shown.id);
  const points = route.map((p) => world(shown, p, 0.45));
  const endsHere = route.length > 0 && route[route.length - 1] === fullRoute[fullRoute.length - 1];

  if (points.length > 0) {
    const material = new THREE.MeshStandardMaterial({ color: ROUTE_COLOUR, emissive: ROUTE_COLOUR, emissiveIntensity: 0.5 });
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const length = a.distanceTo(b);
      if (length < 0.01) continue;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, length + 1.6), material);
      leg.position.copy(a).add(b).multiplyScalar(0.5);
      leg.lookAt(b);
      group.add(leg);

      // Arrowheads that slide along the leg in the direction of travel (including down the stairs).
      const direction = b.clone().sub(a).normalize();
      const from = a.clone().addScaledVector(up, 0.7);
      const count = Math.max(1, Math.floor(length / ARROW_SPACING));
      for (let n = 0; n < count; n++) {
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.8, 16), arrowMaterial);
        arrow.quaternion.setFromUnitVectors(up, direction);
        group.add(arrow);
        flowing.push({ mesh: arrow, from, direction, length, offset: (n * length) / count });
      }
    }

    const here = position?.floorId === shown.id ? world(shown, position, 1.2) : null;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 20, 20),
      here ? new THREE.MeshStandardMaterial({ color: HERE_COLOUR, emissive: HERE_COLOUR, emissiveIntensity: 0.6 }) : material,
    );
    marker.position.copy(here ?? points[0]);
    group.add(marker);
    if (here) {
      pulsing.push(marker);
      const label = textSprite("You", "#1d4ed8", 2.6, true);
      label.position.copy(here).y += WALL_HEIGHT + 1.8;
      group.add(label);
    }

    // Nothing left to walk on this floor, but the route carries on below: point down.
    if (points.length === 1 && !endsHere) {
      const down = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 20), arrowMaterial);
      down.rotation.x = Math.PI;
      down.position.copy(points[0]).y += WALL_HEIGHT + 3.4;
      group.add(down);
      pulsing.push(down);
      const label = textSprite("Go down from here", "#9a3412", 2.6, true);
      label.position.copy(points[0]).y += WALL_HEIGHT + 6.4;
      group.add(label);
    }

    // Green cone = the end of the whole route. On a floor you only pass through, it is left out.
    if (endsHere) {
      const end = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 2.8, 20),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x16a34a, emissiveIntensity: 0.6 }),
      );
      end.rotation.x = Math.PI; // point down at the destination
      end.position.copy(points[points.length - 1]).y += WALL_HEIGHT + 1;
      group.add(end);
      pulsing.push(end);
    }
  }

  // People waiting for help are all on the emergency floor.
  for (const pin of shown === active ? pins : []) {
    const room = active.rooms.find((r) => r.id === pin.roomId);
    if (!room) continue;
    const colour = PIN_COLOURS[pin.tone];
    const marker = new THREE.Group();
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 24, 24),
      new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.6 }),
    );
    head.position.y = 5.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.5), new THREE.MeshStandardMaterial({ color: colour }));
    stem.position.y = 2.75;
    marker.add(head, stem);
    marker.position.copy(world(active, centreOf(room), WALL_HEIGHT));
    group.add(marker);
    if (pin.tone === "pending" || pin.tone === "escalated") pulsing.push(head);

    const label = textSprite(pin.label, "#7f1d1d", 3.2, true);
    label.position.copy(world(active, centreOf(room), WALL_HEIGHT + 10.5));
    group.add(label);
  }
  return { group, pulsing, flowing };
}

/** A box around one whole floor, for when there is no route on it to zoom to. */
function floorBox(floor: Floor) {
  const box = new THREE.Box3();
  for (const rect of [...floor.corridors, ...floor.rooms, ...(floor.field ? [floor.field] : [])]) {
    box.expandByPoint(world(floor, { x: rect.x, y: rect.y }));
    box.expandByPoint(world(floor, { x: rect.x + rect.w, y: rect.y + rect.h }, WALL_HEIGHT));
  }
  return box;
}

type SceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  pulsing: THREE.Object3D[];
  flowing: Flow[];
};

const VIEW_DIRECTION = new THREE.Vector3(0.22, 0.62, 0.75).normalize();

/** Point the camera at a box from the south, looking down at an angle, just far enough back to fit all of it. */
function frame({ camera, controls }: SceneState, box: THREE.Box3) {
  const target = box.getCenter(new THREE.Vector3());
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), VIEW_DIRECTION).normalize();
  const up = new THREE.Vector3().crossVectors(VIEW_DIRECTION, right);
  const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const horizontal = vertical * (camera.aspect || 1);
  // Every corner of the box has to land inside the view, whichever way the screen is turned:
  // a phone held upright is narrow, so there the width of the floor decides the distance.
  let distance = 14;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const corner = new THREE.Vector3(x, y, z).sub(target);
        const depth = corner.dot(VIEW_DIRECTION);
        distance = Math.max(distance, depth + Math.abs(corner.dot(right)) / horizontal, depth + Math.abs(corner.dot(up)) / vertical);
      }
    }
  }
  controls.target.copy(target);
  // A fifth spare, for the labels and for the floor buttons laid over the bottom edge.
  camera.position.copy(target).addScaledVector(VIEW_DIRECTION, distance * 1.2);
}

/** "Level 3" → "L3", "Ground" → "G": short enough for five buttons to fit across a phone. */
const shortLabel = (floor: Floor) => (floor.label.startsWith("Level ") ? `L${floor.label.slice(6)}` : floor.label[0]);

/**
 * 3D model of the building, one floor at a time, with the route and live pins on top. The row of
 * floor buttons switches level. The canvas is purely visual: every screen that uses it also shows
 * the same information as text, so it is hidden from screen readers (the floor buttons are not).
 */
export function FloorMap3D({ floor, route, pins = [], blockedStairIds = [], highlightRoomId, position, focus, showFloorId, returnKey = "", alarm = false, className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneState>(null);

  // A floor picked by hand lasts until the floor to show or `returnKey` changes: then the map goes back.
  const followId = showFloorId ?? floor.id;
  const followKey = `${followId}:${returnKey}`;
  const [picked, setPicked] = useState({ followKey, id: followId });
  const shown = getFloor(picked.followKey === followKey ? picked.id : followId) ?? floor;

  // Renderer, camera and controls: created once.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1f3f55);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(60, 300, 120);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05; // don't let the camera go under the ground
    controls.minDistance = 15;
    controls.maxDistance = 1500;

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const state: SceneState = { scene, camera, controls, pulsing: [], flowing: [] };
    sceneRef.current = state;

    renderer.setAnimationLoop((time) => {
      const scale = 1 + 0.25 * Math.sin(time / 180);
      for (const object of state.pulsing) object.scale.setScalar(scale);
      for (const flow of state.flowing) {
        const travelled = (flow.offset + (time / 1000) * ARROW_SPEED) % flow.length;
        flow.mesh.position.copy(flow.from).addScaledVector(flow.direction, travelled);
      }
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  // Floor: rebuilt when another floor is picked, a staircase is blocked or the highlighted room changes.
  const blockedKey = blockedStairIds.join(",");
  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const model = buildFloor(shown, floor, new Set(blockedKey ? blockedKey.split(",") : []), highlightRoomId);
    current.scene.add(model);
    return () => {
      current.scene.remove(model);
      disposeTree(model);
    };
  }, [shown, floor, blockedKey, highlightRoomId]);

  // Route, marker and pins: rebuilt when live data changes. Keyed by value so polling doesn't rebuild every tick.
  const overlayKey = JSON.stringify([route ?? [], pins, position ?? null]);
  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const [nextRoute, nextPins, nextPosition] = JSON.parse(overlayKey) as [RoutePoint[], MapPin[], RoutePoint | null];
    const { group, pulsing, flowing } = buildOverlay(shown, floor, nextRoute, nextPins, nextPosition ?? undefined);
    current.scene.add(group);
    current.pulsing = pulsing;
    current.flowing = flowing;
    return () => {
      current.scene.remove(group);
      current.pulsing = [];
      current.flowing = [];
      disposeTree(group);
    };
  }, [shown, floor, overlayKey]);

  // Camera: frame the focus points on this floor, or the whole floor.
  const focusKey = JSON.stringify(focus ?? null);
  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const points = ((JSON.parse(focusKey) as RoutePoint[] | null) ?? []).filter((p) => p.floorId === shown.id).map((p) => world(shown, p));
    if (points.length < 2) return frame(current, floorBox(shown));
    // Near the end of a floor only a few metres of route are left: keep enough of the surroundings in view to recognise the place.
    const box = new THREE.Box3().setFromPoints(points);
    const short = MIN_VIEW_METRES - Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    if (short > 0) box.expandByVector(new THREE.Vector3(short / 2, 0, short / 2));
    frame(current, box);
  }, [shown, focusKey]);

  const routeFloorIds = new Set(route?.map((p) => p.floorId));
  const isFireFloor = (f: Floor) => alarm && f === floor;
  /** What is on a floor, in words, for the button's accessible name. */
  const notes = (f: Floor) =>
    [
      isFireFloor(f) ? "fire floor" : "",
      position?.floorId === f.id ? "you are here" : "",
      routeFloorIds.has(f.id) ? "on your route" : "",
      f === floor && pins.length > 0 ? `${pins.length} waiting for help` : "",
    ].filter(Boolean);

  return (
    <div className={`relative isolate ${className ?? "h-80 w-full"}`}>
      <div ref={mountRef} aria-hidden="true" data-testid="floor-map-3d" className="absolute inset-0" />
      <p className="pointer-events-none absolute top-2 left-2 rounded-lg bg-black/80 px-3 py-1.5 text-base font-bold text-white">
        {shown.label}
        {isFireFloor(shown) ? <span className="text-red-400"> — FIRE</span> : null}
      </p>
      <ul aria-label="Map key" className="pointer-events-none absolute top-2 right-2 flex flex-col gap-1 rounded-lg bg-black/80 px-2 py-1.5 text-xs font-bold text-white sm:text-sm">
        {KEY.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="grid size-3.5 place-items-center rounded-sm text-[0.6rem] leading-none text-white" style={{ background: item.colour }}>
              {item.cross ? "✕" : ""}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
      <div role="group" aria-label="Floor shown on the map" className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5 px-2">
        {floors.map((f) => {
          const isShown = f === shown;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={isShown}
              aria-label={[f.label, ...notes(f)].join(", ")}
              onClick={() => setPicked({ followKey, id: f.id })}
              className={`relative min-h-11 min-w-11 rounded-lg border-2 px-2 text-base font-extrabold ${
                isShown ? "border-yellow-300 bg-yellow-300 text-black" : "border-white/70 bg-black/80 text-white"
              }`}
            >
              {shortLabel(f)}
              <span aria-hidden="true" className="absolute -top-1.5 right-0 left-0 flex justify-center gap-0.5">
                {isFireFloor(f) ? <span className="size-2.5 rounded-full border border-white bg-red-600" /> : null}
                {position?.floorId === f.id ? <span className="size-2.5 rounded-full border border-white bg-blue-600" /> : null}
                {position?.floorId !== f.id && routeFloorIds.has(f.id) ? <span className="size-2.5 rounded-full border border-white bg-orange-500" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
