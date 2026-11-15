"use client";
import { useEffect, useRef } from "react";
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
  /** Points the camera should frame. Leave out to show the whole building. */
  focus?: RoutePoint[];
  /** Draw only these floors (and the parts of the route on them). Leave out to draw the whole stack. */
  visibleFloorIds?: string[];
  className?: string;
};

// The floors are drawn much further apart than they really are (about 4 m), like an exploded
// diagram, so each level can be seen from above without the one over it hiding it.
const FLOOR_GAP = 42;
const WALL_HEIGHT = 1.8; // low walls: rooms read as open boxes, like a doll's house
const ROOM_COLOURS: Record<Room["kind"], number> = {
  room: 0xd9b382,
  office: 0xb9763a,
  toilet: 0x2f5fb3,
  stairs: 0x1fa971,
  lift: 0x9fb8b0,
};
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
const ARROW_SPACING = 3.5; // metres between direction arrows
const ARROW_SPEED = 2.5; // metres per second

const levelY = (floor: Floor) => floors.indexOf(floor) * FLOOR_GAP;
const centreOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function world(floor: Floor, p: Point, height = 0) {
  const { x, z } = toMetres(floor, p);
  return new THREE.Vector3(x, levelY(floor) + height, z);
}

function routeWorld(p: RoutePoint, height = 0) {
  const floor = getFloor(p.floorId);
  return floor ? world(floor, p, height) : null;
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

/** Every floor of the building, stacked, with the staircase shafts running through them. */
function buildBuilding(active: Floor, blocked: Set<string>, highlightRoomId: string | undefined, visible: Set<string> | null) {
  const group = new THREE.Group();

  for (const floor of floors) {
    if (visible && !visible.has(floor.id)) continue;
    // A solid plate under everything gives each level the "platform" look.
    for (const rect of [...floor.corridors, ...floor.rooms]) group.add(slab(floor, rect, SLAB_COLOUR, 1.2, 0));
    if (floor.field) {
      group.add(slab(floor, floor.field, FIELD_COLOUR, 1.2, 0.2));
      const label = textSprite("Assembly point", "#14532d", 6, true);
      label.position.copy(world(floor, centreOf(floor.field), 7));
      group.add(label);
    }

    for (const room of floor.rooms) {
      const isBlocked = room.kind === "stairs" && blocked.has(room.id);
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

      // Staircases are labelled once, on the emergency floor, not five times.
      const wantsLabel = room.name !== "" && (room.kind === "room" || (room.kind === "stairs" && floor === active));
      if (wantsLabel) {
        const text = isBlocked ? `${room.name} — BLOCKED` : room.name;
        const label = textSprite(text, isBlocked ? "#7f1d1d" : room.kind === "stairs" ? "#065f46" : "#111827");
        label.position.copy(world(floor, centreOf(room), WALL_HEIGHT + 1.6));
        group.add(label);
      }
    }

    const name = textSprite(floor === active ? `${floor.label} — FIRE` : floor.label, floor === active ? "#b91c1c" : "#111827", 7, true);
    name.position.set(-78, levelY(floor) + 5, 45);
    group.add(name);
  }

  // Staircase shafts: a see-through column joining the same staircase on every floor.
  if (visible) return group; // only worth drawing when the whole stack is shown
  const bottom = floors[0];
  for (const stair of bottom.rooms.filter((r) => r.kind === "stairs")) {
    const top = floors.findLast((f) => f.rooms.some((r) => r.id === stair.id)) ?? bottom;
    const height = levelY(top) - levelY(bottom);
    if (height <= 0) continue;
    const colour = blocked.has(stair.id) ? BLOCKED_COLOUR : ROOM_COLOURS.stairs;
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, height, 3.4),
      new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    shaft.position.copy(world(bottom, centreOf(stair), height / 2));
    group.add(shaft);
  }
  return group;
}

type Flow = { mesh: THREE.Object3D; from: THREE.Vector3; direction: THREE.Vector3; length: number; offset: number };

