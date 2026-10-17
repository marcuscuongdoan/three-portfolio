"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProjectsMenu } from "@/components/ProjectSheet";
import {
  KHOC_BLOCK_PORTRAIT,
  KHOC_BLOCK_SPOTS,
  KHOC_BLOCK_TIMING as T,
  KHOC_BLOCK_YOUTUBE_ID,
} from "@/config/khocBlock";

type Status = "idle" | "starting" | "playing" | "paused" | "ended";

// What the frame shows at a given track time; only re-rendered when it changes
type Cue = {
  lit: number; // how many hits have landed
  titleHit: number; // hit whose title flash is on screen, -1 for none
  even: boolean;
};

const NO_CUE: Cue = { lit: 0, titleHit: -1, even: false };
const LAST_HIT = T.hits[T.hits.length - 1]!;
const EVEN_FROM = LAST_HIT.at + T.flashHold;

function cueAt(t: number): Cue {
  const lit = T.hits.filter((h) => t >= h.at).length;
  const lastHit = T.hits[lit - 1];
  const titleHit = lastHit !== undefined && t < lastHit.at + T.flashHold ? lit - 1 : -1;
  return { lit, titleHit, even: t >= EVEN_FROM };
}

const sameCue = (a: Cue, b: Cue) =>
  a.lit === b.lit && a.titleHit === b.titleHit && a.even === b.even;

// Just the slice of the YouTube IFrame API this page calls
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  setVolume(volume: number): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: () => void;
      };
    },
  ) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}
const IS_DEV = process.env.NODE_ENV === "development";
// Typical lag between hearing the shout and hitting K
const TAP_LATENCY = 0.15;

const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;

let ytApi: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  ytApi ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      ytApi = null;
      reject(new Error("YouTube IFrame API failed to load"));
    };
    document.head.appendChild(script);
  });
  return ytApi;
}

