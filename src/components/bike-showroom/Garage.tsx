"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/**
 * Hi-tech showroom around the bike while it's assembled and parked: white
 * panelled walls with cyan LED seams, vertical light blades, spec screens, a
 * glossy epoxy floor with glowing rings around the bike, a halo ring and light
 * panels in the ceiling, a sleek tool cabinet and lit display shelving. The
 * scene's depth of field throws it out of focus, so it reads as a soft bright
 * backdrop. Walls face inward only, so zooming out past them never blocks the
 * view.
 */

const ROOM = 11; // half size, metres
const HEIGHT = 5.2;
/**
 * Two finishes: "light" — white panels with pale ice LEDs (Africa Twin);
 * "dark" — graphite panels with blue LEDs and amber accents (MT-09's
 * "Dark Side of Japan"). The glow values feed emissive maps: a soft uplift
 * everywhere, LEDs at full.
 */
const PALETTES = {
  light: {
    wall: "#eef0f3",
    seam: "rgba(0,0,0,0.1)",
    seamH: "rgba(0,0,0,0.07)",
    band: "#dde1e6",
    led: "#ffffff",
    glowUplift: "#1c1f22",
    glowBand: "#101214",
    glowLed: "#e6fbff",
    wallGlow: 1.6,
    screen: "#f3f8fb",
    ui: "#1597c4",
    uiSoft: "rgba(21,151,196,",
    screenText: "#1d2a33",
    screenSub: "rgba(40,70,90,0.75)",
    trace: "#ff3b5c",
    floor: "#e3e6ea",
    speckDark: "rgba(0,0,0,0.03)",
    speckLight: "rgba(255,255,255,0.05)",
    ceiling: "#f1f3f6",
    ceilingGlow: 0.06,
    // Reflections on the floor: the studio's own environment
    floorEnv: null as string | null,
    frame: "#d9dde2",
    body: "#f4f6f8",
    trim: "#b8bec6",
    accent: "#8eeaff",
    panel: "#f2fbff",
    warm: "#ff2b48",
  },
  dark: {
    wall: "#262a31",
    seam: "rgba(0,0,0,0.35)",
    seamH: "rgba(0,0,0,0.25)",
    band: "#1a1d22",
    led: "#9fb6ff",
    glowUplift: "#0b0c0e",
    glowBand: "#000000",
    glowLed: "#3f6cff",
    wallGlow: 1.6,
    screen: "#080d1a",
    ui: "#4d7bff",
    uiSoft: "rgba(77,123,255,",
    screenText: "#eef2ff",
    screenSub: "rgba(200,212,255,0.7)",
    trace: "#ffb020",
    floor: "#22252a",
    speckDark: "rgba(0,0,0,0.12)",
    speckLight: "rgba(255,255,255,0.03)",
    ceiling: "#1b1e23",
    ceilingGlow: 0.02,
    // A flat dark reflection instead of the studio's: its bright light
    // panels would turn a glossy dark floor pale grey (the scene environment
    // overrides envMapIntensity, so it takes a map of its own)
    floorEnv: "#2a2e36" as string | null,
    frame: "#33373e",
    body: "#2a2e35",
    trim: "#4a505a",
    accent: "#2f5bff",
    panel: "#e3e9ff",
    warm: "#ffae1a",
  },
};
type Palette = (typeof PALETTES)["light"];

const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const canvasTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
};

