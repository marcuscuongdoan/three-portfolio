"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  EXPO_FILE,
  HDRI_FILE,
  OVERVIEW_SHOT,
  SLOTS,
  TEMPLATE_IDS,
  TEMPLATES,
  TIER_INFO,
  TRAFFIC,
  slotLabel,
  templateFile,
  type BoothColors,
  type Slot,
  type TemplateId,
} from "@/config/expodia";
import { VehicleRig } from "@/components/showcase-3d/vehicleRig";
import Effects from "./Effects";
import { ExpoTraffic } from "./traffic";
import { surfaceAspect, useExpodia, type BoothConfig } from "./store";

useGLTF.preload(EXPO_FILE);
TEMPLATE_IDS.forEach((id) => useGLTF.preload(templateFile(id)));

const VEHICLE_FILES = [...TRAFFIC.cars, ...new Set(TRAFFIC.bikes.flatMap((b) => [b.file, b.rider]))].map((f) => `${TRAFFIC.dir}/${f}`);

// Pixels a press may travel and still count as a click (not an orbit drag)
const CLICK_SLOP = 5;

function setCursor(on: boolean) {
  document.body.style.cursor = on ? "pointer" : "";
}

function Expo() {
  const gltf = useGLTF(EXPO_FILE);
  const { actions } = useAnimations(gltf.animations, gltf.scene);
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.reset().play());
  }, [actions]);
  useEffect(() => enableShadows(gltf.scene, NO_CAST), [gltf.scene]);
  return <primitive object={gltf.scene} />;
}

// Ground-level and glowing surfaces only receive; casting from them would
// just darken the floor under itself
const NO_CAST = /^(Base|Mesh_|Hall_Floor|Floor_|Water_|Slot_Footprints|.*Glow|.*Portal|.*Display$)/;

function enableShadows(root: THREE.Object3D, noCast?: RegExp) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.Material;
    mesh.receiveShadow = true;
    mesh.castShadow = !mat.transparent && !noCast?.test(mesh.name) && !noCast?.test(mesh.parent?.name ?? "");
  });
}

// ---------------------------------------------------------------- lighting

const SUN_DIR = new THREE.Vector3(0.55, 1, 0.35).normalize();

// A warm sun whose shadow box follows what the camera looks at and grows
// with zoom, so close-ups get crisp shadows and the overview still has some
function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const size = useRef(0);

  useFrame(({ camera, controls }) => {
    const l = light.current;
    const focus = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    if (!l || !focus) return;
    target.position.copy(focus);
    target.updateMatrixWorld();
    l.position.copy(focus).addScaledVector(SUN_DIR, 300);
    const want = THREE.MathUtils.clamp(camera.position.distanceTo(focus) * 0.7, 30, 240);
    if (Math.abs(want - size.current) > size.current * 0.08) {
      size.current = want;
      const cam = l.shadow.camera;
      cam.left = cam.bottom = -want;
      cam.right = cam.top = want;
      cam.updateProjectionMatrix();
    }
  });

  return (
    <>
      <directionalLight
        ref={light}
        target={target}
        color="#fff1dc"
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={10}
        shadow-camera-far={700}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <primitive object={target} />
    </>
  );
}

// ---------------------------------------------------------------- booths

interface DisplayPart {
  mat: THREE.MeshStandardMaterial;
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
}

interface BoothParts {
  root: THREE.Object3D;
  primary: THREE.MeshStandardMaterial[];
  secondary: THREE.MeshStandardMaterial[];
  glow: THREE.MeshStandardMaterial[];
  displays: Record<string, DisplayPart>;
  icons: Record<string, THREE.Object3D[]>;
  materials: THREE.Material[];
}

const DISPLAY_RE = /__((?:Product|Image|Logo)_\d+)__Display$/;
const ICON_RE = /__(Product|Image|Logo)_Icon_(\d+)$/;

