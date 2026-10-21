"use client";

import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import {
  type Camera,
  type Material,
  MathUtils,
  type Mesh,
  type Object3D,
  Path,
  Plane,
  Shape,
  ShapeGeometry,
  Vector3,
  type WebGLRenderer,
} from "three";
import {
  CAMERA_SHOTS,
  EXTRA_SHOTS,
  GROUND_Y,
  INTRO_CAMERA,
  ROAD,
  type CameraShot,
} from "@/config/showcase3d";
import type { ModelLibrary } from "./loadModels";
import Atmosphere, { collectGlows } from "./Atmosphere";
import Effects from "./Effects";
import { fuelBadgeEls, useShowcase, type FollowTarget } from "./store";
import { FuelLane, LaneAgent, StationGate, TrafficSim, ROAD_SPAN, type LaneId } from "./traffic";
import { TrainSim } from "./trainSim";
import { VehicleRig, type VehicleKind } from "./vehicleRig";

// ------------------------------------------------------------------ timing

// Seconds after the last file lands
const INTRO = {
  station: { delay: 0.2, duration: 2.6 },
  mall: { delay: 0.9, duration: 1.8 },
  parked: { delay: 2.0, stagger: 0.09 },
  traffic: { delay: 2.6, stagger: 0.05 },
  simStart: 3.0,
  camera: { delay: 0, duration: 4.2 },
  live: 4.4,
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const bounce = (t: number) => {
  // Fall with gravity, then two shrinking hops
  if (t < 0.55) return 1 - (t / 0.55) ** 2;
  if (t < 0.8) {
    const u = (t - 0.675) / 0.125;
    return 0.12 * (1 - u * u);
  }
  const u = (t - 0.9) / 0.1;
  return 0.03 * (1 - u * u);
};

// ------------------------------------------------------------------ world

interface Reveal {
  plane: Plane;
  from: number;
  to: number;
  delay: number;
  duration: number;
}

interface DropIn {
  object: Object3D;
  baseY: number;
  delay: number;
}

interface World {
  station: Object3D;
  mall: Object3D;
  parked: Object3D;
  motoBay: Object3D;
  trainRoot: Object3D;
  reveals: Reveal[];
  drops: DropIn[];
  rigs: VehicleRig[];
  traffic: TrafficSim;
  train: TrainSim;
  materials: { terrain?: Material; asphalt?: Material; line?: Material; concrete?: Material };
}

function prepareStatic(root: Object3D, plane?: Plane) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const transparent = mats.some((m) => m.transparent);
    mesh.castShadow = !transparent;
    mesh.receiveShadow = true;
    if (plane) {
      for (const m of mats) {
        m.clippingPlanes = [plane];
        m.clipShadows = true;
      }
    }
  });
}

function findMaterial(root: Object3D, name: string) {
  let found: Material | undefined;
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (found || !mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    found = mats.find((m) => m.name === name);
  });
  return found;
}

