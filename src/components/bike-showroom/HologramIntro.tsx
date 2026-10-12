"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import type { IntroSettings } from "@/config/bikeShowroom";

/**
 * What the intro needs of the model on show (a bike — BikeRuntime — or the
 * plant showroom's unit): its meshes by part, the lift that puts it on the
 * floor, the clipping plane on its own materials and its root object
 */
export interface IntroSubject {
  parts: Map<string, { meshes: THREE.Mesh[] }>;
  groundOffset: number;
  introPlane: THREE.Plane;
  root: THREE.Object3D;
}

// Mutating objects that came in through props / memos lives outside the
// component (the React Compiler forbids it inline)
const setPlaneConstant = (plane: THREE.Plane, constant: number) => {
  plane.constant = constant;
};
const setOpacity = (material: THREE.Material, opacity: number) => {
  material.opacity = opacity;
};

// Before a sweep starts its edge parks in front of the bike (nothing
// revealed); after it ends, behind it (everything revealed)
const hiddenZ = (intro: IntroSettings) => intro.zFront - 1;
const sweepZ = (intro: IntroSettings, t: number, start: number, end: number) => {
  if (t < start) return hiddenZ(intro);
  const k = THREE.MathUtils.smoothstep(t, start, end);
  return THREE.MathUtils.lerp(intro.zFront - 0.1, intro.zBack + 0.1, k);
};

const pointsVertex = /* glsl */ `
  attribute vec3 aStart;
  attribute float aDelay;
  attribute float aRand;
  uniform float uTime;
  uniform float uFlight;
  uniform float uReveal;
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vEdge;
  void main() {
    float t = clamp((uTime - aDelay) / uFlight, 0.0, 1.0);
    float eased = 1.0 - pow(1.0 - t, 3.0);
    vec3 p = mix(aStart, position, eased);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // The shape sweep takes over everything in front of it (z < uReveal)
    float keep = smoothstep(uReveal - 0.06, uReveal + 0.02, position.z);
    vEdge = exp(-abs(position.z - uReveal) * 18.0);
    vAlpha = smoothstep(0.0, 0.3, t) * keep;
    gl_PointSize = uSize * uPixelRatio * (0.6 + aRand * 0.9) * (1.0 + vEdge * 1.5) / max(-mv.z, 0.1);
  }
`;
const pointsFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade;
  varying float vAlpha;
  varying float vEdge;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float soft = 1.0 - d * 4.0;
    // HDR, just over the bloom threshold. Kept low: points stack additively,
    // and where many meshes overlap (engine, frame) they'd burn to white
    gl_FragColor = vec4(uColor * (1.35 + vEdge * 2.5), vAlpha * soft * uFade * 0.32);
  }
