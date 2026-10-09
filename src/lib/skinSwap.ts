import * as THREE from "three";

/**
 * Skin swapping for characters whose skins share one rig (same bones, same
 * clips). The first skin loaded is the rig: its skeleton and mixer drive every
 * skin, so swapping only replaces the visible meshes and the current animation
 * keeps playing.
 */

export const collectSkinnedMeshes = (root: THREE.Object3D) => {
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      meshes.push(child as THREE.SkinnedMesh);
    }
  });
  return meshes;
};

// Clone a skin's meshes onto the rig's bones
const bindSkinToRig = (rig: THREE.Object3D, skin: THREE.Object3D) => {
  const bones = new Map<string, THREE.Bone>();
  rig.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.set(child.name, child as THREE.Bone);
  });

  return collectSkinnedMeshes(skin).map((source) => {
    const mesh = new THREE.SkinnedMesh(source.geometry, source.material);
    mesh.name = source.name;
    mesh.position.copy(source.position);
    mesh.quaternion.copy(source.quaternion);
    mesh.scale.copy(source.scale);
    mesh.frustumCulled = source.frustumCulled;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const skeletonBones = source.skeleton.bones.map((bone) => {
      const rigBone = bones.get(bone.name);
      if (!rigBone) console.warn(`Skin bone '${bone.name}' missing from rig`);
      return rigBone ?? bone;
    });
    mesh.bind(
      new THREE.Skeleton(skeletonBones, source.skeleton.boneInverses),
      source.bindMatrix,
    );
    return mesh;
  });
};

interface SkinState {
  parent: THREE.Object3D;
  current: THREE.SkinnedMesh[];
  bySkin: Map<THREE.Object3D, THREE.SkinnedMesh[]>;
}
const skinStates = new WeakMap<THREE.Object3D, SkinState>();

/**
 * Show `skin`'s meshes on `rig`, leaving bones and the mixer untouched.
 * Returns the meshes now visible.
 */
export const applySkin = (rig: THREE.Object3D, skin: THREE.Object3D) => {
  let state = skinStates.get(rig);
  if (!state) {
    const originals = collectSkinnedMeshes(rig);
    state = {
      parent: originals[0]?.parent ?? rig,
      current: originals,
      bySkin: new Map([[rig, originals]]),
    };
    skinStates.set(rig, state);
  }

  let meshes = state.bySkin.get(skin);
  if (!meshes) {
    meshes = bindSkinToRig(rig, skin);
    state.bySkin.set(skin, meshes);
  }
  if (meshes === state.current) return meshes;

  state.current.forEach((mesh) => mesh.removeFromParent());
  const parent = state.parent;
  meshes.forEach((mesh) => parent.add(mesh));
  state.current = meshes;
  return meshes;
};
