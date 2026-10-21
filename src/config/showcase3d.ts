// Layout for /3d-showcase. Every coordinate is in gas_station.glb world space
// (metres, Y up) — the other GLBs in public/3d-showcase were authored to sit
// in the same frame, so the environment pieces load at the origin untouched.

export const SHOWCASE_DIR = "/3d-showcase";

// The "About this scene" card, the page description and the structured data
export const SHOWCASE_INFO = {
  tagline: "I made this myself just for fun.",
  scene: [
    "A roadside gas station with neon, a parking lot and an underground mall beneath it.",
    "Two fuel lanes take turns: a car pulls in, fills up, backs out and drives off — then the next model rolls in.",
    "Cars and motorbikes loop the main road both ways, keeping their distance and braking for each other.",
    "A steam train runs the tunnel, stops at the platform under the glass roof, and comes back the other way.",
    "A two-minute day: the sun crosses the sky, dusk turns orange, and the neon and street lamps take over at night.",
  ],
  tips: [
    "Leave the camera alone for a few seconds and it starts orbiting by itself.",
    "Underground x-ray slices off everything above ground.",
    "Pick any model in the list to fly to it or ride along.",
  ],
};

export type ModelRole = "environment" | "parked" | "traffic" | "refuel" | "rider" | "train";

export interface ShowcaseModel {
  file: string;
  label: string;
  role: ModelRole;
  // Fallback for the progress bar when the response has no Content-Length
  bytes: number;
}

export const SHOWCASE_MODELS: ShowcaseModel[] = [
  { file: "gas_station.glb", label: "Gas station", role: "environment", bytes: 5168148 },
  { file: "underground_mall.glb", label: "Underground mall", role: "environment", bytes: 946732 },
  { file: "parked_cars.glb", label: "Parking lot", role: "parked", bytes: 1270584 },
  { file: "motorbikes_scene.glb", label: "Motorbike bay", role: "parked", bytes: 587260 },
  { file: "train.glb", label: "Steam train", role: "train", bytes: 636424 },
  { file: "sedan80.glb", label: "Sedan '80", role: "refuel", bytes: 119500 },
  { file: "wagon80.glb", label: "Wagon '80", role: "refuel", bytes: 128228 },
  { file: "pickup80.glb", label: "Pickup '80", role: "refuel", bytes: 142188 },
  { file: "van80.glb", label: "Van '80", role: "refuel", bytes: 128112 },
  { file: "hatch80.glb", label: "Hatch '80", role: "refuel", bytes: 134080 },
  { file: "car.glb", label: "Compact", role: "traffic", bytes: 262720 },
  { file: "convertible.glb", label: "Convertible", role: "traffic", bytes: 235180 },
  { file: "mini_ev.glb", label: "Mini EV", role: "traffic", bytes: 203840 },
  { file: "motorbike_cub_red.glb", label: "Cub · red", role: "traffic", bytes: 103916 },
  { file: "motorbike_cub_blue.glb", label: "Cub · blue", role: "traffic", bytes: 103168 },
  { file: "motorbike_cub_teal.glb", label: "Cub · teal", role: "traffic", bytes: 103960 },
  { file: "motorbike_cruiser_black.glb", label: "Cruiser · black", role: "traffic", bytes: 143452 },
  { file: "motorbike_cruiser_red.glb", label: "Cruiser · red", role: "traffic", bytes: 144264 },
  { file: "rider_cub.glb", label: "Rider · cub", role: "rider", bytes: 33804 },
  { file: "rider_cruiser.glb", label: "Rider · cruiser", role: "rider", bytes: 33796 },
];

export const ROLE_LABEL: Record<ModelRole, string> = {
  environment: "Environment",
  parked: "Parked",
  traffic: "Road traffic",
  refuel: "Fuel stop",
  rider: "Rider",
  train: "Subway",
};

// Top of the asphalt slab everything parks and drives on
export const GROUND_Y = 0.2;

export const ROAD = {
  // Painted asphalt in the GLB; beyond it the page extends the road into the fog
  minX: -40,
  maxX: 44,
  zNorth: 17,
  zSouth: 24,
  // Lanes as the bundled motorbike scene uses them: drive on the right
  eastboundZ: 22.3,
  westboundZ: 18.7,
  // Traffic wraps around this span, far enough out that the fog hides the jump
  spanMinX: -150,
  spanMaxX: 150,
};

export const STATION = {
  // Two fuel lanes, either side of the right-hand pump island
  laneX: [5.0, 8.2] as const,
  pumpZ: 1.6,
  // The entrance gate's posts stand at x 1.3–1.9 and 8.1–8.7, z ≈ 11
  gateZ: 11,
  refuelSeconds: 5,
};

export const TRAIN = {
  trackX: 12.25,
  railY: -3.22,
  // Far enough into the hill (north) and under the field (south) to be hidden
  northEndZ: -46,
  southEndZ: 40,
  // Platform runs z −15…10; the train is 18.25 m long
  platformCenterZ: -2.5,
  cruise: 13,
  decel: 1.5,
  accel: 1.1,
  dwell: 6,
  layover: 5,
};

export interface CameraShot {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export const CAMERA_SHOTS: CameraShot[] = [
  { id: "overview", label: "Overview", position: [-34, 30, 50], target: [0, 0, 4] },
  { id: "station", label: "Fuel pumps", position: [-2.5, 8.5, 10], target: [6.5, 0.8, 2.5] },
  { id: "road", label: "Main road", position: [-16, 5, 30], target: [4, 0.6, 20] },
  { id: "parking", label: "Parking", position: [6, 12, -2], target: [-9, 0, -11] },
  { id: "subway", label: "Subway platform", position: [14.9, -1.6, 9], target: [12.2, -2.4, -8] },
];

// Reached from the model list rather than the shot buttons
export const EXTRA_SHOTS: CameraShot[] = [
  { id: "motobay", label: "Motorbike bay", position: [-7, 4.5, 4], target: [-1.5, 0.6, 9.8] },
];

// The static pieces focus a shot; every vehicle file is followed instead
export const MODEL_SHOTS: Record<string, string> = {
  "gas_station.glb": "overview",
  "underground_mall.glb": "subway",
  "parked_cars.glb": "parking",
  "motorbikes_scene.glb": "motobay",
};

export const INTRO_CAMERA: CameraShot = {
  id: "intro",
  label: "Intro",
  position: [-70, 70, 95],
  target: [0, 0, 4],
};