// A deterministic shuffle so the traffic looks the same on every visit
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildWorld(lib: ModelLibrary): World {
  const scene = (file: string) => lib[file]!.scene;

  const station = scene("gas_station.glb");
  const mall = scene("underground_mall.glb");
  const parked = scene("parked_cars.glb");
  const motoBay = scene("motorbikes_scene.glb");
  const trainRoot = scene("train.glb");

  const stationPlane = new Plane(new Vector3(0, -1, 0), -10);
  const mallPlane = new Plane(new Vector3(0, -1, 0), -10);
  prepareStatic(station, stationPlane);
  prepareStatic(mall, mallPlane);
  prepareStatic(parked);
  prepareStatic(motoBay);
  prepareStatic(trainRoot);

  const reveals: Reveal[] = [
    { plane: stationPlane, from: -4.5, to: 13, ...INTRO.station },
    { plane: mallPlane, from: -3, to: 1.5, ...INTRO.mall },
  ];

  // Parked cars and motorbikes drop onto their bays one after another
  const drops: DropIn[] = [];
  const dropTargets = [...parked.children, ...motoBay.children.filter((c) => !c.children.some((k) => /Rider/.test(k.name)))];
  dropTargets.forEach((object, i) => {
    object.userData.baseY ??= object.position.y;
    drops.push({ object, baseY: object.userData.baseY as number, delay: INTRO.parked.delay + i * INTRO.parked.stagger });
  });

  // The bay's ridden bikes join the road traffic instead
  const riddenBikes = motoBay.children.filter((c) => c.children.some((k) => /Rider/.test(k.name)));
  for (const b of riddenBikes) b.visible = false;

  const rigs: VehicleRig[] = [];
  const rig = (file: string, kind: VehicleKind, riderFile?: string) => {
    const r = new VehicleRig(
      scene(file),
      kind,
      file,
      riderFile ? { object: scene(riderFile), file: riderFile } : undefined,
    );
    rigs.push(r);
    return r;
  };
  const sceneBike = (name: string) => {
    const node = riddenBikes.find((b) => b.name.startsWith(name));
    if (!node) return null;
    const r = new VehicleRig(node, "bike", "motorbikes_scene.glb");
    rigs.push(r);
    return r;
  };

  type Spec = { make: () => VehicleRig | null; v: number };
  const car = (file: string, v: number): Spec => ({ make: () => rig(file, "car"), v });
  const bike = (file: string, rider: string, v: number): Spec => ({ make: () => rig(file, "bike", rider), v });
  const fromBay = (name: string, v: number): Spec => ({ make: () => sceneBike(name), v });

  const lanes: Record<LaneId, Spec[]> = {
    eb: [
      car("car.glb", 11.5),
      bike("motorbike_cruiser_black.glb", "rider_cruiser.glb", 10.5),
      car("convertible.glb", 12.5),
      fromBay("Moto_MotoCruiser_19", 10),
      car("wagon80.glb", 10.5),
      bike("motorbike_cub_red.glb", "rider_cub.glb", 9),
      car("van80.glb", 9.5),
      fromBay("Moto_MotoCruiser_Red_27", 11),
    ],
    wb: [
      car("mini_ev.glb", 10),
      bike("motorbike_cub_blue.glb", "rider_cub.glb", 9),
      car("pickup80.glb", 10.5),
      fromBay("Moto_MotoCub_Blue_23", 8.5),
      bike("motorbike_cruiser_red.glb", "rider_cruiser.glb", 11),
      fromBay("Moto_MotoCub_31", 9.5),
      bike("motorbike_cub_teal.glb", "rider_cub.glb", 8.5),
    ],
  };

  const rand = seeded(7);
  const agents: LaneAgent[] = [];
  for (const lane of ["eb", "wb"] as const) {
    const specs = lanes[lane];
    specs.forEach((spec, i) => {
      const r = spec.make();
      if (!r) return;
      const s = ((i + rand() * 0.4) / specs.length) * ROAD_SPAN;
      const offset = r.kind === "bike" ? (rand() < 0.5 ? -0.75 : 0.75) : 0;
      agents.push(new LaneAgent(r, lane, s, spec.v, offset));
    });
  }

  // Each fuel lane cycles through its own set of '80s cars
  const gate = new StationGate();
  const fuel = [
    new FuelLane(["sedan80.glb", "pickup80.glb", "hatch80.glb", "convertible.glb"].map((f) => rig(f, "car")), 0, gate, 0.3),
    new FuelLane(["wagon80.glb", "van80.glb", "car.glb", "hatch80.glb"].map((f) => rig(f, "car")), 1, gate, 7),
  ];

  return {
    station,
    mall,
    parked,
    motoBay,
    trainRoot,
    reveals,
    drops,
    rigs,
    traffic: new TrafficSim(agents, fuel),
    train: new TrainSim(trainRoot),
    materials: {
      terrain: findMaterial(station, "M_Terrain"),
      asphalt: findMaterial(station, "M_Asphalt"),
      line: findMaterial(station, "M_RoadYellow"),
      concrete: findMaterial(station, "M_Concrete"),
    },
  };
}

// ---------------------------------------------------------------- scenery