// Wall panel layout (512 × 256 px tile = 5.5 m × 5.2 m): panel seams, a lower
// band and an LED line above it. Drawn twice — the colour map and the glow
// map (a soft uplift everywhere so the room reads bright, LEDs at full)
const drawWall = (ctx: CanvasRenderingContext2D, p: Palette, glow: boolean) => {
  ctx.fillStyle = glow ? p.glowUplift : p.wall;
  ctx.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 128) {
    ctx.fillStyle = glow ? "#000" : p.seam;
    ctx.fillRect(x, 0, 2, 256);
  }
  for (let y = 0; y < 200; y += 64) {
    ctx.fillStyle = glow ? "#000" : p.seamH;
    ctx.fillRect(0, y, 512, 2);
  }
  // Lower band
  ctx.fillStyle = glow ? p.glowBand : p.band;
  ctx.fillRect(0, 214, 512, 42);
  // LED seam + a thinner one under the ceiling
  ctx.fillStyle = glow ? p.glowLed : p.led;
  ctx.fillRect(0, 208, 512, 4);
  ctx.fillRect(0, 8, 512, 2);
};
const makeWallTexture = (p: Palette) => canvasTexture(512, 256, (ctx) => drawWall(ctx, p, false));
const makeWallGlowTexture = (p: Palette) => canvasTexture(512, 256, (ctx) => drawWall(ctx, p, true));

// Spec screen: glass with a wireframe grid, the bike's name, gauges and readouts
const makeScreenTexture = (p: Palette, title: string, line: string, seed: number) =>
  canvasTexture(512, 288, (ctx) => {
    const UI = p.ui;
    ctx.fillStyle = p.screen;
    ctx.fillRect(0, 0, 512, 288);
    ctx.strokeStyle = p.uiSoft + "0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 512; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 288);
      ctx.stroke();
    }
    for (let y = 0; y < 288; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.fillStyle = UI;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(title, 22, 38);
    ctx.font = "13px monospace";
    ctx.fillStyle = p.screenSub;
    ctx.fillText(line, 22, 60);
    // Gauge
    ctx.lineWidth = 8;
    ctx.strokeStyle = p.uiSoft + "0.18)";
    ctx.beginPath();
    ctx.arc(110, 170, 60, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    ctx.strokeStyle = UI;
    ctx.beginPath();
    ctx.arc(110, 170, 60, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * (0.55 + rand(seed) * 0.35)));
    ctx.stroke();
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = p.screenText;
    ctx.fillText(String(60 + Math.floor(rand(seed + 1) * 40)) + "%", 82, 180);
    // Bars
    for (let i = 0; i < 6; i++) {
      const h = 30 + rand(seed + i * 3) * 90;
      ctx.fillStyle = i % 2 ? p.uiSoft + "0.45)" : UI;
      ctx.fillRect(220 + i * 22, 240 - h, 14, h);
    }
    // Line trace
    ctx.strokeStyle = p.trace;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= 130; x += 5) {
      const y = 200 - Math.sin(x * 0.08 + seed) * 22 - rand(seed + x) * 10;
      if (x === 0) ctx.moveTo(370 + x, y);
      else ctx.lineTo(370 + x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = p.uiSoft + "0.5)";
    ctx.strokeRect(362, 120, 140, 130);
    ctx.fillStyle = UI;
    ctx.fillRect(0, 280, 512, 3);
  });

// Seamless glossy light epoxy floor (fine speckle only — joint lines read
// as a tiled grid around the bike)
const makeFloorTexture = (p: Palette) =>
  canvasTexture(1024, 1024, (ctx) => {
    ctx.fillStyle = p.floor;
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = rand(i) > 0.5 ? p.speckDark : p.speckLight;
      ctx.fillRect(rand(i + 1e4) * 1024, rand(i + 2e4) * 1024, 2, 2);
    }
  });