function buildOverlay(active: Floor, fullRoute: RoutePoint[], pins: MapPin[], position: RoutePoint | undefined, visible: Set<string> | null) {
  const group = new THREE.Group();
  const pulsing: THREE.Object3D[] = [];
  const flowing: Flow[] = [];
  // A route never returns to a floor it has left, so filtering keeps one continuous stretch.
  const route = visible ? fullRoute.filter((p) => visible.has(p.floorId)) : fullRoute;
  const points = route.flatMap((p) => routeWorld(p, 0.45) ?? []);
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

    const here = position ? routeWorld(position, 1.2) : null;
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

    // Green cone = the end of the whole route. On a floor you only pass through, it is left out.
    if (endsHere || !visible) {
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

  for (const pin of pins) {
    const room = active.rooms.find((r) => r.id === pin.roomId);
    if (!room || (visible && !visible.has(active.id))) continue;
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

/** A box around the whole stack, for the "whole building" camera. */
function buildingBox() {
  const box = new THREE.Box3();
  for (const floor of floors) {
    for (const rect of [...floor.corridors, ...floor.rooms, ...(floor.field ? [floor.field] : [])]) {
      box.expandByPoint(world(floor, { x: rect.x, y: rect.y }));
      box.expandByPoint(world(floor, { x: rect.x + rect.w, y: rect.y + rect.h }, WALL_HEIGHT));
    }
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

/** Point the camera at a box from the south, looking down at an angle, far enough back to fit all of it. */
function frame({ camera, controls }: SceneState, box: THREE.Box3) {
  const target = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 14);
  // Fit the box's bounding sphere inside whichever is narrower: the vertical or the horizontal view angle.
  const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
  const horizontal = Math.atan(Math.tan(vertical) * (camera.aspect || 1));
  const distance = (radius / Math.sin(Math.min(vertical, horizontal))) * 1.05;
  controls.target.copy(target);
  camera.position.copy(target).add(new THREE.Vector3(0.22, 0.62, 0.75).normalize().multiplyScalar(distance));
}

/**
 * 3D model of the building: every floor stacked, with the route and live pins on top.
 * Purely visual: every screen that uses it also shows the same information as text, so the
 * canvas is hidden from screen readers.
 */
export function FloorMap3D({ floor, route, pins = [], blockedStairIds = [], highlightRoomId, position, focus, visibleFloorIds, className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneState>(null);

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

  // Building: rebuilt when a staircase is blocked or the highlighted room changes.
  const blockedKey = blockedStairIds.join(",");
  const visibleKey = visibleFloorIds?.join(",") ?? "";
  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const visible = visibleKey ? new Set(visibleKey.split(",")) : null;
    const model = buildBuilding(floor, new Set(blockedKey ? blockedKey.split(",") : []), highlightRoomId, visible);
    current.scene.add(model);
    return () => {
      current.scene.remove(model);
      disposeTree(model);
    };
  }, [floor, blockedKey, highlightRoomId, visibleKey]);

  // Route, marker and pins: rebuilt when live data changes. Keyed by value so polling doesn't rebuild every tick.
  const overlayKey = JSON.stringify([route ?? [], pins, position ?? null]);
  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const [nextRoute, nextPins, nextPosition] = JSON.parse(overlayKey) as [RoutePoint[], MapPin[], RoutePoint | null];
    const visible = visibleKey ? new Set(visibleKey.split(",")) : null;
    const { group, pulsing, flowing } = buildOverlay(floor, nextRoute, nextPins, nextPosition ?? undefined, visible);
    current.scene.add(group);
    current.pulsing = pulsing;
    current.flowing = flowing;
    return () => {
      current.scene.remove(group);
      current.pulsing = [];
      current.flowing = [];
      disposeTree(group);
    };
  }, [floor, overlayKey, visibleKey]);

  // Camera: frame the given points, or the whole building.
  const focusKey = JSON.stringify(focus ?? null);
  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const points = ((JSON.parse(focusKey) as RoutePoint[] | null) ?? []).flatMap((p) => routeWorld(p) ?? []);
    frame(current, points.length > 0 ? new THREE.Box3().setFromPoints(points) : buildingBox());
  }, [focusKey]);

  return <div ref={mountRef} aria-hidden="true" data-testid="floor-map-3d" className={className ?? "h-80 w-full"} />;
}
