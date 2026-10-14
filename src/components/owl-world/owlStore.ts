import { create } from "zustand";
import * as THREE from "three";
import type { ShowcaseApp } from "@/data/apps";

/**
 * Scroll progress lives outside React: the scene reads it every frame.
 * `target` follows the page scroll (in stops), `current` chases it smoothly
 * and is what the owl and camera actually show.
 */
export const flight = {
  target: 0,
  current: 0,
  // Stops per second, for flap intensity
  velocity: 0,
};

// Where the guide owl is this frame, for the companions flying with it
export const guide = {
  pos: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
};

interface OwlWorldState {
  // The stop the view is settled near (null while between stops)
  activeStop: number | null;
  // Nearest stop, for the nav highlight
  nearestStop: number;
  hoveredApp: string | null;
  // The museum frame the camera closes in on (phones, from the carousel)
  museumFocus: string | null;
  // The stop a nav click is flying to (until it gets there)
  navTarget: number | null;
  setNavTarget: (stop: number | null) => void;
  // The "download my CV?" dialog is open
  cvPrompt: boolean;
  setCvPrompt: (open: boolean) => void;
  setMuseumFocus: (id: string | null) => void;
  pendingApp: ShowcaseApp | null;
  loaded: boolean;
  // Bumped to make the owl do its wing-stretch emote
  cheer: number;
  // The high quality setting; null until the saved choice is read
  highQuality: boolean | null;
  setHighQuality: (high: boolean) => void;
  setStops: (active: number | null, nearest: number) => void;
  setHoveredApp: (id: string | null) => void;
  setPendingApp: (app: ShowcaseApp | null) => void;
  setLoaded: () => void;
  doCheer: () => void;
}

export const useOwlWorld = create<OwlWorldState>()((set) => ({
  activeStop: 0,
  nearestStop: 0,
  hoveredApp: null,
  museumFocus: null,
  navTarget: null,
  setNavTarget: (navTarget) => set({ navTarget }),
  cvPrompt: false,
  setCvPrompt: (cvPrompt) => set({ cvPrompt }),
  setMuseumFocus: (museumFocus) => set({ museumFocus }),
  pendingApp: null,
  loaded: false,
  cheer: 0,
  highQuality: null,
  setHighQuality: (highQuality) => set({ highQuality }),
  setStops: (activeStop, nearestStop) => set({ activeStop, nearestStop }),
  setHoveredApp: (hoveredApp) => set({ hoveredApp }),
  setPendingApp: (pendingApp) => set({ pendingApp }),
  setLoaded: () => set({ loaded: true }),
  doCheer: () => set((s) => ({ cheer: s.cheer + 1 })),
}));