// Clones the template with its own materials so each booth can be coloured
// and dressed without touching the others
function buildBooth(source: THREE.Object3D, template: TemplateId): BoothParts {
  const root = source.clone(true);
  const parts: BoothParts = { root, primary: [], secondary: [], glow: [], displays: {}, icons: {}, materials: [] };
  const copies = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const aspects: Record<string, number> = (surfaceAspect[template] ??= {});

  root.traverse((o) => {
    const icon = o.name.match(ICON_RE);
    if (icon) (parts.icons[`${icon[1]}_${icon[2]}`] ??= []).push(o);

    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const orig = mesh.material as THREE.MeshStandardMaterial;
    let mat = copies.get(orig);
    if (!mat) {
      mat = orig.clone();
      copies.set(orig, mat);
      parts.materials.push(mat);
      if (mat.name.startsWith("M_Color_Primary")) parts.primary.push(mat);
      else if (mat.name.startsWith("M_Color_Secondary")) parts.secondary.push(mat);
      else if (mat.name.startsWith("Booth_Light_Effect")) parts.glow.push(mat);
    }
    mesh.material = mat;

    const display = o.name.match(DISPLAY_RE);
    if (display) {
      const key = display[1]!;
      parts.displays[key] = { mat, color: mat.color.clone(), emissive: mat.emissive.clone(), emissiveIntensity: mat.emissiveIntensity };
      mesh.geometry.computeBoundingBox();
      const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
      aspects[key] = Math.hypot(size.x, size.z) / Math.max(size.y, 1e-3);
    }
  });
  return parts;
}

const textures = new Map<string, THREE.Texture>();
function textureFor(url: string) {
  let tex = textures.get(url);
  if (!tex) {
    tex = new THREE.TextureLoader().load(url);
    // The display UVs follow glTF (v = 0 at the top)
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    textures.set(url, tex);
  }
  return tex;
}

function applyColors(parts: BoothParts, colors: BoothColors) {
  parts.primary.forEach((m) => m.color.set(colors.primary));
  parts.secondary.forEach((m) => m.color.set(colors.secondary));
  parts.glow.forEach((m) => {
    m.color.set(colors.glow);
    m.emissive.set(colors.glow);
  });
}

function applyImages(parts: BoothParts, images: Record<string, string>, primary: string) {
  for (const [key, d] of Object.entries(parts.displays)) {
    const url = images[key];
    const { mat } = d;
    if (url) {
      const tex = textureFor(url);
      mat.map = tex;
      mat.emissiveMap = tex;
      mat.color.set("#ffffff");
      mat.emissive.set("#ffffff");
      mat.emissiveIntensity = 0.55;
    } else {
      mat.map = null;
      mat.emissiveMap = null;
      // An empty logo plate follows the booth colour instead of the model's
      if (key.startsWith("Logo")) mat.color.set(primary).multiplyScalar(0.55);
      else mat.color.copy(d.color);
      mat.emissive.copy(d.emissive);
      mat.emissiveIntensity = d.emissiveIntensity;
    }
    mat.needsUpdate = true;
    // The floating "add picture" marker only shows while the surface is empty
    parts.icons[key]?.forEach((o) => (o.visible = !url));
  }
}

function Booth({ slot, config }: { slot: Slot; config: BoothConfig }) {
  const gltf = useGLTF(templateFile(config.template));
  const parts = useMemo(() => buildBooth(gltf.scene, config.template), [gltf.scene, config.template]);

  useEffect(() => () => parts.materials.forEach((m) => m.dispose()), [parts]);
  useEffect(() => enableShadows(parts.root), [parts]);
  useEffect(() => applyColors(parts, config.colors), [parts, config.colors]);
  useEffect(() => applyImages(parts, config.images, config.colors.primary), [parts, config.images, config.colors.primary]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_SLOP) return;
    e.stopPropagation();
    const st = useExpodia.getState();
    const surface = e.object.name.match(DISPLAY_RE)?.[1];
    // Once the booth is selected, its picture boxes open the file picker
    if (surface && st.selected === slot.id) {
      st.requestUpload(slot.id, surface);
      return;
    }
    st.select(slot.id);
  };

  return (
    <primitive
      object={parts.root}
      onClick={onClick}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        useExpodia.getState().setHovered(slot.id);
        setCursor(true);
      }}
      onPointerOut={() => {
        useExpodia.getState().setHovered(null);
        setCursor(false);
      }}
    />
  );
}

// ---------------------------------------------------------------- traffic

// Cars and ridden motorbikes from /3d-showcase looping the ring road and
// shuttling between the gates and the central plaza
function buildTraffic(sources: THREE.Object3D[]) {
  const scenes = Object.fromEntries(VEHICLE_FILES.map((f, i) => [f.slice(TRAFFIC.dir.length + 1), sources[i]!]));
  // Shuffled so neighbours on the road rarely share a model; about three
  // in ten are motorbikes
  const order = [...Array(64).keys()].sort(() => Math.random() - 0.5);
  return new ExpoTraffic((i) => {
    const k = order[i % order.length]!;
    if (k % 10 < 3) {
      const b = TRAFFIC.bikes[k % TRAFFIC.bikes.length]!;
      return new VehicleRig(scenes[b.file]!, "bike", b.file, { object: scenes[b.rider]!, file: b.rider });
    }
    const file = TRAFFIC.cars[k % TRAFFIC.cars.length]!;
    return new VehicleRig(scenes[file]!, "car", file);
  });
}

