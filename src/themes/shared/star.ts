import * as THREE from "three";

/** A flat five-pointed star, about 0.24 m across, facing +Z */
export function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.05 : 0.12;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }).translate(0, 0, -0.015);
}
