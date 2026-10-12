"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { PlantDefinition, PlantFlow, Vec3 } from "@/config/gasTurbine";
import type { PlantSim } from "@/components/plant-showroom/plantSim";

/* ---------------------------------- Flows --------------------------------- */

const flowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Dashes running along the tube (uv.x is the distance along it, 0..1)
const flowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLength;
  uniform float uOffset;
  uniform float uLevel;
  varying vec2 vUv;
  void main() {
    float s = vUv.x * uLength - uOffset;
    float d = fract(s / 0.24);
    float dash = smoothstep(0.0, 0.12, d) * (1.0 - smoothstep(0.42, 0.58, d));
    // Fade in at the start and out at the end of the path
    float ends = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
    float a = uLevel * ends * (0.22 + 0.78 * dash);
    // HDR on the dashes so the bloom pass picks them up
    gl_FragColor = vec4(uColor * (0.9 + dash * 2.2), a);
  }
`;

const pathCurve = (path: Vec3[]) => {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < path.length; i++) {
    curve.add(new THREE.LineCurve3(new THREE.Vector3(...path[i - 1]!), new THREE.Vector3(...path[i]!)));
  }
  return curve;
};

interface FlowRuntime {
  flow: PlantFlow;
  geometry: THREE.TubeGeometry;
  material: THREE.ShaderMaterial;
  length: number;
}

const buildFlows = (flows: PlantFlow[]): FlowRuntime[] =>
  flows.map((flow) => {
    const curve = pathCurve(flow.path);
    const length = curve.getLength();
    // Straight runs need few rings; every corner needs its own
    const geometry = new THREE.TubeGeometry(curve, Math.ceil(length * 30) + flow.path.length * 4, flow.width / 2, 8);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(flow.color) },
        uLength: { value: length },
        uOffset: { value: 0 },
        uLevel: { value: 0 },
      },
      vertexShader: flowVertex,
      fragmentShader: flowFragment,
      transparent: true,
      // Drawn through the casings: the flows are an x-ray overlay
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { flow, geometry, material, length };
  });

const setFlowUniforms = (f: FlowRuntime, offset: number, level: number) => {
  f.material.uniforms.uOffset!.value = offset;
  f.material.uniforms.uLevel!.value = level;
};

/* --------------------------------- Exhaust -------------------------------- */

const PLUME_PARTICLES = 420;
const PLUME_LIFE = 3.2;

const plumeVertex = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aPhase;
  uniform float uTime;
  uniform float uLife;
  uniform vec3 uOutlet;
  uniform vec3 uDir;
  uniform float uPixelRatio;
  varying float vAge;
  void main() {
    float age = fract((uTime + aPhase * uLife) / uLife);
    vAge = age;
    float t = age * uLife;
    // Out of the hood, then the hot gas rises and spreads in the wind
    vec3 p = uOutlet
      + uDir * t * 0.55
      + vec3(0.0, 1.0, 0.0) * t * t * 0.09
      + vec3(0.18, 0.0, 0.05) * t * t * 0.08
      + aSeed * (0.05 + t * 0.22);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (40.0 + 150.0 * age) * uPixelRatio / max(-mv.z, 0.1);
  }
`;
const plumeFragment = /* glsl */ `
  uniform float uLevel;
  uniform float uPuff;
  varying float vAge;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float soft = 1.0 - d * 4.0;
    // Light-off: a dark puff; running: a thin pale heat haze
    vec3 haze = vec3(0.78, 0.8, 0.84);
    vec3 smoke = vec3(0.16, 0.15, 0.15);
    vec3 col = mix(haze, smoke, uPuff);
    float fade = smoothstep(0.0, 0.08, vAge) * (1.0 - smoothstep(0.45, 1.0, vAge));
    float a = soft * fade * uLevel * mix(0.08, 0.5, uPuff);
    gl_FragColor = vec4(col, a);
  }
`;

const buildPlume = () => {
  const geometry = new THREE.BufferGeometry();
  const seeds = new Float32Array(PLUME_PARTICLES * 3);
  const phases = new Float32Array(PLUME_PARTICLES);
  const v = new THREE.Vector3();
  for (let i = 0; i < PLUME_PARTICLES; i++) {
    v.randomDirection().multiplyScalar(Math.random());
    seeds.set([v.x, v.y * 0.5, v.z], i * 3);
    phases[i] = Math.random();
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PLUME_PARTICLES * 3), 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  return geometry;
};

