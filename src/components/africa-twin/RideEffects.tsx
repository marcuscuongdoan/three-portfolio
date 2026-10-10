"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RIDE } from "@/config/africaTwin";
import RideWorld from "@/components/africa-twin/RideWorld";

const SMOKE_COUNT = 36;
const DUST_COUNT = 28;

const makePuffTexture = () => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

interface Particle {
  age: number;
  life: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
}

/**
 * A recycled pool of soft sprites: emits from `origin` while `level` > 0,
 * each puff drifting, growing and fading over its life.
 */
function PuffEmitter({
  count,
  origin,
  rate,
  life,
  size,
  growth,
  opacity,
  color,
  velocity,
  spread,
  level,
}: {
  count: number;
  origin: [number, number, number];
  // Puffs per second at full speed
  rate: number;
  life: number;
  size: number;
  growth: number;
  opacity: number;
  color: string;
  velocity: [number, number, number];
  spread: number;
  level: React.RefObject<number>;
}) {
  const texture = useMemo(() => makePuffTexture(), []);
  const particles = useRef<Particle[]>(
    Array.from({ length: count }, () => ({
      age: Infinity,
      life,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      size,
    })),
  );
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const toEmit = useRef(0);
  const next = useRef(0);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const ride = level.current;

    // Emit
    toEmit.current += rate * ride * delta;
    while (toEmit.current >= 1) {
      toEmit.current -= 1;
      const p = particles.current[next.current]!;
      next.current = (next.current + 1) % count;
      p.age = 0;
      p.life = life * (0.75 + Math.random() * 0.5);
      p.size = size * (0.7 + Math.random() * 0.6);
      p.position.set(...origin);
      p.velocity.set(
        velocity[0] + (Math.random() - 0.5) * spread,
        velocity[1] + (Math.random() - 0.5) * spread * 0.5,
        velocity[2] * (0.8 + Math.random() * 0.4),
      );
    }

    // Advance
    particles.current.forEach((p, i) => {
      const sprite = sprites.current[i];
      if (!sprite) return;
      if (p.age >= p.life) {
        sprite.visible = false;
        return;
      }
      p.age += delta;
      p.position.addScaledVector(p.velocity, delta);
      p.velocity.multiplyScalar(1 - 0.9 * delta);
      const t = p.age / p.life;
      sprite.visible = true;
      sprite.position.copy(p.position);
      sprite.scale.setScalar(p.size * (1 + growth * t));
      (sprite.material as THREE.SpriteMaterial).opacity = opacity * Math.sin(Math.PI * Math.min(t * 1.4, 1)) * (1 - t);
    });
  });

  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <sprite
          key={i}
          ref={(s) => {
            sprites.current[i] = s;
          }}
          visible={false}
          raycast={() => null}
        >
          <spriteMaterial map={texture} color={color} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

/** The ride world (desert → city loop), exhaust smoke and dust off the rear tyre. */
export default function RideEffects({
  groundOffset,
  world,
  rideLevel,
  lightsLevel,
  garageLevel,
  worldLevel,
}: {
  groundOffset: number;
  garageLevel: React.RefObject<number>;
  worldLevel: React.RefObject<number>;
  // The scenery streams past: riding with the backdrop on (off as soon as
  // the visitor stops or explodes)
  world: boolean;
  rideLevel: React.RefObject<number>;
  lightsLevel: React.RefObject<number>;
}) {
  const [ex, ey, ez] = RIDE.exhaustOutlet;
  const [rx, ry, rz] = RIDE.rearContact;
  return (
    <>
      <group position-y={groundOffset}>
        <PuffEmitter
          count={SMOKE_COUNT}
          origin={[ex, ey, ez]}
          rate={18}
          life={1.6}
          size={0.12}
          growth={5}
          opacity={0.3}
          // Mid grey: reads against the light studio and doesn't glare at night
          color="#8f969f"
          velocity={[0.15, 0.35, 1.4]}
          spread={0.35}
          level={rideLevel}
        />
        <PuffEmitter
          count={DUST_COUNT}
          origin={[rx, ry, rz]}
          rate={14}
          life={1.2}
          size={0.18}
          growth={4}
          opacity={0.28}
          color="#b8a68c"
          velocity={[0, 0.45, 2.6]}
          spread={0.9}
          level={rideLevel}
        />
      </group>
      <RideWorld
        riding={world}
        rideLevel={rideLevel}
        lightsLevel={lightsLevel}
        garageLevel={garageLevel}
        worldLevelRef={worldLevel}
      />
    </>
  );
}
