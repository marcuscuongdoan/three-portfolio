"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useQuality } from "@/components/owl-world/quality";
import Falling, { type FallBox } from "@/themes/shared/Falling";
import Fireworks from "@/themes/shared/Fireworks";
import Garland from "@/themes/shared/Garland";
import { LAB, LAB_FALL } from "@/themes/shared/lab";
import { facingRoad, ROAD_POSTS, WEB, WEB_FALL } from "@/themes/shared/web";
import { MUSEUM, MUSEUM_FALL } from "@/themes/shared/museum";
import { MUSEUM_SKY, VALLEY_SKY } from "@/themes/shared/sky";

/**
 * Tết: strings of red lanterns across the left of the home view, under the
 * web products and 3D lab gates' signs and along the museum walls, more hung
 * off every lamp post along the road and the museum's pylons, peach (đào)
 * and apricot (mai) blossom drifting down all the way, and fireworks down
 * the valley and behind the museum.
 */

const PETALS: FallBox[] = [[320, 0.5, -5, 8, 8, 0, 6], WEB_FALL, LAB_FALL, MUSEUM_FALL];

// The two posts the home string hangs between, clear of the mailbox and the statue
const POST_A = new THREE.Vector3(-3.3, 2.6, -3.5);
const POST_B = new THREE.Vector3(0.4, 2.6, -4.6);
const POST_H = 2.6;

function makeMats() {
  return {
    post: new THREE.MeshStandardMaterial({ color: "#3b2a20", roughness: 0.9 }),
    cord: new THREE.MeshStandardMaterial({ color: "#7a1a14", roughness: 0.8 }),
    paper: new THREE.MeshStandardMaterial({
      color: "#b3101a",
      roughness: 0.7,
      emissive: new THREE.Color("#e3121c"),
      emissiveIntensity: 0.9,
    }),
    gold: new THREE.MeshStandardMaterial({ color: "#d9a43a", roughness: 0.35, metalness: 0.7 }),
  };
}
const Mats = createContext<ReturnType<typeof makeMats> | null>(null);

function MatsProvider({ children }: { children: ReactNode }) {
  const mats = useMemo(() => makeMats(), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return <Mats.Provider value={mats}>{children}</Mats.Provider>;
}

/** A round red lantern hanging from its cord, gold-capped, with a tassel */
function Lantern({ scale = 1 }: { scale?: number }) {
  const m = useContext(Mats)!;
  return (
    <group scale={scale}>
      <mesh material={m.cord} position-y={-0.07}>
        <cylinderGeometry args={[0.005, 0.005, 0.14, 4]} />
      </mesh>
      <group position-y={-0.33}>
        <mesh material={m.gold} position-y={0.17}>
          <cylinderGeometry args={[0.07, 0.08, 0.04, 12]} />
        </mesh>
        <mesh material={m.paper} scale={[1, 0.85, 1]}>
          <sphereGeometry args={[0.18, 20, 14]} />
        </mesh>
        <mesh material={m.gold} position-y={-0.16}>
          <cylinderGeometry args={[0.08, 0.06, 0.04, 12]} />
        </mesh>
        <mesh material={m.paper} position-y={-0.27}>
          <cylinderGeometry args={[0.012, 0.025, 0.18, 6]} />
        </mesh>
      </group>
    </group>
  );
}

function HomeLanterns() {
  const m = useContext(Mats)!;
  return (
    <>
      {[POST_A, POST_B].map((p, i) => (
        <mesh key={i} material={m.post} position={[p.x, POST_H / 2, p.z]}>
          <cylinderGeometry args={[0.035, 0.045, POST_H, 8]} />
        </mesh>
      ))}
      <Garland from={POST_A} to={POST_B} sag={0.4} ropeColor="#7a1a14" hangs={5}>
        {() => <Lantern />}
      </Garland>
    </>
  );
}

/** Under a gate's sign */
function GateLanterns({ garland }: { garland: typeof LAB.garland }) {
  return (
    <Garland {...garland} ropeColor="#7a1a14" bulbs={{ count: 12, colors: ["#ffd166"] }} hangs={3}>
      {(i) => <Lantern scale={i === 1 ? 0.8 : 0.65} />}
    </Garland>
  );
}

/** A gold bracket out over the road from each lamp post, a lantern hanging off its end */
function RoadLanterns() {
  const m = useContext(Mats)!;
  return (
    <>
      {ROAD_POSTS.map(({ pos, away }, i) => (
        <group key={i} position={[pos.x, 1.42, pos.z]} rotation-y={facingRoad(away)}>
          <mesh material={m.gold} position-z={0.17} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.012, 0.012, 0.34, 6]} />
          </mesh>
          <group position-z={0.32}>
            <Lantern scale={0.55} />
          </group>
        </group>
      ))}
    </>
  );
}

function MuseumLanterns() {
  const m = useContext(Mats)!;
  return (
    <>
      {MUSEUM.garlands.map((g, w) => (
        <Garland key={w} {...g} ropeColor="#7a1a14" bulbs={{ count: 12, colors: ["#ffd166"] }} hangs={3}>
          {() => <Lantern scale={0.5} />}
        </Garland>
      ))}
      {/* A bracket out from each pylon, a lantern hanging off its end */}
      {MUSEUM.pylons.map((p, i) => (
        <group key={i} position={p.at(4.3, 0)} rotation-y={p.yaw}>
          <mesh material={m.gold} position-z={0.45} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
          </mesh>
          <group position-z={0.68}>
            <Lantern />
          </group>
        </group>
      ))}
    </>
  );
}

function Glows() {
  const { accentLights } = useQuality();
  if (!accentLights) return null;
  return (
    <>
      <pointLight position={[(POST_A.x + POST_B.x) / 2, 1.8, (POST_A.z + POST_B.z) / 2]} color="#ff4a2a" intensity={2.5} distance={4} decay={1.8} />
      {[LAB.gate, WEB.gate].map((g, i) => (
        <pointLight key={i} position={[g.x, 4.6, g.z + 0.6]} color="#ff4a2a" intensity={2.5} distance={4} decay={1.8} />
      ))}
    </>
  );
}

export default function LunarNewYearScene() {
  return (
    <>
      <MatsProvider>
        <HomeLanterns />
        <GateLanterns garland={WEB.garland} />
        <GateLanterns garland={LAB.garland} />
        <RoadLanterns />
        <MuseumLanterns />
      </MatsProvider>
      <Glows />
      <Falling boxes={PETALS} colors={["#ffb3c7", "#ff8fb1", "#ffc9d6", "#ffd34d"]} size={9} speed={[0.25, 0.55]} sway={0.7} petal seed={17} />
      <Fireworks {...VALLEY_SKY} bursts={4} colors={["#ff4b3a", "#ffd166", "#ff8a3d", "#fff1c1"]} seed={9} />
      <Fireworks {...MUSEUM_SKY} bursts={3} colors={["#ff4b3a", "#ffd166", "#ff8a3d", "#fff1c1"]} seed={13} />
    </>
  );
}
