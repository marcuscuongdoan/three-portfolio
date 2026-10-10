"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF";
const COLUMN_WIDTH = 16;
const TRAIL = 14;

/**
 * Digital rain over the hologram intro: falling columns of glyphs with fading
 * trails, drawn on a transparent canvas blended over the scene. Fades out when
 * `active` turns false and stops drawing once invisible.
 */
export default function MatrixRain({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let columns: { y: number; speed: number; glyphs: string[] }[] = [];
    const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Array.from({ length: Math.ceil(width / COLUMN_WIDTH) }, () => ({
        y: -Math.random() * height,
        speed: 140 + Math.random() * 260,
        glyphs: Array.from({ length: TRAIL }, glyph),
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    let frame = 0;
    let last = performance.now();
    let level = 0;
    const draw = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      level += ((activeRef.current ? 1 : 0) - level) * Math.min(delta * 3, 1);

      ctx.clearRect(0, 0, width, height);
      if (level > 0.01) {
        ctx.font = `${COLUMN_WIDTH - 2}px monospace`;
        columns.forEach((col, i) => {
          col.y += col.speed * delta;
          if (col.y - TRAIL * COLUMN_WIDTH > height) {
            col.y = -Math.random() * height * 0.5;
            col.speed = 140 + Math.random() * 260;
          }
          if (Math.random() < 0.08) col.glyphs[Math.floor(Math.random() * TRAIL)] = glyph();
          col.glyphs.forEach((g, j) => {
            const y = col.y - j * COLUMN_WIDTH;
            if (y < -COLUMN_WIDTH || y > height + COLUMN_WIDTH) return;
            const fade = 1 - j / TRAIL;
            ctx.fillStyle =
              j === 0
                ? `rgba(230, 255, 248, ${level})`
                : `rgba(110, 255, 210, ${0.8 * fade * level})`;
            ctx.fillText(g, i * COLUMN_WIDTH, y);
          });
        });
      }
      if (activeRef.current || level > 0.01) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-10 h-full w-full opacity-80 mix-blend-screen"
    />
  );
}
