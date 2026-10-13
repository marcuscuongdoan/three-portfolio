"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { LAST_STOP, STOPS, stopPosition } from "@/components/owl-world/flightPath";
import { flight } from "@/components/owl-world/owlStore";

/**
 * "You're about to arrive somewhere": while the owl is between stops, a
 * beacon glows at the stop it's flying to (in the scene) and a pill at the
 * bottom of the screen names it and fills as the leg goes by.
 */

const STOP_NAMES: Record<string, string> = {
  home: "Home",
  loop: "Take-off",
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

// ---------------------------------------------------------------- 3D beacon

const BEACON_COLOR = new THREE.Color("#ffc95c").multiplyScalar(1.8);

export function WaypointBeacon() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef(0);
  const at = useMemo(() => new THREE.Vector3(), []);

  // A soft vertical beam: bright at the bottom, gone at the top
  const beamTexture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 128, 0, 0);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => beamTexture.dispose(), [beamTexture]);

  useFrame(({ clock }, dt) => {
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
    const t = clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.z = t * 0.8;
      ring.current.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    }
    if (ringMat.current) ringMat.current.opacity = shown.current * 0.9;
    if (beamMat.current) beamMat.current.opacity = shown.current * 0.35;
  });

  // Perches sit on things; a beacon for them starts lower
  return (
    <group ref={group} userData={{ noShadow: true }} visible={false}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.05}>
        <torusGeometry args={[0.85, 0.035, 8, 48]} />
        <meshBasicMaterial ref={ringMat} color={BEACON_COLOR} toneMapped={false} transparent depthWrite={false} />
      </mesh>
      <mesh position-y={2.4}>
        <cylinderGeometry args={[0.55, 0.85, 5, 24, 1, true]} />
        <meshBasicMaterial
          ref={beamMat}
          color={BEACON_COLOR}
          map={beamTexture}
          toneMapped={false}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
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

  useEffect(() => {
    let raf = 0;
    let shown = 0;
    let last = performance.now();
    let lastText = "";
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { target, along, moving } = transitState();
      shown += ((moving ? 1 : 0) - shown) * (1 - Math.exp(-dt * 6));
      const el = box.current;
      if (el) {
        el.style.opacity = shown.toFixed(3);
        el.style.transform = `translate(-50%, ${((1 - shown) * 12).toFixed(1)}px)`;
      }
      const arriving = along > 0.8;
      const text = `${arriving ? "Arriving" : "Flying to"}|${STOP_NAMES[STOPS[target]!.id]}`;
      if (text !== lastText && kicker.current && label.current) {
        lastText = text;
        const [k, l] = text.split("|");
        kicker.current.textContent = k!;
        label.current.textContent = l!;
      }
      if (bar.current) bar.current.style.transform = `scaleX(${along.toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={box}
      aria-hidden
      className="owl-glass pointer-events-none fixed bottom-5 left-1/2 z-20 w-56 rounded-2xl px-4 py-2.5 sm:bottom-6"
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