`;

// Laser origins, far outside the frame so the beams cut across the screen
const LASER_ANCHORS: [number, number, number][] = [
  [-7, 4.5, -2],
  [6.5, 5, -4.5],
  [7, 3, 4],
  [-6, 2.2, 6],
  [0.5, 7.5, -6],
];
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Samples the bike's surface (area-weighted across every mesh) into the
 * hologram point cloud — each point appears as the scan edge passes its Z —
 * and lists every mesh with its bike-space matrix for the clay copy.
 */
const buildIntro = (bike: IntroSubject, INTRO: IntroSettings) => {
  const meshes = [...bike.parts.values()].flatMap((p) => p.meshes).filter((m) => m.visible);
  bike.root.updateMatrixWorld(true);
  const toRoot = bike.root.matrixWorld.clone().invert();

  const sources = meshes.map((mesh) => {
    const sampler = new MeshSurfaceSampler(mesh).build();
    const distribution = (sampler as unknown as { distribution: Float32Array }).distribution;
    const area = distribution[distribution.length - 1] ?? 0;
    const matrix = toRoot.clone().multiply(mesh.matrixWorld);
    return { mesh, sampler, area, matrix };
  });
  const totalArea = sources.reduce((sum, s) => sum + s.area, 0) || 1;

  const positions: number[] = [];
  const starts: number[] = [];
  const delays: number[] = [];
  const rands: number[] = [];
  const p = new THREE.Vector3();
  const jitter = new THREE.Vector3();
  const span = INTRO.zBack - INTRO.zFront;
  const scanLength = INTRO.scanEnd - INTRO.scanStart;

  sources.forEach(({ sampler, area, matrix }) => {
    const count = Math.round((INTRO.points * area) / totalArea);
    for (let i = 0; i < count; i++) {
      sampler.sample(p);
      p.applyMatrix4(matrix);
      positions.push(p.x, p.y, p.z);

      jitter.randomDirection().multiplyScalar(Math.random() * 0.25);
      starts.push(
        p.x + INTRO.fromOffset[0] + jitter.x,
        p.y + INTRO.fromOffset[1] + jitter.y,
        p.z + INTRO.fromOffset[2] + jitter.z,
      );
      // Appear right as the scan edge reaches this point
      const front = THREE.MathUtils.clamp((p.z - INTRO.zFront) / span, 0, 1);
      delays.push(INTRO.scanStart + front * scanLength - INTRO.flight * 0.3 + Math.random() * 0.12);
      rands.push(Math.random());
    }
  });

  const cloud = new THREE.BufferGeometry();
  cloud.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  cloud.setAttribute("aStart", new THREE.Float32BufferAttribute(starts, 3));
  cloud.setAttribute("aDelay", new THREE.Float32BufferAttribute(delays, 1));
  cloud.setAttribute("aRand", new THREE.Float32BufferAttribute(rands, 1));
  // Never cull the cloud (points start outside the bike's bounds)
  cloud.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

  const clay = sources.map(({ mesh, matrix }) => ({ geometry: mesh.geometry, matrix }));
  return { cloud, clay };
};

/**
 * The first-load intro (see INTRO): hologram point cloud built up by the
 * first sweep, with lasers on its edge, then the clay shape, then the real materials — each swap a
 * front-to-back sweep, done with clipping planes on the clay copy and on the
 * bike's own materials. Driven by `clock`: seconds since the intro began,
 * negative before it starts.
 */
export default function HologramIntro({
  bike,
  clock,
  intro: INTRO,
  laserSpan = 0.75,
}: {
  bike: IntroSubject;
  clock: React.RefObject<number>;
  intro: IntroSettings;
  // Height range above the floor the lasers sweep over
  laserSpan?: number;
}) {
  const HIDDEN_Z = hiddenZ(INTRO);
  const { cloud, clay } = useMemo(() => buildIntro(bike, INTRO), [bike, INTRO]);

  // Clay shows between the two sweeps: in front of the shape edge (z below
  // it) and behind the texture edge (z above it)
  const clayPlanes = useMemo(
    () => ({
      shape: new THREE.Plane(new THREE.Vector3(0, 0, -1), HIDDEN_Z),
      texture: new THREE.Plane(new THREE.Vector3(0, 0, 1), -HIDDEN_Z),
    }),
    [HIDDEN_Z],
  );
  const clayMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#eeeef1",
        roughness: 0.55,
        metalness: 0,
        clippingPlanes: [clayPlanes.shape, clayPlanes.texture],
      }),
    [clayPlanes],
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlight: { value: INTRO.flight },
      uReveal: { value: HIDDEN_Z },
      uSize: { value: 9 },
      uPixelRatio: { value: 1 },
      uFade: { value: 1 },
      uColor: { value: new THREE.Color(...INTRO.color) },
    }),
    [INTRO, HIDDEN_Z],
  );

  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const beams = useRef<(THREE.Mesh | null)[]>([]);
  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.9, 2.6, 2.2),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const beamGeometry = useMemo(() => {
    // Unit length along +Y, base at the origin
    const g = new THREE.CylinderGeometry(0.004, 0.004, 1, 6, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const scratch = useMemo(
    () => ({ target: new THREE.Vector3(), anchor: new THREE.Vector3(), dir: new THREE.Vector3() }),
    [],
  );

  useFrame(({ viewport }) => {
    const t = clock.current;
    const u = material.current?.uniforms;
    if (!group.current || !u) return;

    if (t < 0 || t >= INTRO.end) {
      group.current.visible = false;
      setPlaneConstant(bike.introPlane, t < 0 ? -100 : 100);
      return;
    }
    group.current.visible = true;

    const shapeZ = sweepZ(INTRO, t, INTRO.shapeStart, INTRO.shapeEnd);
    const textureZ = sweepZ(INTRO, t, INTRO.textureStart, INTRO.textureEnd);
    setPlaneConstant(clayPlanes.shape, shapeZ);
    setPlaneConstant(clayPlanes.texture, -textureZ);
    setPlaneConstant(bike.introPlane, t < INTRO.textureStart ? -100 : textureZ);

    u.uTime!.value = t;
    u.uReveal!.value = shapeZ;
    u.uPixelRatio!.value = viewport.dpr;
    u.uFade!.value = 1 - THREE.MathUtils.smoothstep(t, INTRO.shapeEnd, INTRO.shapeEnd + 0.2);

    // Lasers converge on whichever sweep edge is running
    const scanZ =
      t < INTRO.shapeStart
        ? sweepZ(INTRO, t, INTRO.scanStart, INTRO.scanEnd)
        : t < INTRO.textureStart
          ? shapeZ
          : textureZ;
    // Lasers run during the first sweep only
    scratch.target.set(
      Math.sin(t * 5.3) * 0.12,
      bike.groundOffset + 0.15 + Math.abs(Math.sin(t * 2.7)) * laserSpan,
      scanZ,
    );
    const beamOn =
      THREE.MathUtils.smoothstep(t, INTRO.scanStart, INTRO.scanStart + 0.3) *
      (1 - THREE.MathUtils.smoothstep(t, INTRO.scanEnd, INTRO.shapeStart + 0.2));
    setOpacity(glowMaterial, beamOn * (0.45 + Math.random() * 0.35));
    beams.current.forEach((beam, i) => {
      if (!beam) return;
      scratch.anchor.set(...LASER_ANCHORS[i]!);
      scratch.dir.subVectors(scratch.target, scratch.anchor);
      const length = scratch.dir.length();
      beam.position.copy(scratch.anchor);
      beam.quaternion.setFromUnitVectors(UP, scratch.dir.divideScalar(length));
      beam.scale.set(1, length, 1);
      beam.visible = beamOn > 0.01;
    });
  });

  return (
    <group ref={group} visible={false}>
      <group position-y={bike.groundOffset}>
        <points geometry={cloud} raycast={() => null}>
          <shaderMaterial
            ref={material}
            uniforms={uniforms}
            vertexShader={pointsVertex}
            fragmentShader={pointsFragment}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
        {/* Clay copy: bike-space matrices baked from the real meshes */}
        {clay.map(({ geometry, matrix }, i) => (
          <mesh
            key={i}
            geometry={geometry}
            material={clayMaterial}
            matrix={matrix}
            matrixAutoUpdate={false}
            raycast={() => null}
          />
        ))}
      </group>
      {LASER_ANCHORS.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            beams.current[i] = m;
          }}
          geometry={beamGeometry}
          material={glowMaterial}
          raycast={() => null}
        />
      ))}
    </group>
  );
}
