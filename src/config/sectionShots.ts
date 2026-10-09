// Character animation + camera shot per page section, shared by every page
// that renders the Home / Projects / Contact sections (whatever the theme)
export const SECTION_SHOTS = {
  home: {
    animation: { name: "idle", loop: true, fadeTime: 0.5, lookAtCamera: true },
    camera: {
      position: { x: 0, y: 1.7, z: 1 },
      lookAt: { x: 0.5, y: 1.5, z: 0 },
      duration: 1500,
    },
  },
  projects: {
    animation: { name: "walk", loop: true, fadeTime: 0.5, lookAtCamera: true },
    camera: {
      position: { x: 0, y: 1.25, z: 1 },
      lookAt: { x: 0.5, y: 1.5, z: 0 },
      duration: 1500,
    },
  },
  contact: {
    animation: { name: "typing", loop: true, fadeTime: 0.5, lookAtCamera: true },
    camera: {
      position: { x: 0.5, y: 1, z: 0.75 },
      lookAt: { x: -1.5, y: 2, z: 0 },
      duration: 1500,
    },
  },
} as const;
