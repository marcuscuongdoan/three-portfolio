"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import Owl, { OwlHandle } from "@/components/owl-world/Owl";
import Companions from "@/components/owl-world/Companions";
import HomeGrounds from "@/components/owl-world/HomeGrounds";
import SkyDome, { FOG_COLOR, MOON_DIR } from "@/components/owl-world/SkyDome";
import Fireflies from "@/components/owl-world/Fireflies";
import { WIND } from "@/components/owl-world/wind";
import { ShadowMoon, ShadowSetup } from "@/components/owl-world/shadows";
import Corridor from "@/components/owl-world/Corridor";
import Museum from "@/components/owl-world/Museum";
import { cameraFov, CONTACT_POINT, createSample, FlightSample, LAST_STOP, PORTRAIT_ASPECT, sampleFlight, STOP_INDEX, STOPS } from "@/components/owl-world/flightPath";
import { framePose } from "@/components/owl-world/Museum";
import { flight, guide, useOwlWorld } from "@/components/owl-world/owlStore";

const CONTACT_KEY = CONTACT_POINT.clone().add(new THREE.Vector3(1.6, 1.2, 2.4)).toArray();

// The shown progress follows the scroll through a critically damped spring:
// it eases in from rest, eases out onto the stop, never overshoots, and stays
// smooth when the target changes mid-flight. OMEGA sets the pace (a stop takes
// about 2.5–3 s); MAX_RATE caps the speed (stops/s) on multi-stop jumps
const OMEGA = 1.7;
const MAX_RATE = 0.5;
// How fast the owl turns round when the scroll changes direction (1/s)
const TURN = 3;
// Camera smoothing (1/s): the camera's offset from the owl — its direction,
// distance and aim — eases toward the framing the path asks for, so swings
// between viewpoints take their time while the camera still keeps up with a
// fast-flying owl
const CAMERA_EASE = 2.2;

// Critically damped spring step for one value
function spring(x: number, v: number, to: number, omega: number, dt: number): [number, number] {
  const a = omega * omega * (to - x) - 2 * omega * v;
  const nv = v + a * dt;
  return [x + nv * dt, nv];
}

class OffsetSpring {
  dir = new THREE.Vector3();
  dirV = new THREE.Vector3();
  len = 0;
  lenV = 0;
  aim = new THREE.Vector3();
  aimV = new THREE.Vector3();
  ready = false;
  private _d = new THREE.Vector3();

  /** Ease toward the wanted camera offset and aim offset (both relative to the owl) */
  step(offset: THREE.Vector3, aim: THREE.Vector3, dt: number) {
    const len = offset.length();
    this._d.copy(offset).divideScalar(Math.max(len, 1e-6));
    if (!this.ready) {
      this.dir.copy(this._d);
      this.len = len;
      this.aim.copy(aim);
      this.ready = true;
      return;
    }
    for (const k of ["x", "y", "z"] as const) {
      [this.dir[k], this.dirV[k]] = spring(this.dir[k], this.dirV[k], this._d[k], CAMERA_EASE, dt);
      [this.aim[k], this.aimV[k]] = spring(this.aim[k], this.aimV[k], aim[k], CAMERA_EASE, dt);
    }
    [this.len, this.lenV] = spring(this.len, this.lenV, len, CAMERA_EASE, dt);
  }
}

const KEY_DIR = new THREE.Vector3(-0.42, 0.62, 0.66).normalize();
const _focusPos = new THREE.Vector3();
const _focusAim = new THREE.Vector3();
const _focusLift = new THREE.Vector3(0, 0.15, 0);
const _focusDrop = new THREE.Vector3(0, 0.45, 0);
const _offset = new THREE.Vector3();
const _aim = new THREE.Vector3();

/**
 * Loitering: settled at a stop where it doesn't perch, the owl keeps flying —
 * a lazy figure-eight in front of the camera, banking through the turns —
 * instead of hanging in place. It eases in once the scroll rests and hands
 * back to the path as soon as the scroll moves.
 */
const LOITER = {
  // [side, forward, up] half-sizes (m) and how fast it goes round (rad/s)
  chase: { a: 0.75, b: 1.0, c: 0.3, rate: 0.42 },
  hover: { a: 0.42, b: 0.6, c: 0.2, rate: 0.55 },
};
const LOITER_IN = 0.9;
const LOITER_OUT = 2.5;
const UP = new THREE.Vector3(0, 1, 0);
const OWL_FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
const ORIGIN = new THREE.Vector3();

class Loiter {
  weight = 0;
  phase = 0;
  private fwd = new THREE.Vector3();
  private side = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private roll = new THREE.Quaternion();
  private m = new THREE.Matrix4();