// Carries the field and the main road on past the GLB's edges into the fog,
// leaving a hole where the GLB's own terrain (and its tunnel cut) sits
function Surroundings({ materials }: { materials: World["materials"] }) {
  const ground = useMemo(() => {
    const outer = new Shape();
    outer.moveTo(-500, -500);
    outer.lineTo(500, -500);
    outer.lineTo(500, 500);
    outer.lineTo(-500, 500);
    outer.closePath();
    const hole = new Path();
    hole.moveTo(-44.9, -35.9);
    hole.lineTo(-44.9, 41.9);
    hole.lineTo(44.9, 41.9);
    hole.lineTo(44.9, -35.9);
    hole.closePath();
    outer.holes.push(hole);
    return new ShapeGeometry(outer);
  }, []);

  const roadWidth = ROAD.zSouth - ROAD.zNorth;
  const roadZ = (ROAD.zSouth + ROAD.zNorth) / 2;
  const laneLineZ = (ROAD.eastboundZ + ROAD.westboundZ) / 2;
  const segments = [
    { from: ROAD.maxX, to: 400 },
    { from: -400, to: ROAD.minX },
  ];
  const dashes = useMemo(() => {
    const xs: number[] = [];
    for (const seg of segments) for (let x = seg.from + 2; x < seg.to - 2; x += 6) xs.push(x);
    return xs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <group>
      <mesh geometry={ground} rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow material={materials.terrain}>
        {!materials.terrain && <meshStandardMaterial color="#6d8f4c" />}
      </mesh>
      {segments.map((seg) => (
        <group key={seg.from}>
          <mesh
            position={[(seg.from + seg.to) / 2, GROUND_Y / 2, roadZ]}
            receiveShadow
            material={materials.asphalt}
          >
            <boxGeometry args={[seg.to - seg.from, GROUND_Y, roadWidth]} />
            {!materials.asphalt && <meshStandardMaterial color="#3c3c42" />}
          </mesh>
          <mesh position={[(seg.from + seg.to) / 2, GROUND_Y / 2 + 0.02, ROAD.zSouth + 0.6]} receiveShadow material={materials.concrete}>
            <boxGeometry args={[seg.to - seg.from, GROUND_Y + 0.04, 1.2]} />
            {!materials.concrete && <meshStandardMaterial color="#9a9a9a" />}
          </mesh>
        </group>
      ))}
      {dashes.map((x) => (
        <mesh key={x} position={[x, GROUND_Y + 0.006, laneLineZ]} rotation-x={-Math.PI / 2} material={materials.line}>
          <planeGeometry args={[3, 0.15]} />
          {!materials.line && <meshBasicMaterial color="#e8c34a" />}
        </mesh>
      ))}
    </group>
  );
}

// --------------------------------------------------------------- camera

type Controls = ComponentRef<typeof OrbitControls>;

const IDLE_SECONDS = 6;

const ALL_SHOTS = [...CAMERA_SHOTS, ...EXTRA_SHOTS];
const shotById = (id: string) => ALL_SHOTS.find((s) => s.id === id) ?? CAMERA_SHOTS[0]!;

const FOLLOW_OFFSET: Record<"car" | "bike" | "train", [number, number, number]> = {
  car: [-6.5, 4.2, 7.5],
  bike: [-4.5, 2.8, 5.5],
  train: [1.6, 1.9, 9],
};

interface Followed {
  get: () => Object3D | null;
  offset: Vector3;
}

function resolveFollow(world: World, target: FollowTarget): Followed | null {
  const onRoad = (r: VehicleRig) => r.root.visible && Math.abs(r.root.position.x) < 40;
  const pick = (cands: VehicleRig[]) => cands.find(onRoad) ?? cands.find((r) => r.root.visible) ?? cands[0] ?? null;
  const ofRig = (r: VehicleRig | null): Followed | null =>
    r && { get: () => r.root, offset: new Vector3(...FOLLOW_OFFSET[r.kind]) };
  const laneRigs = world.traffic.agents.map((a) => a.rig);

  if (target === "train") return { get: () => world.train.root, offset: new Vector3(...FOLLOW_OFFSET.train) };
  if (target === "fuel") {
    const lanes = world.traffic.fuel;
    // Stay on whichever lane has a car that is still on its way in
    return {
      get: () => (lanes.find((l) => l.active && l.refuel < 0)?.active ?? lanes.find((l) => l.active)?.active)?.root ?? null,
      offset: new Vector3(...FOLLOW_OFFSET.car),
    };
  }
  if (target === "bike") return ofRig(pick(laneRigs.filter((r) => r.kind === "bike")));
  if (target === "car") return ofRig(pick(laneRigs.filter((r) => r.kind === "car")));

  const file = target.file;
  if (file === "train.glb") return resolveFollow(world, "train");
  const fuelRigs = world.traffic.fuel.flatMap((l) => l.pool);
  const matches = [...laneRigs, ...fuelRigs].filter((r) => r.file === file || r.riderFile === file);
  if (!matches.length) return null;
  const visibleFuel = matches.find((r) => fuelRigs.includes(r) && r.root.visible);
  return ofRig(visibleFuel ?? pick(matches));
}

function CameraRig({ world }: { world: World | null }) {
  const controls = useRef<Controls>(null);
  const camera = useThree((s) => s.camera);
  const focus = useShowcase((s) => s.focus);
  const nonce = useShowcase((s) => s.focusNonce);
  const live = useShowcase((s) => s.live);
  const tween = useRef<{ fromP: Vector3; fromT: Vector3; toP: Vector3; toT: Vector3; t: number; dur: number } | null>(null);
  const follow = useRef<Followed | null>(null);
  const introStarted = useRef(false);
  // Seconds since the visitor last touched the camera; past IDLE it orbits on its own
  const idle = useRef(0);
  const dragging = useRef(false);

  const startTween = (to: CameraShot | null, dur: number) => {
    const c = controls.current;
    if (!c) return;
    tween.current = {
      fromP: camera.position.clone(),
      fromT: c.target.clone(),
      toP: new Vector3(...(to?.position ?? [0, 0, 0])),
      toT: new Vector3(...(to?.target ?? [0, 0, 0])),
      t: 0,
      dur,
    };
  };

  // Opening move once the world exists
  useEffect(() => {
    if (!world || introStarted.current) return;
    introStarted.current = true;
    camera.position.set(...INTRO_CAMERA.position);
    controls.current?.target.set(...INTRO_CAMERA.target);
    startTween(shotById("overview"), INTRO.camera.duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  useEffect(() => {
    if (!world || !live) return;
    idle.current = 0;
    if (focus.kind === "shot") {
      follow.current = null;
      startTween(shotById(focus.id), 1.8);
    } else {
      follow.current = resolveFollow(world, focus.target);
      startTween(null, 1.6);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, live]);

  const desired = useRef(new Vector3());

  useFrame((_, rawDt) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(rawDt, 0.05);
    const f = follow.current;
    const obj = f?.get() ?? null;
    const tracking = !!obj && obj.visible;
    if (tracking) obj.getWorldPosition(desired.current).y += 1;

    const tw = tween.current;
    if (tw) {
      if (f && tracking) {
        tw.toT.copy(desired.current);
        tw.toP.copy(desired.current).add(f.offset);
      }
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = easeInOut(tw.t);
      camera.position.lerpVectors(tw.fromP, tw.toP, e);
      c.target.lerpVectors(tw.fromT, tw.toT, e);
      if (tw.t >= 1) tween.current = null;
    } else if (f && tracking) {
      const delta = desired.current.clone().sub(c.target);
      // A wrap-around or respawn jumps; carry the camera with it
      if (delta.length() < 25) delta.multiplyScalar(1 - Math.exp(-dt * 6));
      c.target.add(delta);
      camera.position.add(delta);
    }

    if (dragging.current || tween.current || !live) idle.current = 0;
    else idle.current += dt;
    const spin = MathUtils.clamp((idle.current - IDLE_SECONDS) / 2.5, 0, 1);
    c.autoRotate = spin > 0;
    c.autoRotateSpeed = spin * (follow.current ? 0.9 : 0.45);
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={2.5}
      maxDistance={170}
      maxPolarAngle={Math.PI * 0.495}
      onStart={() => {
        tween.current = null;
        dragging.current = true;
        idle.current = 0;
      }}
      onEnd={() => {
        dragging.current = false;
        idle.current = 0;
      }}
    />
  );
}

// ----------------------------------------------------------- fuel badge

const badgePos = new Vector3();

// Pins the DOM fuel badges (see Showcase3D) over the cars at the pumps
function placeBadges(world: World, camera: Camera, width: number, height: number) {
  world.traffic.fuel.forEach((lane, i) => {
    const el = fuelBadgeEls[i];
    if (!el) return;
    const state = useShowcase.getState();
    const on = lane.refuel >= 0 && !!lane.active && state.live && !state.cutaway;
    el.style.opacity = on ? "1" : "0";
    if (!on) return;
    badgePos.set(lane.x, 3.3, lane.z).project(camera);
    const x = (badgePos.x * 0.5 + 0.5) * width;
    const y = (-badgePos.y * 0.5 + 0.5) * height;
    el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    el.style.visibility = badgePos.z < 1 ? "visible" : "hidden";
    const fill = el.querySelector<HTMLElement>("[data-fill]");
    const litres = el.querySelector<HTMLElement>("[data-litres]");
    const tank = 30 + ((i * 17 + Math.floor(lane.x * 10)) % 25);
    if (fill) fill.style.width = `${Math.round(lane.refuel * 100)}%`;
    if (litres) litres.textContent = (lane.refuel * tank).toFixed(1);
  });
}

// ---------------------------------------------------------------- scene

function setGlobalClip(gl: WebGLRenderer, planes: Plane[]) {
  gl.localClippingEnabled = true;
  gl.clippingPlanes = planes;
}

function setCut(cut: Plane, cutaway: boolean, dt: number) {
  cut.constant = MathUtils.damp(cut.constant, cutaway ? -0.16 : 40, cutaway ? 2.2 : 1.6, dt);
}

// Builds the world in front of the camera, `t` seconds after the files landed
function playIntro(world: World, t: number) {
  for (const r of world.reveals) {
    const k = MathUtils.clamp((t - r.delay) / r.duration, 0, 1);
    r.plane.constant = k >= 1 ? 1e4 : MathUtils.lerp(r.from, r.to, easeInOut(k));
  }
  for (const d of world.drops) {
    const k = MathUtils.clamp((t - d.delay) / 0.9, 0, 1);
    d.object.visible = k > 0;
    d.object.position.y = d.baseY + bounce(k) * 9;
  }
  world.traffic.agents.forEach((a, i) => {
    const k = MathUtils.clamp((t - INTRO.traffic.delay - i * INTRO.traffic.stagger) / 0.6, 0, 1);
    a.rig.root.visible = k > 0;
    a.rig.root.scale.setScalar(Math.max(0.001, easeOutBack(k)));
  });
  // The train only shows once it is underground and running
  if (t < INTRO.simStart) world.train.root.visible = false;
}

// The lens flare raycasts the scene each frame; only the sky disc should answer
function muteRaycasts(roots: Object3D[]) {
  const none = () => {};
  for (const r of roots) r.traverse((o) => void (o.raycast = none));
}

function stepWorld(world: World, dt: number) {
  world.traffic.step(dt);
  world.train.step(dt);
  return world.train.status;
}

export default function ShowcaseScene({ library }: { library: ModelLibrary | null }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const world = useMemo(() => (library ? buildWorld(library) : null), [library]);
  const glows = useMemo(
    () => (world ? collectGlows([world.station, world.mall, world.parked, world.motoBay, world.trainRoot, ...world.rigs.map((r) => r.root)]) : []),
    [world],
  );
  const [disc, setDisc] = useState<Mesh | null>(null);
  const clock = useRef(0);
  const cut = useMemo(() => new Plane(new Vector3(0, -1, 0), 40), []);
  const grid = useRef<Object3D>(null);
  const lastStatus = useRef("");

  useEffect(() => {
    if (world) muteRaycasts([world.station, world.mall, world.parked, world.motoBay, world.trainRoot, ...world.rigs.map((r) => r.root)]);
  }, [world]);

  useEffect(() => {
    setGlobalClip(gl, [cut]);
    return () => setGlobalClip(gl, []);
  }, [gl, cut]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const state = useShowcase.getState();

    // Underground cutaway: everything above the plane is sliced off
    setCut(cut, state.cutaway, dt);

    if (!world) return;
    clock.current += dt;
    const t = clock.current;

    playIntro(world, t);
    if (grid.current) {
      grid.current.visible = t < INTRO.station.delay + INTRO.station.duration;
    }

    if (t >= INTRO.simStart) {
      const status = stepWorld(world, dt);
      if (status !== lastStatus.current) {
        lastStatus.current = status;
        state.setTrainStatus(status);
      }
    } else if (t < dt * 2) {
      // Pose everything once so nothing sits at the origin before the sim runs
      stepWorld(world, 0);
    }
    if (!state.live && t >= INTRO.live) state.setLive(true);
    placeBadges(world, camera, size.width, size.height);
  });

  return (
    <>
      <Atmosphere glows={glows} onDisc={setDisc} />
      <CameraRig world={world} />

      {/* Blueprint floor while the files stream in */}
      <group ref={grid}>
        <Grid
          position={[0, 0.01, 4]}
          args={[200, 200]}
          cellSize={2}
          cellThickness={0.6}
          cellColor="#5e88b8"
          sectionSize={10}
          sectionThickness={1.2}
          sectionColor="#9cc6ff"
          fadeDistance={150}
          infiniteGrid
        />
      </group>

      {world && (
        <>
          <primitive object={world.station} />
          <primitive object={world.mall} />
          <primitive object={world.parked} />
          <primitive object={world.motoBay} />
          <group>
            <primitive object={world.trainRoot}>
              <pointLight position={[3.4, 1.6, 0]} color="#ffe6b0" intensity={30} distance={22} decay={1.4} />
            </primitive>
          </group>
          {world.rigs.map((r, i) => (
            <primitive key={i} object={r.root} />
          ))}
          <Surroundings materials={world.materials} />
        </>
      )}

      <Effects disc={disc} />
    </>
  );
}

