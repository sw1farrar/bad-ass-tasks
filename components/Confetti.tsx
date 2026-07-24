"use client";

import { useEffect, useRef } from "react";

interface ConfettiProps {
  trigger: number; // increment to fire
}

/**
 * Fires confetti when `trigger` increases after mount.
 * Ignores the initial value so login/rehydrate/remount never replays a stale counter.
 */
export function Confetti({ trigger }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baselineRef = useRef<number | null>(null);

  useEffect(() => {
    if (baselineRef.current === null) {
      baselineRef.current = trigger;
      return;
    }

    if (trigger <= baselineRef.current) {
      baselineRef.current = trigger;
      return;
    }
    baselineRef.current = trigger;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#c084fc", "#ff00aa", "#f4f4f5", "#a1a1aa"];
    const particles: Array<{
      x: number; y: number; vx: number; vy: number; radius: number; color: string; life: number;
    }> = [];

    const count = 160;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 180,
        y: canvas.height / 2 - 80 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * -6 - 3,
        radius: Math.random() * 3.5 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 90 + Math.random() * 40,
      });
    }

    let frame = 0;
    let raf = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let stillAlive = false;

      for (const p of particles) {
        if (p.life <= 0) continue;
        stillAlive = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity
        p.vx *= 0.995;
        p.life--;

        const alpha = Math.max(p.life / 110, 0);

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // occasional sparkle
        if (Math.random() > 0.92) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        }
        ctx.restore();
      }

      frame++;
      if (stillAlive && frame < 140) {
        raf = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    raf = requestAnimationFrame(animate);

    const timeout = setTimeout(() => {
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 4200);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      id="confetti-canvas"
      className="pointer-events-none fixed inset-0 z-[9999]"
    />
  );
}
