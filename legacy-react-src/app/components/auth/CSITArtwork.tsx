import { useEffect, useRef } from "react";

const ORANGE = "#FF8A00";
const PURPLE = "#8B5CF6";

// Pixel maps for each letter — 5 rows × 4 cols (1 = cube, 0 = empty)
const LETTER_MAPS: Record<string, number[][]> = {
  C: [
    [0, 1, 1, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 1, 1, 0],
  ],
  S: [
    [1, 1, 1, 0],
    [1, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 1],
    [0, 1, 1, 1],
  ],
  I: [
    [1, 1, 1, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
    [1, 1, 1, 0],
  ],
  T: [
    [1, 1, 1, 1],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
  ],
};

interface Cube { gx: number; gy: number; color: string; }
interface EdgeSeg { ax: number; ay: number; bx: number; by: number; color: string; }
interface Particle { segIdx: number; t: number; speed: number; size: number; }
interface Dot { x: number; y: number; vx: number; vy: number; r: number; a: number; }

function hexAlpha(hex: string, a: number) {
  return hex + Math.round(a * 255).toString(16).padStart(2, "0");
}

export function CSITArtwork() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0;
    let segs: EdgeSeg[] = [];
    let particles: Particle[] = [];
    let dots: Dot[] = [];
    let animId = 0;
    let startTs = 0;

    function resize() {
      W = container.clientWidth;
      H = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      // Cell size: fit all letters into the canvas with margin
      const S = Math.min(W / 24, H / 14);

      function iso(x: number, y: number, z: number) {
        // isometric projection
        return {
          sx: W / 2 + (x - y) * S,
          sy: H / 2 + (x + y) * S * 0.5 - z * S * 1.15,
        };
      }

      // Letter placements (gxOff in grid units, spaced by 5)
      const defs = [
        { key: "C", gxOff: 0,  color: ORANGE },
        { key: "S", gxOff: 5,  color: ORANGE },
        { key: "I", gxOff: 10, color: PURPLE },
        { key: "T", gxOff: 14, color: PURPLE },
      ];

      // Overall grid center: gx ∈ [0,17] → center 8.5; gy ∈ [0,4] → center 2
      const GX_C = 8.5;
      const GY_C = 2.0;

      const cubes: Cube[] = [];
      defs.forEach(def => {
        LETTER_MAPS[def.key].forEach((row, gy) => {
          row.forEach((cell, gx) => {
            if (cell) {
              cubes.push({
                gx: gx + def.gxOff - GX_C,
                gy: gy - GY_C,
                color: def.color,
              });
            }
          });
        });
      });

      // Collect all 12 edges per cube into segments array
      const newSegs: EdgeSeg[] = [];
      cubes.forEach(({ gx, gy, color }) => {
        const v = [
          iso(gx,   gy,   1),
          iso(gx+1, gy,   1),
          iso(gx+1, gy+1, 1),
          iso(gx,   gy+1, 1),
          iso(gx,   gy,   0),
          iso(gx+1, gy,   0),
          iso(gx+1, gy+1, 0),
          iso(gx,   gy+1, 0),
        ];
        const pairs = [
          [0,1],[1,2],[2,3],[3,0],
          [4,5],[5,6],[6,7],[7,4],
          [0,4],[1,5],[2,6],[3,7],
        ];
        pairs.forEach(([a, b]) => {
          const dx = v[b].sx - v[a].sx;
          const dy = v[b].sy - v[a].sy;
          if (Math.sqrt(dx*dx + dy*dy) > 1) {
            newSegs.push({ ax: v[a].sx, ay: v[a].sy, bx: v[b].sx, by: v[b].sy, color });
          }
        });
      });
      segs = newSegs;

      particles = Array.from({ length: 90 }, () => ({
        segIdx: Math.floor(Math.random() * segs.length),
        t: Math.random(),
        speed: 0.004 + Math.random() * 0.008,
        size: 1.5 + Math.random() * 2.5,
      }));

      dots = Array.from({ length: 70 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 0.5 + Math.random() * 1.5,
        a: 0.02 + Math.random() * 0.09,
      }));
    }

    function frame(ts: number) {
      if (!startTs) startTs = ts;
      const elapsed = ts - startTs;

      // Background
      ctx.fillStyle = "#0B0B0B";
      ctx.fillRect(0, 0, W, H);

      // Radial fog
      const fog = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, W * 0.7);
      fog.addColorStop(0, "rgba(70,10,120,0.07)");
      fog.addColorStop(0.5, "rgba(30,0,60,0.04)");
      fog.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, W, H);

      // Floating background dots
      dots.forEach(d => {
        d.x = (d.x + d.vx + W) % W;
        d.y = (d.y + d.vy + H) % H;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150,130,255,${d.a})`;
        ctx.fill();
      });

      if (segs.length === 0) {
        animId = requestAnimationFrame(frame);
        return;
      }

      // Base wireframe edges (very dim)
      ctx.lineWidth = 0.75;
      segs.forEach(s => {
        ctx.beginPath();
        ctx.moveTo(s.ax, s.ay);
        ctx.lineTo(s.bx, s.by);
        ctx.strokeStyle = hexAlpha(s.color, 0.12);
        ctx.stroke();
      });

      // Traveling glow pulse per segment (phase-offset by segment index)
      segs.forEach((s, i) => {
        const phase = ((elapsed * 0.00032 + i * 0.09) % 1 + 1) % 1;
        const half = 0.22;
        const lo = Math.max(0, phase - half);
        const hi = Math.min(1, phase + half);
        if (hi <= lo) return;

        const x0 = s.ax + (s.bx - s.ax) * lo;
        const y0 = s.ay + (s.by - s.ay) * lo;
        const x1 = s.ax + (s.bx - s.ax) * hi;
        const y1 = s.ay + (s.by - s.ay) * hi;

        if (Math.abs(x1 - x0) < 0.5 && Math.abs(y1 - y0) < 0.5) return;

        const gr = ctx.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, s.color + "00");
        gr.addColorStop(0.5, hexAlpha(s.color, 0.65));
        gr.addColorStop(1, s.color + "00");

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = gr;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });

      // Animated particles
      particles.forEach(p => {
        p.t += p.speed;
        if (p.t > 1) {
          p.t = 0;
          p.segIdx = Math.floor(Math.random() * segs.length);
        }
        const s = segs[p.segIdx];
        const x = s.ax + (s.bx - s.ax) * p.t;
        const y = s.ay + (s.by - s.ay) * p.t;

        // Outer glow ring
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(s.color, 0.75);
        ctx.fill();
        ctx.shadowBlur = 0;

        // White hot core
        ctx.beginPath();
        ctx.arc(x, y, p.size * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      });

      animId = requestAnimationFrame(frame);
    }

    resize();
    animId = requestAnimationFrame(frame);

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