export default function KhocBlockPage() {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const playingRef = useRef(false);
  const torchRef = useRef<HTMLImageElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  // Player time of the last frame, for measuring the offset with K
  const playerTimeRef = useRef(0);
  // Dev-only override of T.offset while tuning; copy the final value into the config
  const [offset, setOffset] = useState<number>(T.offset);
  const offsetRef = useRef<number>(T.offset);
  // Silent clock's position, so a pause resumes where it stopped
  const silentFromRef = useRef(0);
  const [status, setStatus] = useState<Status>("idle");
  const [cue, setCue] = useState<Cue>(NO_CUE);
  const [playerReady, setPlayerReady] = useState(false);
  // Player blocked or unavailable → the timeline still runs on a silent clock
  const [silent, setSilent] = useState(false);
  // Browser refused a scripted play (iOS) → ask for a tap on the player itself
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const frame = playerHostRef.current;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !frame) return;
        // The API swaps its target for an iframe, so hand it a node React doesn't own
        const host = document.createElement("div");
        frame.replaceChildren(host);
        playerRef.current = new YT.Player(host, {
          videoId: KHOC_BLOCK_YOUTUBE_ID,
          width: "100%",
          height: "100%",
          playerVars: { start: Math.max(0, Math.floor(T.chorusStart + offsetRef.current)), playsinline: 1, rel: 0 },
          events: {
            onReady: () => setPlayerReady(true),
            onStateChange: ({ data }) => {
              playingRef.current = data === YT_PLAYING;
              if (data === YT_PLAYING) {
                // Started from the player's own button at the top of the track → jump to the chorus
                const player = playerRef.current;
                const chorusAt = T.chorusStart + offsetRef.current;
                if (player && player.getCurrentTime() < chorusAt - 1) player.seekTo(chorusAt, true);
                setNeedsTap(false);
                setStatus("playing");
              } else if (data === YT_PAUSED) {
                setStatus((prev) => (prev === "playing" ? "paused" : prev));
              } else if (data === YT_ENDED) {
                setStatus("ended");
              }
            },
            onError: () => setSilent(true),
          },
        });
      })
      .catch(() => !cancelled && setSilent(true));
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      frame?.replaceChildren();
    };
  }, []);

  // Drive the cues off the player clock (or wall clock when silent). The
  // player only reports its time every few frames, so interpolate between reports
  useEffect(() => {
    if (status !== "playing") return;
    const startedAt = performance.now();
    const silentFrom = silentFromRef.current;
    let reported = -1;
    let reportedAt = startedAt;
    let frame = 0;
    let current = NO_CUE;
    const tick = () => {
      const now = performance.now();
      // Player time, then mapped onto the timeline the cues are written in
      let playerTime: number;
      const player = playerRef.current;
      if (silent || !player) {
        playerTime = silentFrom + (now - startedAt) / 1000;
      } else {
        const latest = player.getCurrentTime();
        if (latest !== reported) {
          reported = latest;
          reportedAt = now;
        }
        playerTime = reported + (playingRef.current ? Math.min(0.5, (now - reportedAt) / 1000) : 0);
      }
      playerTimeRef.current = playerTime;
      const t = playerTime - offsetRef.current;
      const next = cueAt(t);
      if (!sameCue(next, current)) {
        current = next;
        setCue(next);
      }
      if (clockRef.current) clockRef.current.textContent = `${playerTime.toFixed(2)} (cue ${t.toFixed(2)})`;
      // Stop point: fade the volume down, then pause and show Replay
      if (T.stopAt !== null) {
        const left = T.stopAt - t;
        if (left <= 0) {
          if (player && !silent) player.pauseVideo();
          setStatus("ended");
          return;
        }
        if (player && !silent && left < T.fadeOut) player.setVolume(Math.round((left / T.fadeOut) * 100));
      }
      if (silent && playerTime > T.duration) {
        setStatus("ended");
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, silent]);

  const start = useCallback(() => {
    setCue(NO_CUE);
    const player = playerRef.current;
    if (silent || !player) {
      silentFromRef.current = T.chorusStart + offsetRef.current;
      setStatus("playing");
      return;
    }
    setStatus("starting");
    player.setVolume(100);
    player.seekTo(Math.max(0, T.chorusStart + offsetRef.current), true);
    player.playVideo();
  }, [silent]);

  // One button: play from the chorus, pause, resume, replay
  const toggle = useCallback(() => {
    const player = silent ? null : playerRef.current;
    if (status === "playing") {
      silentFromRef.current = playerTimeRef.current;
      if (player) player.pauseVideo();
      else setStatus("paused");
    } else if (status === "paused") {
      if (player) player.playVideo();
      else setStatus("playing");
    } else if (status !== "starting") {
      start();
    }
  }, [silent, status, start]);

  // Scripted play can be refused without an error; fall back to a tap on the player
  useEffect(() => {
    if (status !== "starting") return;
    const id = setTimeout(() => setNeedsTap(true), 2500);
    return () => clearTimeout(id);
  }, [status]);

  // Space toggles like the button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A focused button already turns Space into its own click
      if (e.key !== " " || e.repeat || (e.target instanceof HTMLElement && e.target.closest("button"))) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  // Paused keeps the frame as it was; only idle and ended go back to dark
  const playing = status === "playing";
  const active = playing || status === "paused";

  // Dev tuning: K on the shouted "Khóc" measures the offset, [ and ] nudge it
  useEffect(() => {
    if (!IS_DEV) return;
    const onKey = (e: KeyboardEvent) => {
      let nextOffset: number | null = null;
      if (e.key === "k" || e.key === "K") nextOffset = playerTimeRef.current - TAP_LATENCY - T.hits[0]!.at;
      else if (e.key === "[") nextOffset = offsetRef.current - 0.05;
      else if (e.key === "]") nextOffset = offsetRef.current + 0.05;
      if (nextOffset === null) return;
      const rounded = Math.round(nextOffset * 100) / 100;
      offsetRef.current = rounded;
      setOffset(rounded);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Torch: the part of the portrait under the pointer lights up. Written
  // straight to CSS vars so moving the mouse never re-renders the page
  const moveTorch = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const torch = torchRef.current;
    if (!torch) return;
    const box = torch.getBoundingClientRect();
    torch.style.setProperty("--mx", `${((e.clientX - box.left) / box.width) * 100}%`);
    torch.style.setProperty("--my", `${((e.clientY - box.top) / box.height) * 100}%`);
    torch.classList.add("is-on");
  }, []);
  const hideTorch = useCallback(() => torchRef.current?.classList.remove("is-on"), []);

  const canStart = playerReady || silent;

  return (
    <main
      className={`fixed inset-0 overflow-clip select-none ${cue.even && active ? "kb-even" : ""}`}
      style={{ "--kb-ramp": `${T.evenRamp}s`, "--kb-hold": `${T.flashHold}s` } as React.CSSProperties}
      onPointerMove={moveTorch}
      onPointerLeave={hideTorch}
    >
      <div
        className="kb-backdrop"
        style={{
          backgroundImage: `url(${KHOC_BLOCK_PORTRAIT})`,
          "--kb-backdrop": cue.even && active ? 0.35 : 0.06,
        } as React.CSSProperties}
      />

      {/* Re-keyed on each hit so the shake replays */}
      <div key={`stage-${cue.lit}`} className={`kb-stage ${cue.lit > 0 ? "kb-shake" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KHOC_BLOCK_PORTRAIT} alt="Portrait in white face paint with flying platinum hair" className="kb-layer kb-base" />
        {KHOC_BLOCK_SPOTS.map((spot) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={spot.id}
            src={KHOC_BLOCK_PORTRAIT}
            alt=""
            aria-hidden
            className={`kb-layer kb-spot ${active && T.hits.slice(0, cue.lit).some((h) => h.spot === spot.id) ? "is-lit" : ""}`}
            style={{ "--x": `${spot.x * 100}%`, "--y": `${spot.y * 100}%`, "--r": `${spot.radius * 100}%` } as React.CSSProperties}
          />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={torchRef} src={KHOC_BLOCK_PORTRAIT} alt="" aria-hidden className="kb-layer kb-torch" />
        <div className="kb-vignette" />
      </div>

      {cue.lit > 0 && playing && <div key={`flash-${cue.lit}`} className="kb-flash z-[15]" />}

      {cue.titleHit >= 0 && playing && (
        <div className="pointer-events-none absolute inset-0 z-[16] flex items-center justify-center px-4">
          <h1 key={`title-${cue.titleHit}`} className="kb-title kb-chrome" data-text={T.hits[cue.titleHit]?.word}>
            {T.hits[cue.titleHit]?.word}
          </h1>
        </div>
      )}

      <div className="kb-scanlines" />
      <div className="kb-grain" />

      {/* Title, artist and the play/pause button stay up the whole time; they
          step back while a hit word is on screen */}
      <div
        className={`pointer-events-none absolute inset-0 z-[4] flex flex-col items-center justify-center gap-6 px-4 text-center transition-[background-color,opacity] duration-500 ${
          active ? "bg-transparent" : "bg-black/55"
        } ${cue.titleHit >= 0 && playing ? "opacity-15" : "opacity-100"}`}
      >
        <p className="kb-chrome font-[family-name:var(--font-kb-title)] text-6xl sm:text-8xl">Khóc Blóck</p>
        <p className="text-sm tracking-[0.35em] uppercase text-white/60">Phùng Khánh Linh</p>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            disabled={!canStart || status === "starting"}
            aria-pressed={playing}
            className="kb-button pointer-events-auto min-w-28 px-5 py-1.5 text-base text-white disabled:opacity-50"
          >
            {!canStart
              ? "Loading…"
              : status === "starting"
                ? "Starting…"
                : playing
                  ? "Pause"
                  : status === "paused"
                    ? "Resume"
                    : status === "ended"
                      ? "Replay"
                      : "Play"}
          </button>
          {/* Back to the top of the chorus, lights and all */}
          {active && (
            <button
              type="button"
              onClick={start}
              className="kb-button pointer-events-auto min-w-28 px-4 py-1 text-sm text-white"
            >
              Restart
            </button>
          )}
        </div>
        <p className="text-xs text-white/40">
          {needsTap ? "Tap play on the YouTube player below to start" : "Sound on — starts at the main chorus"}
        </p>
      </div>

      {/* The official audio, sunk to half opacity at the bottom center */}
      <div
        ref={playerHostRef}
        className="kb-player fixed z-[5] left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+1rem)]"
      />

      <div className="fixed z-20 left-4 top-4 flex gap-2 sm:left-8 sm:top-6">
        <Link href="/" className="kb-button px-4 py-1.5 text-sm text-white">
          Portfolio
        </Link>
        <ProjectsMenu className="kb-button px-4 py-1.5 text-sm text-white">Projects</ProjectsMenu>
      </div>

      {(silent || IS_DEV) && (
        <p className="fixed bottom-2 left-3 z-20 font-mono text-[11px] text-white/45">
          {silent && "player unavailable — silent run · "}
          {IS_DEV && (
            <>
              <span ref={clockRef}>0.00</span> · offset {offset.toFixed(2)}s · K on Khóc, [ ] nudge
            </>
          )}
        </p>
      )}
    </main>
  );
}
