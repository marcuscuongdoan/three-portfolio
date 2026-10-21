import type { Object3D } from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SHOWCASE_DIR, SHOWCASE_MODELS } from "@/config/showcase3d";

export type LoadStatus = "queued" | "downloading" | "parsing" | "ready" | "error";

export interface FileProgress {
  status: LoadStatus;
  loaded: number;
  total: number;
  triangles: number;
  meshes: number;
  // ms from the start of the batch
  startedAt: number;
  doneAt: number;
}

export type ModelLibrary = Record<string, GLTF>;

function countGeometry(root: Object3D) {
  let triangles = 0;
  let meshes = 0;
  root.traverse((o) => {
    const mesh = o as Object3D & { isMesh?: boolean; geometry?: { index: { count: number } | null; attributes: { position: { count: number } } } };
    if (!mesh.isMesh || !mesh.geometry) return;
    meshes++;
    const g = mesh.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { triangles, meshes };
}

// Streams each file with fetch so the page can show real per-file byte
// progress (a LoadingManager only reports whole files), then parses it.
export async function loadShowcaseModels(
  onProgress: (file: string, p: FileProgress) => void,
  signal: AbortSignal,
): Promise<ModelLibrary> {
  const loader = new GLTFLoader();
  const t0 = performance.now();
  const library: ModelLibrary = {};

  await Promise.all(
    SHOWCASE_MODELS.map(async (model) => {
      const p: FileProgress = {
        status: "downloading",
        loaded: 0,
        total: model.bytes,
        triangles: 0,
        meshes: 0,
        startedAt: performance.now() - t0,
        doneAt: 0,
      };
      const emit = () => onProgress(model.file, { ...p });
      emit();

      const res = await fetch(`${SHOWCASE_DIR}/${model.file}`, { signal });
      if (!res.ok || !res.body) {
        p.status = "error";
        emit();
        throw new Error(`${model.file}: HTTP ${res.status}`);
      }
      const header = Number(res.headers.get("content-length"));
      if (header > 0) p.total = header;

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        p.loaded += value.byteLength;
        emit();
      }
      const bytes = new Uint8Array(p.loaded);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.byteLength;
      }

      p.status = "parsing";
      p.total = p.loaded;
      emit();
      const gltf = await loader.parseAsync(bytes.buffer, `${SHOWCASE_DIR}/`);
      Object.assign(p, countGeometry(gltf.scene));
      p.status = "ready";
      p.doneAt = performance.now() - t0;
      emit();
      library[model.file] = gltf;
    }),
  );

  return library;
}
