"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { HOLD_STOPS, LAST_STOP, STOP_INDEX, STOPS, stopPosition } from "@/components/owl-world/flightPath";
import { flight, useOwlWorld } from "@/components/owl-world/owlStore";
import { sectionHeight, stopTop } from "@/components/owl-world/useFlightScroll";

/**
 * "You're about to arrive somewhere": while the owl is between stops, a
 * beacon glows at the stop it's flying to (in the scene) and a pill names it
 * and fills as the leg goes by. At the stops that hold for an extra screen of
 * scrolling, the same pill fills as you scroll through the hold, so it's
 * clear that scrolling is getting you somewhere before the owl moves.
 */

const STOP_NAMES: Record<string, string> = {
  home: "Home",
  web: "Web products",
  lab: "3D Lab",
  museum: "The Museum",
  contact: "Contact",
  return: "Home",
};

/** The stop being flown to, and how far along the leg toward it (0..1) */
export function transitState() {
  const p = flight.current;
  const back = flight.velocity < -0.01 || (Math.abs(flight.velocity) <= 0.01 && flight.target < p);
  const target = THREE.MathUtils.clamp(back ? Math.floor(p) : Math.ceil(p), 0, LAST_STOP);
  const from = back ? target + 1 : target - 1;
  const along = THREE.MathUtils.clamp(back ? from - p : p - from, 0, 1);
  // Between stops, or setting off: anything but resting on one
  const moving = Math.abs(p - Math.round(p)) > 0.02 || Math.abs(flight.velocity) > 0.02;
  return { target, along, moving };
}

/**
 * Resting at a hold stop with the page scrolled into its hold screen: how
 * far through it (0..1), and the stop that comes next. Null elsewhere
 */
function holdState() {
  const stop = Math.round(flight.current);
  if (!HOLD_STOPS.has(stop) || Math.abs(flight.current - stop) > 0.02) return null;
  const amount = THREE.MathUtils.clamp((window.scrollY - stopTop(stop)) / sectionHeight(), 0, 1);
  if (amount < 0.02) return null;
  return { amount, ready: amount > 0.97, next: Math.min(LAST_STOP, stop + 1) };
}

// ---------------------------------------------------------------- 3D beacon

const BEACON_COLOR = new THREE.Color("#ffc95c").multiplyScalar(1.8);

// A soft column of light: brightest down its core, fading out toward its
// silhouette (so it has no hard edges), up its height and into the ground
const beamVertex = /* glsl */ `
  varying float vFacing;
  varying float vUp;
  void main() {
    vUp = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }`;
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFacing;
  varying float vUp;
  void main() {
    // Clamped: interpolation can step a hair past 0..1, and pow() of a
    // negative is NaN, which bloom smears into flickering black blocks
    float up = clamp(vUp, 0.0, 1.0);
    float core = pow(clamp(vFacing, 0.0, 1.0), 2.5);
    float height = smoothstep(0.0, 0.12, up) * pow(1.0 - up, 1.6);
    gl_FragColor = vec4(uColor * core * height * uOpacity, 1.0);
  }`;

export function WaypointBeacon() {
  const group = useRef<THREE.Group>(null);
  const shown = useRef(0);
  const at = useMemo(() => new THREE.Vector3(), []);

  const beamMat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uColor: { value: BEACON_COLOR }, uOpacity: { value: 0 } }), []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const { target, along, moving } = transitState();
    // Visible in flight, fading out over the last stretch so it doesn't
    // sit on top of the owl as it lands
    const want = moving ? 1 - THREE.MathUtils.smoothstep(along, 0.82, 0.97) : 0;
    shown.current = THREE.MathUtils.damp(shown.current, want, 4, dt);
    g.visible = shown.current > 0.01;
    if (!g.visible) return;
    stopPosition(target, at);
    g.position.copy(at);
    // Both faces add up, so each carries half
    if (beamMat.current) beamMat.current.uniforms.uOpacity!.value = shown.current * 0.2;
  });

  return (
    <group ref={group} userData={{ noShadow: true }} visible={false}>
      <mesh position-y={2.6}>
        <cylinderGeometry args={[0.75, 1.0, 5.4, 32, 1, true]} />
        <shaderMaterial
          ref={beamMat}
          uniforms={uniforms}
          vertexShader={beamVertex}
          fragmentShader={beamFragment}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- DOM pill

export function TransitPill() {
  const box = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const kicker = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  // A phone on its side has no room for it beside the contact form
  const atContact = useOwlWorld((s) => s.activeStop === STOP_INDEX.contact);

  useEffect(() => {
    let raf = 0;
    let shown = 0;
    let last = performance.now();
    let lastText = "";
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { target, along, moving } = transitState();
      const hold = moving ? null : holdState();
      shown += ((moving || hold ? 1 : 0) - shown) * (1 - Math.exp(-dt * 6));
      const el = box.current;
      if (el) {
        el.style.opacity = shown.toFixed(3);
        el.style.transform = `translate(-50%, ${((1 - shown) * 12).toFixed(1)}px)`;
      }
      const arriving = along > 0.8;
      const text = hold
        ? `${hold.ready ? "Scroll once more" : "Keep scrolling"}|${STOP_NAMES[STOPS[hold.next]!.id]}`
        : `${arriving ? "Arriving" : "Flying to"}|${STOP_NAMES[STOPS[target]!.id]}`;
      if (text !== lastText && kicker.current && label.current) {
        lastText = text;
        const [k, l] = text.split("|");
        kicker.current.textContent = k!;
        label.current.textContent = l!;
      }
      if (bar.current) {
        bar.current.style.transform = `scaleX(${(hold ? hold.amount : along).toFixed(3)})`;
        // The hold meter reads paler until it's full
        bar.current.style.opacity = hold && !hold.ready ? "0.7" : "1";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={box}
      aria-hidden
      // Phones keep it up under the nav: the bottom has the form or the cards
      className={`owl-glass pointer-events-none fixed bottom-6 left-1/2 z-20 w-60 rounded-2xl px-4 py-2.5 max-md:bottom-auto max-md:top-20 ${atContact ? "short:landscape:hidden" : ""}`}
      style={{ opacity: 0, transform: "translate(-50%, 12px)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span ref={kicker} className="text-[10px] font-semibold uppercase tracking-[0.3em] text-lantern">
          Flying to
        </span>
        <span ref={label} className="truncate text-sm font-semibold text-moon-50" />
      </div>
      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10">
        <span ref={bar} className="block h-full origin-left rounded-full bg-lantern" style={{ transform: "scaleX(0)" }} />
      </span>
    </div>
  );
}