// Uniform cube map: a flat-coloured reflection
const makeFlatEnv = (color: string) => {
  const faces = Array.from({ length: 6 }, () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 4;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 4, 4);
    return canvas;
  });
  // Canvases work as cube faces; the typings only list images
  const texture = new THREE.CubeTexture(faces as unknown as HTMLImageElement[]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

// Fades: every garage material is ours, so fading them is safe
const setLevel = (materials: THREE.Material[], level: number) =>
  materials.forEach((m) => {
    m.transparent = level < 0.999;
    m.opacity = level;
  });
const setGlow = (material: THREE.MeshStandardMaterial, intensity: number) => {
  material.emissiveIntensity = intensity;
};

export default function Garage({
  palette,
  screenTitle,
  screenLine,
  show,
  lightsLevel,
  levelRef,
  worldLevel,
}: {
  palette: keyof typeof PALETTES;
  // Text on the spec screens
  screenTitle: string;
  screenLine: string;
  show: boolean;
  lightsLevel: React.RefObject<number>;
  // Out: this fade (0..1). In: the ride world's, which must be gone first
  levelRef: React.RefObject<number>;
  worldLevel: React.RefObject<number>;
}) {
  const p = PALETTES[palette];
  const textures = useMemo(() => {
    const wall = makeWallTexture(p);
    const wallGlow = makeWallGlowTexture(p);
    wall.repeat.set(4, 1);
    wallGlow.repeat.set(4, 1);
    return {
      wall,
      wallGlow,
      screens: [0, 1, 2].map((seed) => makeScreenTexture(p, screenTitle, screenLine, seed)),
      floor: makeFloorTexture(p),
    };
  }, [p, screenTitle, screenLine]);

  const materials = useMemo(() => {
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...p });
    const led = (color: string) => std({ color: "#ffffff", emissive: new THREE.Color(color), emissiveIntensity: 3 });
    return {
      wall: std({
        map: textures.wall,
        emissive: new THREE.Color("#ffffff"),
        emissiveMap: textures.wallGlow,
        emissiveIntensity: p.wallGlow,
        roughness: 0.35,
      }),
      ceiling: std({ color: p.ceiling, emissive: new THREE.Color("#ffffff"), emissiveIntensity: p.ceilingGlow }),
      screens: textures.screens.map((map) =>
        std({ map, emissive: new THREE.Color("#ffffff"), emissiveMap: map, emissiveIntensity: 0.2, roughness: 0.15 }),
      ),
      frame: std({ color: p.frame, metalness: 0.6, roughness: 0.25 }),
      white: std({ color: p.body, roughness: 0.25, metalness: 0.1 }),
      graphite: std({ color: p.trim, metalness: 0.5, roughness: 0.3 }),
      floor: std({
        map: textures.floor,
        roughness: 0.18,
        metalness: 0.1,
        envMap: p.floorEnv ? makeFlatEnv(p.floorEnv) : null,
      }),
      panel: led(p.panel),
      cyan: led(p.accent),
      red: led(p.warm),
    };
  }, [textures, p]);
  const all = useMemo(
    () => Object.values(materials).flatMap((m) => (Array.isArray(m) ? m : [m])),
    [materials],
  );

  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const goal = show && worldLevel.current < 0.01 ? 1 : 0;
    // Exit in ~0.4 s (the ride world follows once it's mostly down)
    const next = THREE.MathUtils.damp(levelRef.current, goal, goal ? 2.6 : 6, delta);
    const l = Math.abs(next - goal) < 0.002 ? goal : next;
    if (group.current) {
      group.current.visible = l > 0.001;
      // The room sinks into the floor on the way out and rises back up
      group.current.scale.y = 0.02 + 0.98 * THREE.MathUtils.smootherstep(l, 0, 1);
    }
    if (l !== levelRef.current) {
      levelRef.current = l;
      setLevel(all, l);
    }
    // Bike lights on: the room's own uplift dims (night mood) while the LEDs
    // brighten and push past the bloom threshold
    const lights = lightsLevel.current;
    setGlow(materials.wall, p.wallGlow * (1 - lights * 0.6));
    setGlow(materials.ceiling, p.ceilingGlow * (1 - lights));
    setGlow(materials.panel, 3 + lights * 0.6);
    setGlow(materials.cyan, (3 + lights * 1.2) * (0.9 + Math.sin(clock.elapsedTime * 1.6) * 0.1));
    setGlow(materials.red, 2.6 + lights * 0.8);
  });

  const wall = (position: [number, number, number], rotationY: number) => (
    <mesh position={position} rotation-y={rotationY} material={materials.wall} raycast={() => null}>
      <planeGeometry args={[ROOM * 2, HEIGHT]} />
    </mesh>
  );

  // A framed screen standing just off a wall (rotationY faces it inward)
  const screen = (position: [number, number, number], rotationY: number, index: number, w = 3.6) => (
    <group position={position} rotation-y={rotationY}>
      <mesh position-z={-0.03} material={materials.frame} raycast={() => null}>
        <boxGeometry args={[w + 0.12, w * 0.5625 + 0.12, 0.05]} />
      </mesh>
      <mesh material={materials.screens[index]!} raycast={() => null}>
        <planeGeometry args={[w, w * 0.5625]} />
      </mesh>
      {/* Glowing edge around the frame */}
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[0, (side * (w * 0.5625 + 0.16)) / 2, 0]} material={materials.panel} raycast={() => null}>
            <boxGeometry args={[w + 0.16, 0.02, 0.02]} />
          </mesh>
          <mesh position={[(side * (w + 0.16)) / 2, 0, 0]} material={materials.panel} raycast={() => null}>
            <boxGeometry args={[0.02, w * 0.5625 + 0.16, 0.02]} />
          </mesh>
        </group>
      ))}
    </group>
  );

  return (
    <group ref={group} visible={false}>
      {/* Floor sits just above the studio floor, under the shadow catchers */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.0006} material={materials.floor} receiveShadow raycast={() => null}>
        <planeGeometry args={[ROOM * 2, ROOM * 2]} />
      </mesh>
      {/* Glowing bay rings around the bike */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.0004} material={materials.cyan} raycast={() => null}>
        <ringGeometry args={[1.86, 1.9, 96]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.0004} material={materials.panel} raycast={() => null}>
        <ringGeometry args={[2.3, 2.315, 96]} />
      </mesh>

      {/* Inward-facing walls + ceiling (front faces point at the bike) */}
      {wall([0, HEIGHT / 2, ROOM], Math.PI)}
      {wall([0, HEIGHT / 2, -ROOM], 0)}
      {wall([ROOM, HEIGHT / 2, 0], -Math.PI / 2)}
      {wall([-ROOM, HEIGHT / 2, 0], Math.PI / 2)}
      {/* Light line where the walls meet the floor */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
        <mesh
          key={r}
          position={[Math.sin(r) * (ROOM - 0.03), 0.04, Math.cos(r) * (ROOM - 0.03)]}
          rotation-y={r}
          material={materials.cyan}
          raycast={() => null}
        >
          <boxGeometry args={[ROOM * 2, 0.025, 0.02]} />
        </mesh>
      ))}
      <mesh position-y={HEIGHT} rotation-x={Math.PI / 2} material={materials.ceiling} raycast={() => null}>
        <planeGeometry args={[ROOM * 2, ROOM * 2]} />
      </mesh>

      {/* Ceiling: halo over the bike + a grid of light panels */}
      <mesh position-y={HEIGHT - 0.35} rotation-x={Math.PI / 2} material={materials.cyan} raycast={() => null}>
        <torusGeometry args={[2.4, 0.035, 8, 96]} />
      </mesh>
      <mesh position-y={HEIGHT - 0.35} rotation-x={Math.PI / 2} material={materials.panel} raycast={() => null}>
        <torusGeometry args={[2.1, 0.06, 8, 96]} />
      </mesh>
      {[-7, 7].flatMap((x) =>
        [-7, 0, 7].map((z) => (
          <mesh key={`${x}${z}`} position={[x, HEIGHT - 0.03, z]} material={materials.panel} raycast={() => null}>
            <boxGeometry args={[2.6, 0.04, 2.6]} />
          </mesh>
        )),
      )}
      {[-7, 7].map((z) => (
        <mesh key={z} position={[0, HEIGHT - 0.03, z]} material={materials.panel} raycast={() => null}>
          <boxGeometry args={[2.6, 0.04, 2.6]} />
        </mesh>
      ))}

      {/* Vertical light blades between the wall panels */}
      {[-8.25, -2.75, 2.75, 8.25].flatMap((s) => [
        <mesh key={`f${s}`} position={[s, HEIGHT / 2, ROOM - 0.04]} material={materials.panel} raycast={() => null}>
          <boxGeometry args={[0.06, HEIGHT - 0.6, 0.04]} />
        </mesh>,
        <mesh key={`l${s}`} position={[-ROOM + 0.04, HEIGHT / 2, s]} material={materials.panel} raycast={() => null}>
          <boxGeometry args={[0.04, HEIGHT - 0.6, 0.06]} />
        </mesh>,
        <mesh key={`r${s}`} position={[ROOM - 0.04, HEIGHT / 2, s]} material={materials.panel} raycast={() => null}>
          <boxGeometry args={[0.04, HEIGHT - 0.6, 0.06]} />
        </mesh>,
        <mesh key={`b${s}`} position={[s, HEIGHT / 2, -ROOM + 0.04]} material={materials.panel} raycast={() => null}>
          <boxGeometry args={[0.06, HEIGHT - 0.6, 0.04]} />
        </mesh>,
      ])}

      {/* Spec screens: far wall + left wall */}
      {screen([0, 2.6, ROOM - 0.08], Math.PI, 0, 4.6)}
      {screen([-ROOM + 0.08, 2.6, 0], Math.PI / 2, 1)}
      {screen([ROOM - 0.08, 2.6, 5.5], -Math.PI / 2, 2, 3)}

      {/* Tool cabinet: white body, graphite top, red light line */}
      <group position={[-ROOM + 0.5, 0, 5.5]}>
        <mesh position-y={0.55} material={materials.white} raycast={() => null}>
          <boxGeometry args={[0.8, 1.1, 2.4]} />
        </mesh>
        <mesh position-y={1.12} material={materials.graphite} raycast={() => null}>
          <boxGeometry args={[0.86, 0.04, 2.46]} />
        </mesh>
        {[0.3, 0.6, 0.9].map((y) => (
          <mesh key={y} position={[0.41, y, 0]} material={materials.graphite} raycast={() => null}>
            <boxGeometry args={[0.01, 0.015, 2.2]} />
          </mesh>
        ))}
        <mesh position={[0.41, 1.02, 0]} material={materials.red} raycast={() => null}>
          <boxGeometry args={[0.012, 0.02, 2.3]} />
        </mesh>
        {/* Edge-lit corners + a light line along the base */}
        {[-1.2, 1.2].map((z) => (
          <mesh key={z} position={[0.4, 0.56, z]} material={materials.cyan} raycast={() => null}>
            <boxGeometry args={[0.015, 1.1, 0.015]} />
          </mesh>
        ))}
        <mesh position={[0.4, 0.02, 0]} material={materials.panel} raycast={() => null}>
          <boxGeometry args={[0.015, 0.015, 2.4]} />
        </mesh>
      </group>

      {/* Display shelving on the right wall, each shelf edge-lit */}
      {[-5.5, -1.5].map((z) => (
        <group key={z} position={[ROOM - 0.35, 0, z]}>
          {[0.6, 1.4, 2.2, 3].map((y) => (
            <group key={y} position-y={y}>
              <mesh material={materials.white} raycast={() => null}>
                <boxGeometry args={[0.55, 0.05, 2.6]} />
              </mesh>
              <mesh position={[-0.28, -0.03, 0]} material={materials.cyan} raycast={() => null}>
                <boxGeometry args={[0.01, 0.012, 2.6]} />
              </mesh>
            </group>
          ))}
          {[0.6, 1.4, 2.2].flatMap((y, i) =>
            [-0.7, 0.7].map((dz, j) => (
              <mesh
                key={`${y}${dz}`}
                position={[0, y + 0.22, dz + (rand(z + i + j) - 0.5) * 0.3]}
                material={(i + j) % 2 ? materials.graphite : materials.frame}
                raycast={() => null}
              >
                {(i + j) % 2 ? <sphereGeometry args={[0.17, 16, 12]} /> : <boxGeometry args={[0.4, 0.38, 0.5]} />}
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}