  step(dt: number, sample: FlightSample, progress: number, speed: number) {
    const nearest = Math.round(progress);
    const kind = STOPS[THREE.MathUtils.clamp(nearest, 0, LAST_STOP)]!.kind;
    const resting = kind !== "perch" && Math.abs(progress - nearest) < 0.03 && speed < 0.03;
    this.weight = THREE.MathUtils.damp(this.weight, resting ? 1 : 0, resting ? LOITER_IN : LOITER_OUT, dt);
    const shape = kind === "hover" ? LOITER.hover : LOITER.chase;
    this.phase += dt * shape.rate;
    const w = THREE.MathUtils.smootherstep(this.weight, 0, 1);
    if (w < 1e-3) return;

    // The figure-eight lies across the camera's view, level with the owl
    this.fwd.subVectors(sample.camTarget, sample.camPos).setY(0).normalize();
    this.side.crossVectors(this.fwd, UP).normalize();
    const t = this.phase;
    const { a, b, c } = shape;
    // Position, and its rate of change for the heading and the bank
    const sx = a * Math.sin(t), fz = (b / 2) * Math.sin(2 * t), uy = c * Math.sin(2 * t + 1);
    const vs = a * Math.cos(t), vf = b * Math.cos(2 * t), vu = 2 * c * Math.cos(2 * t + 1);
    const as = -a * Math.sin(t), af = -2 * b * Math.sin(2 * t);
    sample.pos.addScaledVector(this.side, sx * w).addScaledVector(this.fwd, fz * w).addScaledVector(UP, uy * w);

    this.vel.copy(this.side).multiplyScalar(vs).addScaledVector(this.fwd, vf).addScaledVector(UP, vu);
    // Turning rate in the loop's own plane decides how hard it banks
    const turn = (vs * af - vf * as) / Math.max(vs * vs + vf * vf, 1e-4);
    this.m.lookAt(ORIGIN, this.vel, UP);
    this.q.setFromRotationMatrix(this.m).multiply(this.roll.setFromAxisAngle(OWL_FORWARD_AXIS, THREE.MathUtils.clamp(turn * 0.55, -0.6, 0.6)));
    sample.quat.slerp(this.q, w);
    // Flying the loop rather than holding station: calmer wingbeats
    sample.hover *= 1 - w * 0.7;
  }
}
// Within this distance of a stop the UI for that stop shows
const SETTLED = 0.08;

function FlightRig() {
  const owl = useRef<OwlHandle>(null);
  const sample = useMemo(() => createSample(), []);
  const last = useRef<{ active: number | null; nearest: number }>({ active: 0, nearest: 0 });
  const heading = useRef({ value: 0, target: 0 });
  const camSpring = useMemo(() => new OffsetSpring(), []);
  const loiter = useMemo(() => new Loiter(), []);
  const focus = useRef({ weight: 0, pos: new THREE.Vector3(), normal: new THREE.Vector3() });

  useFrame((state, delta) => {
    // Animation steps are capped (a stalled tab mustn't jump), but the flight
    // itself runs in small substeps of real time, so a slow frame rate makes
    // it choppier, not slower
    const dt = Math.min(delta, 0.1);
    const flightDt = Math.min(delta, 0.5);
    const substeps = Math.ceil(flightDt / 0.04);
    for (let i = 0; i < substeps; i++) {
      const h = flightDt / substeps;
      const accel = OMEGA * OMEGA * (flight.target - flight.current) - 2 * OMEGA * flight.velocity;
      flight.velocity = THREE.MathUtils.clamp(flight.velocity + accel * h, -MAX_RATE, MAX_RATE);
      flight.current += flight.velocity * h;
    }
    if (Math.abs(flight.current - flight.target) < 1e-4 && Math.abs(flight.velocity) < 1e-3) {
      flight.current = flight.target;
      flight.velocity = 0;
    }

    // Face the way it's actually going: turn round when scrolled back up,
    // keep the last heading while hovering in place
    if (flight.velocity < -0.02) heading.current.target = 1;
    else if (flight.velocity > 0.02) heading.current.target = 0;
    heading.current.value = THREE.MathUtils.damp(heading.current.value, heading.current.target, TURN, dt);

    const cam = state.camera as THREE.PerspectiveCamera;
    const aspect = state.size.width / state.size.height;
    const fov = cameraFov(aspect);
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    sampleFlight(flight.current, aspect, fov, THREE.MathUtils.smootherstep(heading.current.value, 0, 1), sample);

    // Phones can't show all three walls legibly, so at the museum the camera
    // closes in on whichever frame the carousel is showing
    const ui = useOwlWorld.getState();
    const f = focus.current;
    const focusing =
      aspect < PORTRAIT_ASPECT && ui.activeStop === STOP_INDEX.museum && ui.museumFocus !== null && framePose(ui.museumFocus, f.pos, f.normal);
    f.weight = THREE.MathUtils.damp(f.weight, focusing ? 1 : 0, 3, dt);
    if (f.weight > 1e-3) {
      const w = THREE.MathUtils.smootherstep(f.weight, 0, 1);
      // Far enough back that the frame (and a little wall) fills the width,
      // a touch above so the carousel doesn't cover it
      const back = 1.9 / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect);
      _focusPos.copy(f.pos).addScaledVector(f.normal, back).add(_focusLift);
      _focusAim.copy(f.pos).sub(_focusDrop);
      sample.camPos.lerp(_focusPos, w);
      sample.camTarget.lerp(_focusAim, w);
    }
    // The camera frames the owl's place on the path; the owl's loitering
    // (below) happens inside that frame
    _offset.subVectors(sample.camPos, sample.pos);
    _aim.subVectors(sample.camTarget, sample.pos);
    camSpring.step(_offset, _aim, dt);
    // The direction is eased as a vector and renormalised, so a swing goes
    // round the owl rather than cutting through it
    cam.position.copy(camSpring.dir).normalize().multiplyScalar(camSpring.len).add(sample.pos);
    cam.lookAt(_aim.copy(camSpring.aim).add(sample.pos));

    loiter.step(dt, sample, flight.current, Math.abs(flight.velocity));
    guide.pos.copy(sample.pos);
    guide.quat.copy(sample.quat);
    owl.current?.update(dt, sample, Math.abs(flight.velocity), state.pointer);

    const nearest = Math.round(flight.current);
    const active = Math.abs(flight.current - nearest) < SETTLED ? nearest : null;
    if (active !== last.current.active || nearest !== last.current.nearest) {
      last.current = { active, nearest };
      useOwlWorld.getState().setStops(active, nearest);
    }
  });

  return (
    <Suspense fallback={null}>
      <Owl ref={owl} />
    </Suspense>
  );
}