const setPlumeUniforms = (m: THREE.ShaderMaterial, time: number, level: number, puff: number, dpr: number) => {
  m.uniforms.uTime!.value = time;
  m.uniforms.uLevel!.value = level;
  m.uniforms.uPuff!.value = puff;
  m.uniforms.uPixelRatio!.value = dpr;
};

// Pins a page element to a model-space point (hidden behind the camera)
const placeLabel = (
  el: HTMLElement,
  point: THREE.Vector3,
  camera: THREE.Camera,
  size: { width: number; height: number },
  visible: boolean,
) => {
  const p = point.clone().project(camera);
  const onScreen = p.z < 1;
  el.style.transform = `translate(-50%, -50%) translate(${((p.x + 1) / 2) * size.width}px, ${((1 - p.y) / 2) * size.height}px)`;
  el.style.opacity = visible && onScreen ? "1" : "0";
};

/**
 * What runs through the unit while it runs, driven by the simulation: air,
 * fuel, anti-icing air and power as dashes along their pipes and ducts (an
 * x-ray overlay), and the exhaust leaving the stack.
 */
export default function PlantFlows({
  def,
  sim,
  groundOffset,
  show,
  selected,
  busLabel,
}: {
  def: PlantDefinition;
  sim: PlantSim;
  groundOffset: number;
  // The flows overlay toggle (the exhaust always shows)
  show: boolean;
  selected: string | null;
  // Page element tagging where the power leaves for the safety buses
  busLabel: React.RefObject<HTMLDivElement | null>;
}) {
  const flows = useMemo(() => buildFlows(def.flows), [def]);
  // Distance each flow's dashes have travelled
  const offsets = useRef(flows.map(() => 0));
  const levels = useRef(flows.map(() => 0));

  const plumeGeometry = useMemo(() => buildPlume(), []);
  const plumeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uLife: { value: PLUME_LIFE },
          uOutlet: { value: new THREE.Vector3(...def.stackOutlet) },
          uDir: { value: new THREE.Vector3(...def.stackDirection).normalize() },
          uLevel: { value: 0 },
          uPuff: { value: 0 },
          uPixelRatio: { value: 1 },
        },
        vertexShader: plumeVertex,
        fragmentShader: plumeFragment,
        transparent: true,
        depthWrite: false,
      }),
    [def],
  );
  const plumeLevel = useRef(0);
  const plumeTime = useRef(0);
  const gridEnd = useMemo(() => {
    const end = def.flows.find((f) => f.id === "grid")?.path.at(-1);
    return end ? new THREE.Vector3(end[0], end[1] + groundOffset, end[2]) : null;
  }, [def, groundOffset]);

  useFrame(({ viewport, camera, size }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const s = sim.state;
    flows.forEach((f, i) => {
      const goal = (show ? s.flows[f.flow.id] : 0) * (selected && selected !== f.flow.part ? 0.15 : 1);
      levels.current[i] = THREE.MathUtils.damp(levels.current[i]!, goal, 4, delta);
      const level = levels.current[i]!;
      offsets.current[i] = (offsets.current[i]! + delta * f.flow.speed * Math.max(s.flows[f.flow.id], 0.15)) % 1000;
      setFlowUniforms(f, offsets.current[i]!, level < 0.002 ? 0 : level);
    });

    plumeLevel.current = THREE.MathUtils.damp(plumeLevel.current, s.flows.exhaust, 3, delta);
    plumeTime.current += delta * (0.6 + 0.6 * s.flows.exhaust);
    setPlumeUniforms(plumeMaterial, plumeTime.current, plumeLevel.current, Math.min(s.puff * 1.4, 1), viewport.dpr);

    // Safety-bus tag: only while the unit feeds the plant
    if (busLabel.current && gridEnd) placeLabel(busLabel.current, gridEnd, camera, size, show && s.busLive && !selected);
  });

  return (
    <group position-y={groundOffset}>
      {flows.map((f) => (
        <mesh
          key={`${f.flow.id}-${f.flow.path[0]!.join()}`}
          geometry={f.geometry}
          material={f.material}
          renderOrder={5}
          raycast={() => null}
        />
      ))}
      <points geometry={plumeGeometry} material={plumeMaterial} renderOrder={4} raycast={() => null} />
    </group>
  );
}
