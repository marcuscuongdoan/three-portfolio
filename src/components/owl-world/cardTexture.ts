import * as THREE from "three";
import type { ShowcaseApp } from "@/data/apps";

/**
 * Card faces are drawn on a 2D canvas and used as textures: crisp text with
 * the page's own font, no font files or SDF text to fetch. Each texture is
 * returned at once and redrawn when its image and the web font are ready.
 */

const images = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string) {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

const fontFamily = () =>
  typeof document === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily || "sans-serif";

const fontsReady = () =>
  typeof document !== "undefined" && document.fonts ? document.fonts.ready.then(() => undefined) : Promise.resolve();

function makeTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) => void, src: string | null) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  draw(ctx, null);
  Promise.all([src ? loadImage(src) : Promise.resolve(null), fontsReady()]).then(([img]) => {
    ctx.clearRect(0, 0, w, h);
    draw(ctx, img);
    tex.needsUpdate = true;
  });
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Image cropped to cover the box, or a generated cover when there's none */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, app: ShowcaseApp, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#1d1a24");
    g.addColorStop(1, app.accent);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // Blueprint grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    const step = w / 12;
    for (let gx = x; gx < x + w; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (let gy = y; gy < y + h; gy += step) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `700 ${Math.round(h * 0.16)}px ${fontFamily()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(app.name, x + w / 2, y + h * 0.46, w * 0.86);
    ctx.font = `500 ${Math.round(h * 0.07)}px ${fontFamily()}`;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("3D · Three.js · React", x + w / 2, y + h * 0.64, w * 0.86);
  }
  ctx.restore();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1]!;
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

/** The cards that line the flight corridor (4:3) */
export function makeFlightCard(app: ShowcaseApp) {
  const W = 1024;
  const H = 768;
  return makeTexture(
    W,
    H,
    (ctx, img) => {
      const f = fontFamily();
      roundRect(ctx, 0, 0, W, H, 40);
      ctx.fillStyle = "#f7f2ea";
      ctx.fill();
      ctx.save();
      roundRect(ctx, 28, 28, W - 56, 420, 26);
      ctx.clip();
      drawCover(ctx, img, app, 28, 28, W - 56, 420);
      ctx.restore();

      // Kind badge
      const badge = app.kind === "web" ? "WEB PRODUCT" : "3D LAB";
      ctx.font = `600 24px ${f}`;
      const bw = ctx.measureText(badge).width + 36;
      roundRect(ctx, 52, 52, bw, 46, 23);
      ctx.fillStyle = "rgba(20,16,14,0.72)";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(badge, 70, 76);

      ctx.fillStyle = app.accent;
      ctx.fillRect(52, 478, 64, 8);

      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#2c2420";
      ctx.font = `700 50px ${f}`;
      ctx.fillText(app.name, 52, 548, W - 104);
      ctx.fillStyle = "#625b54";
      ctx.font = `400 28px ${f}`;
      wrapLines(ctx, app.description, W - 104, 3).forEach((l, i) => ctx.fillText(l, 52, 600 + i * 40));
      ctx.fillStyle = "#2c2420";
      ctx.font = `600 26px ${f}`;
      ctx.textAlign = "right";
      ctx.fillText(app.external ? "Visit site ↗" : "Open experience →", W - 52, 548);
      ctx.textAlign = "left";
    },
    app.image,
  );
}

/** The square artworks on the museum walls */
export function makeFrameArt(app: ShowcaseApp) {
  const S = 768;
  return makeTexture(
    S,
    S,
    (ctx, img) => {
      const f = fontFamily();
      ctx.fillStyle = "#f3ede3";
      ctx.fillRect(0, 0, S, S);
      drawCover(ctx, img, app, 0, 0, S, S * 0.74);
      ctx.fillStyle = app.accent;
      ctx.fillRect(0, S * 0.74, S, 10);
      ctx.fillStyle = "#2c2420";
      ctx.font = `700 54px ${f}`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(app.name, 40, S * 0.74 + 86, S - 80);
      ctx.fillStyle = "#625b54";
      ctx.font = `500 34px ${f}`;
      ctx.fillText(app.tagline, 40, S * 0.74 + 140, S - 80);
    },
    app.image,
  );
}

/** A painted sign: big title over a small kicker */
export function makeSign(title: string, kicker: string, opts: { bg?: string; fg?: string; accent?: string } = {}) {
  const W = 1024;
  const H = 320;
  const { bg = "#2c2420", fg = "#f7f2ea", accent = "#e0b46c" } = opts;
  return makeTexture(
    W,
    H,
    (ctx) => {
      const f = fontFamily();
      roundRect(ctx, 0, 0, W, H, 36);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      roundRect(ctx, 18, 18, W - 36, H - 36, 24);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = accent;
      ctx.font = `600 38px ${f}`;
      ctx.fillText(kicker.toUpperCase().split("").join(" "), W / 2, 110);
      ctx.fillStyle = fg;
      ctx.font = `700 104px ${f}`;
      ctx.fillText(title, W / 2, 230, W - 120);
    },
    null,
  );
}