// Night reflections for the owl's metal shell: a cold moonlit sky, a warm
// strip of window light low on one side
function Reflections() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer intensity={0.9} color="#7f92d8" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
      <Lightformer intensity={2.6} color="#dfe6ff" position={[-2, 2.5, -6]} scale={[3, 3, 1]} form="circle" />
      <Lightformer intensity={1.5} color="#ffb565" position={[6, 1, 2]} rotation-y={-Math.PI / 2} scale={[8, 1.6, 1]} />
      <Lightformer intensity={0.6} color="#9fb0ff" position={[-6, 1.5, 3]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
      <Lightformer intensity={0.7} color="#c6d0ff" position={[0, 2, 6]} rotation-y={Math.PI} scale={[8, 3, 1]} />
      <Lightformer intensity={0.15} color="#2a3352" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} />
    </Environment>
  );
}

function Effects() {
  const width = useThree((s) => s.size.width);
  // Phones skip the composer: the glow is a nicety, the frame rate isn't
  if (width < 768) return null;
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.3} intensity={1.1} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

// Advances the shared clock the foliage wind shader runs on
function WindClock() {
  useFrame(({ clock }) => {
    WIND.uTime.value = clock.elapsedTime;
  });
  return null;
}

function ResetCursorOnLeave() {
  useEffect(() => () => void (document.body.style.cursor = ""), []);
  return null;
}

export default function OwlScene() {
  // Shadows cost a few extra passes a frame; phones keep their frame rate
  const [shadows] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  return (
    <Canvas
      shadows={shadows}
      dpr={[1, 1.75]}
      camera={{ fov: 45, near: 0.1, far: 1200, position: [1, 3.1, 2.5] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      // Vertical swipes on the canvas scroll the page (the flight)
      style={{ touchAction: "pan-y" }}
    >
      <color attach="background" args={[FOG_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, 30, 190]} />
      <hemisphereLight args={["#5664a8", "#151a2c", 0.65]} />
      {/* Moonlight from ahead, a soft cold fill from behind the camera */}
      <directionalLight color="#c9d4ff" intensity={1.5} position={MOON_DIR.clone().multiplyScalar(60)} />
      {shadows && <ShadowSetup />}
      {/* Moonlight over the camera's shoulder: lights what we see and casts
          the shadows we can see (the moon itself, ahead, gives the rim) */}
      {shadows ? (
        <ShadowMoon color="#9fb0ee" intensity={1.25} direction={KEY_DIR} />
      ) : (
        <directionalLight color="#9fb0ee" intensity={1.1} position={KEY_DIR.clone().multiplyScalar(60)} />
      )}
      <Fireflies />
      <WindClock />
      {/* A soft key on the owl where it hovers for the contact form */}
      <pointLight position={CONTACT_KEY} color="#ffd6a0" intensity={10} distance={9} decay={1.6} />
      <Reflections />
      <SkyDome />
      <HomeGrounds />
      <Corridor />
      <Museum />
      <FlightRig />
      <Suspense fallback={null}>
        <Companions />
      </Suspense>
      <Effects />
      <ResetCursorOnLeave />
    </Canvas>
  );
}