function Traffic() {
  const gltfs = useGLTF(VEHICLE_FILES);
  const traffic = useMemo(() => buildTraffic(gltfs.map((g) => g.scene)), [gltfs]);

  useFrame((_, dt) => traffic.update(dt));

  return (
    <>
      {traffic.rigs.map((r, i) => (
        <primitive key={i} object={r.root} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- slots

const padGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const hitGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

function SlotView({ slot }: { slot: Slot }) {
  const booth = useExpodia((s) => s.booths[slot.id]);
  const selected = useExpodia((s) => s.selected === slot.id);
  const hovered = useExpodia((s) => s.hovered === slot.id);
  const tier = TIER_INFO[slot.tier];
  const size = slot.footprint * 0.94;
  const padOpacity = selected ? 0.55 : hovered ? 0.4 : booth ? 0 : 0.16;

  return (
    <group position={slot.position} rotation-y={slot.rotationY}>
      {padOpacity > 0 && (
        <mesh geometry={padGeometry} scale={[size, 1, size]} position-y={0.04} renderOrder={2}>
          <meshBasicMaterial color={tier.color} transparent opacity={padOpacity} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {booth ? (
        <Suspense fallback={null}>
          <Booth slot={slot} config={booth} />
        </Suspense>
      ) : (
        <mesh
          geometry={hitGeometry}
          material={hitMaterial}
          scale={[size, 4, size]}
          onClick={(e) => {
            if (e.delta > CLICK_SLOP) return;
            e.stopPropagation();
            useExpodia.getState().select(slot.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            useExpodia.getState().setHovered(slot.id);
            setCursor(true);
          }}
          onPointerOut={() => {
            useExpodia.getState().setHovered(null);
            setCursor(false);
          }}
        />
      )}
      {hovered && (
        <Html position={[0, booth ? 8 : 4.5, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-lg border border-white/15 bg-[#0d1320]/90 px-2.5 py-1.5 text-xs text-white shadow-lg backdrop-blur">
            <span className="font-semibold" style={{ color: tier.color }}>
              {slotLabel(slot.id)}
            </span>
            <span className="text-white/60"> · {slot.footprint}×{slot.footprint} m · </span>
            {booth ? TEMPLATES[booth.template].name : <span className="text-white/80">Empty — click to set up</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- camera

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const flyTo = useExpodia((s) => s.flyTo);
  const anim = useRef<{ p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; t: number; dur: number } | null>(null);

  useEffect(() => {
    if (!flyTo || !controls.current) return;
    const t1 = new THREE.Vector3(...flyTo.target);
    // The exported booth cameras are framed for a 74° lens; ours is
    // narrower, so step back a little along the same line
    const p1 = new THREE.Vector3(...flyTo.position).sub(t1).multiplyScalar(1.15).add(t1);
    const p0 = controls.current.object.position.clone();
    const dist = p0.distanceTo(p1);
    anim.current = { p0, t0: controls.current.target.clone(), p1, t1, t: 0, dur: THREE.MathUtils.clamp(dist / 120, 0.8, 2.2) };
  }, [flyTo]);

  useFrame(({ camera }, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / a.dur);
    const k = ease(a.t);
    camera.position.lerpVectors(a.p0, a.p1, k);
    // Arc over the hall instead of cutting through the ramp
    camera.position.y += Math.sin(Math.PI * k) * Math.min(60, a.p0.distanceTo(a.p1) * 0.25);
    c.target.lerpVectors(a.t0, a.t1, k);
    c.update();
    if (a.t >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={OVERVIEW_SHOT.target}
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={520}
      maxPolarAngle={Math.PI * 0.49}
      onStart={() => (anim.current = null)}
    />
  );
}

export default function ExpodiaScene() {
  return (
    <>
      <Suspense fallback={null}>
        <Environment files={HDRI_FILE} background environmentIntensity={0.45} backgroundIntensity={0.85} />
      </Suspense>
      <fog attach="fog" args={["#c9d6e6", 320, 1400]} />
      <hemisphereLight args={["#cfe4ff", "#40372e", 0.35]} />
      <Sun />
      <Suspense fallback={null}>
        <Expo />
        {SLOTS.map((s) => (
          <SlotView key={s.id} slot={s} />
        ))}
      </Suspense>
      <Suspense fallback={null}>
        <Traffic />
      </Suspense>
      <CameraRig />
      <Effects />
    </>
  );
}
