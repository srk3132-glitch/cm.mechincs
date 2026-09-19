import type { Simulation } from "../../lib/physics";
import { fmt } from "../../lib/format";
import { useChartTheme } from "../charts/common";

export const LAB_COLORS = {
  a: "#337dff",
  b: "#f59e0b",
  total: "#8b5cf6",
  lost: "#f43f5e",
  com: "#64748b",
  ke: "#10b981",
};

function DroneGlyph({ cx, cy, r, color, label, flip }: { cx: number; cy: number; r: number; color: string; label: string; flip?: boolean }) {
  const armY = cy - r * 0.55;
  return (
    <g transform={`translate(${cx} ${cy})${flip ? " scale(-1 1)" : ""}`} style={{ transition: "none" }}>
      {/* shadow */}
      <ellipse cx={0} cy={r * 1.05} rx={r * 0.9} ry={r * 0.16} fill="currentColor" opacity={0.12} />
      {/* arms */}
      <line x1={-r * 0.85} y1={armY - cy} x2={r * 0.85} y2={armY - cy} stroke={color} strokeWidth={Math.max(2, r * 0.12)} strokeLinecap="round" />
      {/* rotors */}
      <ellipse cx={-r * 0.8} cy={armY - cy - r * 0.18} rx={r * 0.42} ry={r * 0.09} fill={color} opacity={0.55} />
      <ellipse cx={r * 0.8} cy={armY - cy - r * 0.18} rx={r * 0.42} ry={r * 0.09} fill={color} opacity={0.55} />
      <line x1={-r * 0.8} y1={armY - cy} x2={-r * 0.8} y2={armY - cy - r * 0.18} stroke={color} strokeWidth={2} />
      <line x1={r * 0.8} y1={armY - cy} x2={r * 0.8} y2={armY - cy - r * 0.18} stroke={color} strokeWidth={2} />
      {/* body */}
      <rect x={-r} y={-r * 0.45} width={r * 2} height={r * 0.95} rx={r * 0.35} fill={color} />
      <rect x={-r * 0.55} y={-r * 0.62} width={r * 1.1} height={r * 0.4} rx={r * 0.2} fill={color} opacity={0.85} />
      {/* bumper */}
      <rect x={-r} y={-r * 0.45} width={r * 2} height={r * 0.95} rx={r * 0.35} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.5} />
      <text x={0} y={r * 0.2} textAnchor="middle" fontSize={Math.max(10, r * 0.55)} fontWeight={700} fill="#fff" transform={flip ? "scale(-1 1)" : undefined}>
        {label}
      </text>
    </g>
  );
}

export function Track({ sim, t }: { sim: Simulation; t: number }) {
  const th = useChartTheme();
  const p = sim.sample(t);
  const W = 800;
  const H = 190;
  const pad = 48;
  const span = Math.max(sim.xMax - sim.xMin, 0.5);
  const scale = (W - 2 * pad) / span;
  const sx = (x: number) => pad + (x - sim.xMin) * scale;
  const groundY = 132;
  const rA = Math.max(16, Math.min(40, sim.r1 * scale));
  const rB = Math.max(16, Math.min(40, sim.r2 * scale));
  const bodyY = groundY - Math.max(rA, rB) * 0.7;
  const vScale = 70 / Math.max(sim.vMax, 0.1);
  const contactX = sx(0);
  const fRatio = sim.result.peakForce > 0 ? p.f / sim.result.peakForce : 0;
  // anchor each glyph to its true contact surface so they touch exactly at impact
  const cxA = sx(p.x1 + sim.r1) - rA;
  const cxB = sx(p.x2 - sim.r2) + rB;

  // ground ticks
  const tickStep = span > 60 ? 10 : span > 30 ? 5 : span > 12 ? 2 : span > 6 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let x = Math.ceil(sim.xMin / tickStep) * tickStep; x <= sim.xMax; x += tickStep) ticks.push(Number(x.toFixed(3)));

  const Arrow = ({ x, v, color, y }: { x: number; v: number; color: string; y: number }) => {
    if (Math.abs(v) < 0.05) return null;
    const len = v * vScale;
    const x2 = x + len;
    const dir = Math.sign(len);
    return (
      <g>
        <line x1={x} y1={y} x2={x2 - dir * 6} y2={y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <polygon points={`${x2},${y} ${x2 - dir * 8},${y - 4.5} ${x2 - dir * 8},${y + 4.5}`} fill={color} />
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none text-slate-900 dark:text-slate-100" role="img" aria-label="Drone collision track">
      <defs>
        <radialGradient id="flash" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="35%" stopColor={LAB_COLORS.lost} stopOpacity={0.7} />
          <stop offset="100%" stopColor={LAB_COLORS.lost} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* ground */}
      <line x1={pad - 20} y1={groundY} x2={W - pad + 20} y2={groundY} stroke={th.axisLine} strokeWidth={1.5} />
      {ticks.map((x) => (
        <g key={x}>
          <line x1={sx(x)} y1={groundY} x2={sx(x)} y2={groundY + 6} stroke={th.axisLine} />
          <text x={sx(x)} y={groundY + 18} textAnchor="middle" fontSize={10} fill={th.muted} fontFamily="ui-monospace, monospace">
            {x} m
          </text>
        </g>
      ))}

      {/* contact plane */}
      <line x1={contactX} y1={26} x2={contactX} y2={groundY} stroke={LAB_COLORS.lost} strokeDasharray="3 4" strokeOpacity={0.5} />
      <text x={contactX} y={18} textAnchor="middle" fontSize={10} fill={LAB_COLORS.lost} opacity={0.8}>
        impact plane
      </text>

      {/* impact flash */}
      {p.phase === "contact" && fRatio > 0.02 && (
        <circle cx={contactX} cy={bodyY} r={14 + 46 * fRatio} fill="url(#flash)" opacity={0.5 + 0.5 * fRatio} />
      )}

      {/* velocity arrows */}
      <Arrow x={cxA} v={p.v1} color={LAB_COLORS.a} y={bodyY - rA * 1.05 - 10} />
      <Arrow x={cxB} v={p.v2} color={LAB_COLORS.b} y={bodyY - rB * 1.05 - 10} />

      {/* drones */}
      <DroneGlyph cx={cxA} cy={bodyY} r={rA} color={LAB_COLORS.a} label="A" />
      <DroneGlyph cx={cxB} cy={bodyY} r={rB} color={LAB_COLORS.b} label="B" flip />

      {/* readouts */}
      <g fontFamily="ui-monospace, monospace" fontSize={11}>
        <text x={pad - 20} y={H - 12} fill={LAB_COLORS.a} fontWeight={600}>
          A · v {fmt(p.v1, 2)} m/s · p {fmt(p.p1, 2)} kg·m/s
        </text>
        <text x={W - pad + 20} y={H - 12} textAnchor="end" fill={LAB_COLORS.b} fontWeight={600}>
          B · v {fmt(p.v2, 2)} m/s · p {fmt(p.p2, 2)} kg·m/s
        </text>
      </g>
      {p.phase === "contact" && (
        <text x={contactX} y={bodyY - Math.max(rA, rB) * 1.05 - 34} textAnchor="middle" fontSize={11} fontWeight={700} fill={LAB_COLORS.lost} fontFamily="ui-monospace, monospace">
          F = {fmt(p.f, 0)} N
        </text>
      )}
    </svg>
  );
}
