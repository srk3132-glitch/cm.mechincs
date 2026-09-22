import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
} from "recharts";
import {
  Activity,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  DEFAULT_SIM_CONFIG,
  runTwoDroneSimulation,
  SIM_PRESETS,
  type SimConfig,
  type SimStep,
} from "../../lib/collisionPhysicsSim";
import { fmt } from "../../lib/format";
import { Badge, Button, Card, CardHeader, SectionHeading, StatTile } from "../ui";
import { ANIM, ChartLegend, ChartTooltip, useChartTheme } from "../charts/common";

const COLORS = {
  drone1: "#4d8dfc",
  drone2: "#ff9d5c",
  total: "#f8fafc",
  totalDark: "#0f172a",
  impact: "#ff6b5c",
  trail: "#57d4ff",
};

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function TrajectoryCanvas({
  sim,
  currentStep,
  currentIdx,
  crashTime,
  impactActive,
  config,
}: {
  sim: ReturnType<typeof runTwoDroneSimulation>;
  currentStep: SimStep;
  currentIdx: number;
  crashTime: number | null;
  impactActive: number | null;
  config: SimConfig;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(720, rect.width || 820);
    const height = 320;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = { x: 32, y: 24 };
    const plotWidth = width - pad.x * 2;
    const plotHeight = height - pad.y * 2;
    const allX = sim.steps.flatMap((s) => [s.x1, s.x2]);
    const allY = sim.steps.flatMap((s) => [s.y1, s.y2]);
    const minX = Math.min(...allX, -4.5);
    const maxX = Math.max(...allX, 4.5);
    const minY = Math.min(...allY, -2.5);
    const maxY = Math.max(...allY, 2.5);
    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);
    const toX = (x: number) => pad.x + ((x - minX) / spanX) * plotWidth;
    const toY = (y: number) => height - pad.y - ((y - minY) / spanY) * plotHeight;

    const bg = ctx.createRadialGradient(width * 0.54, height * 0.28, 20, width * 0.54, height * 0.28, width * 0.7);
    bg.addColorStop(0, "rgba(77, 141, 252, 0.12)");
    bg.addColorStop(0.5, "rgba(59, 130, 246, 0.05)");
    bg.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= 12; x += 1) {
      const px = (x / 12) * plotWidth + pad.x;
      ctx.beginPath();
      ctx.moveTo(px, pad.y);
      ctx.lineTo(px, height - pad.y);
      ctx.stroke();
    }
    for (let y = 0; y <= 8; y += 1) {
      const py = (y / 8) * plotHeight + pad.y;
      ctx.beginPath();
      ctx.moveTo(pad.x, py);
      ctx.lineTo(width - pad.x, py);
      ctx.stroke();
    }

    const referenceX = toX(0);
    const referenceY = toY(0);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(referenceX, pad.y);
    ctx.lineTo(referenceX, height - pad.y);
    ctx.moveTo(pad.x, referenceY);
    ctx.lineTo(width - pad.x, referenceY);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawPath = (coords: Array<{ x: number; y: number }>, color: string, lineAlpha: number) => {
      if (coords.length < 2) return;
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = hexToRgba(color, lineAlpha);
      ctx.shadowBlur = 16;
      ctx.shadowColor = color;
      ctx.moveTo(toX(coords[0].x), toY(coords[0].y));
      for (let i = 1; i < coords.length; i += 1) {
        const p = coords[i];
        ctx.lineTo(toX(p.x), toY(p.y));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const fullPath1 = sim.steps.map((s) => ({ x: s.x1, y: s.y1 }));
    const fullPath2 = sim.steps.map((s) => ({ x: s.x2, y: s.y2 }));
    drawPath(fullPath1, COLORS.drone1, 0.18);
    drawPath(fullPath2, COLORS.drone2, 0.16);

    const trailWin = 85;
    const trailStart = Math.max(0, currentIdx - trailWin);
    const visibleSteps = sim.steps.slice(trailStart, currentIdx + 1);
    const drawTrail = (points: Array<{ x: number; y: number }>, color: string) => {
      if (points.length < 2) return;
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, hexToRgba(color, 0));
      grad.addColorStop(0.2, hexToRgba(color, 0.15));
      grad.addColorStop(0.7, hexToRgba(color, 0.8));
      grad.addColorStop(1, hexToRgba(color, 1));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 22;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(toX(points[0].x), toY(points[0].y));
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(toX(points[i].x), toY(points[i].y));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    drawTrail(
      visibleSteps.map((s) => ({ x: s.x1, y: s.y1 })),
      COLORS.drone1,
    );
    drawTrail(
      visibleSteps.map((s) => ({ x: s.x2, y: s.y2 })),
      COLORS.drone2,
    );

    const markers = [
      { x: currentStep.x1, y: currentStep.y1, color: COLORS.drone1, label: "1", radius: 10 },
      { x: currentStep.x2, y: currentStep.y2, color: COLORS.drone2, label: "2", radius: 9 },
    ];

    markers.forEach((marker) => {
      const cx = toX(marker.x);
      const cy = toY(marker.y);
      const glow = impactActive ? 36 : 18;
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(marker.color, 0.14);
      ctx.shadowBlur = glow;
      ctx.shadowColor = marker.color;
      ctx.arc(cx, cy, marker.radius + 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = marker.color;
      ctx.shadowBlur = 26;
      ctx.shadowColor = marker.color;
      ctx.arc(cx, cy, marker.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.6;
      ctx.arc(cx, cy, marker.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "700 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(marker.label, cx, cy + 1);
    });

    if (impactActive !== null) {
      const elapsed = (performance.now() - impactActive) / 700;
      const t = clamp(elapsed, 0, 1);
      const impactX = toX(sim.crashX ?? 0);
      const impactY = toY(sim.crashY ?? 0);
      const ringRadius = 18 + t * 116;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 107, 92, ${1 - t})`;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 28;
      ctx.shadowColor = COLORS.impact;
      ctx.arc(impactX, impactY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (t < 1) {
        const flash = ctx.createRadialGradient(impactX, impactY, 8, impactX, impactY, 100);
        flash.addColorStop(0, `rgba(255, 255, 255, ${0.4 - t * 0.22})`);
        flash.addColorStop(0.2, `rgba(255, 107, 92, ${0.28 - t * 0.14})`);
        flash.addColorStop(1, "rgba(255, 107, 92, 0)");
        ctx.fillStyle = flash;
        ctx.fillRect(impactX - 120, impactY - 120, 240, 240);
      }
    }

    if (crashTime !== null && currentStep.t >= crashTime && sim.crashX !== null && sim.crashY !== null) {
      const impactX = toX(sim.crashX);
      const impactY = toY(sim.crashY);
      const pulse = 8 + ((currentStep.t - crashTime) / 0.5) * 24;
      ctx.beginPath();
      ctx.fillStyle = "rgba(255, 107, 92, 0.18)";
      ctx.arc(impactX, impactY, pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    if (config.p1x !== undefined && config.p2x !== undefined) {
      const start1X = toX(config.p1x);
      const start1Y = toY(config.p1y);
      const start2X = toX(config.p2x);
      const start2Y = toY(config.p2y);
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(COLORS.drone1, 0.9);
      ctx.arc(start1X, start1Y, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(COLORS.drone2, 0.9);
      ctx.arc(start2X, start2Y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [config, crashTime, currentIdx, currentStep, impactActive, sim]);

  return <canvas ref={canvasRef} className="h-[320px] w-full rounded-2xl" aria-label="Broadcast trajectory simulation" />;
}

export function CollisionPhysicsModule() {
  const th = useChartTheme();
  const [config, setConfig] = useState<SimConfig>(DEFAULT_SIM_CONFIG);
  const [activePreset, setActivePreset] = useState("Standard Oblique Collision");

  // Run the physics simulation client-side
  const sim = useMemo(() => runTwoDroneSimulation(config), [config]);

  // Replay playback state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [impactFlashAt, setImpactFlashAt] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Reset playback when sim changes
  useEffect(() => {
    setCurrentIdx(0);
    setPlaying(true);
    if (sim.crashTime !== null) {
      setImpactFlashAt(performance.now());
    }
  }, [sim]);

  useEffect(() => {
    if (impactFlashAt === null) return;
    const timeout = window.setTimeout(() => setImpactFlashAt(null), 700);
    return () => window.clearTimeout(timeout);
  }, [impactFlashAt]);

  // Playback animation loop
  useEffect(() => {
    if (!playing) {
      lastTimeRef.current = null;
      return;
    }

    const totalSteps = sim.steps.length - 1;
    const loop = (now: number) => {
      if (lastTimeRef.current !== null) {
        const deltaMs = now - lastTimeRef.current;
        // dt = 0.01s = 10ms per step. Steps to advance:
        const stepsToAdvance = (deltaMs / (config.dt * 1000)) * speed;
        if (stepsToAdvance >= 1) {
          setCurrentIdx((prev) => {
            const next = prev + Math.floor(stepsToAdvance);
            if (next >= totalSteps) {
              return 0; // loop replay
            }
            return next;
          });
          lastTimeRef.current = now;
        }
      } else {
        lastTimeRef.current = now;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [playing, speed, sim.steps.length, config.dt]);

  const currentStep: SimStep = sim.steps[currentIdx] || sim.steps[0];
  const crashTime = sim.crashTime;

  // Trajectory points up to current replay step with fading trail
  const trajectoryData = useMemo(() => {
    const maxTrail = 80;
    const startIdx = Math.max(0, currentIdx - maxTrail);
    const visibleSteps = sim.steps.slice(startIdx, currentIdx + 1);

    return visibleSteps.map((s, idx) => {
      const opacity = Math.max(0.15, (idx + 1) / visibleSteps.length);
      return {
        x1: s.x1,
        y1: s.y1,
        x2: s.x2,
        y2: s.y2,
        t: s.t,
        opacity,
      };
    });
  }, [sim.steps, currentIdx]);

  // Full trajectory paths for background line render
  const fullPathDrone1 = useMemo(() => sim.steps.map((s) => ({ x: s.x1, y: s.y1 })), [sim.steps]);
  const fullPathDrone2 = useMemo(() => sim.steps.map((s) => ({ x: s.x2, y: s.y2 })), [sim.steps]);

  // Sampled time series data for 60fps performance (every 2nd step = 500 points)
  const chartPoints = useMemo(() => {
    return sim.steps.filter((_, i) => i % 2 === 0);
  }, [sim.steps]);

  const updateConfig = (patch: Partial<SimConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setActivePreset("Custom");
  };

  const applyPreset = (presetName: string) => {
    const p = SIM_PRESETS.find((x) => x.name === presetName);
    if (p) {
      setConfig({ ...DEFAULT_SIM_CONFIG, ...p.config });
      setActivePreset(p.name);
    }
  };

  const scrub = (stepIdx: number) => {
    setCurrentIdx(Math.min(sim.steps.length - 1, Math.max(0, stepIdx)));
    setPlaying(false);
  };

  return (
    <div className="space-y-6 pt-6">
      <SectionHeading
        eyebrow="2D Collision Physics"
        title="Two-Drone Collision Model & Telemetry Grid"
        description="Client-side physics simulation executing normal and tangential impulse dynamics (e = 0.7, μ = 0.3), spin generation from surface friction, and post-crash exponential braking."
        action={
          <div className="flex items-center gap-2">
            <Badge tone={sim.crashTime !== null ? "rose" : "emerald"} className="font-mono text-xs px-2.5 py-1">
              <Flame className="h-3.5 w-3.5" />
              {sim.crashTime !== null ? `Impact @ t = ${fmt(sim.crashTime, 2)}s` : "No Collision Detected"}
            </Badge>
          </div>
        }
      />

      {/* Top Telemetry Stat Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
        <StatTile
          label="Total Px (Conservation)"
          value={fmt(currentStep.pTotalX, 3)}
          unit="kg·m/s"
          accent={COLORS.drone1}
          hint={
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> conserved (Δ 0.000)
            </span>
          }
        />
        <StatTile
          label="Total Py (Conservation)"
          value={fmt(currentStep.pTotalY, 3)}
          unit="kg·m/s"
          accent={COLORS.drone2}
          hint={
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> conserved (Δ 0.000)
            </span>
          }
        />
        <StatTile
          label="Kinetic Energy"
          value={fmt(currentStep.keTotal, 2)}
          unit="J"
          accent="#10b981"
          hint={`Initial: ${fmt(sim.initialTotalKE, 1)} J · Lost: ${fmt(sim.keLossPct, 1)}%`}
        />
        <StatTile
          label="Spin ω₁ (Drone 1)"
          value={fmt(currentStep.w1, 1)}
          unit="rad/s"
          accent={COLORS.drone1}
          hint={`Inertia I₁ = ${config.I1} kg·m²`}
        />
        <StatTile
          label="Spin ω₂ (Drone 2)"
          value={fmt(currentStep.w2, 1)}
          unit="rad/s"
          accent={COLORS.drone2}
          hint={`Inertia I₂ = ${config.I2} kg·m²`}
        />
        <StatTile
          label="Replay Time"
          value={fmt(currentStep.t, 2)}
          unit={`/ ${config.T.toFixed(0)}s`}
          accent="#8b5cf6"
          hint={currentStep.isCrashed ? "Post-impact braking" : "Pre-impact approach"}
        />
      </div>

      {/* Replay Controls Card */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="primary"
            onClick={() => setPlaying((p) => !p)}
            className="w-24 gap-1.5 font-mono text-xs"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "PAUSE" : "PLAY"}
          </Button>

          <Button size="icon" variant="outline" onClick={() => scrub(0)} title="Restart Replay">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <Button size="icon" variant="ghost" onClick={() => scrub(currentIdx - 20)} title="Step -0.2s">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button size="icon" variant="ghost" onClick={() => scrub(currentIdx + 20)} title="Step +0.2s">
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="flex flex-1 items-center gap-2">
            <input
              type="range"
              min={0}
              max={sim.steps.length - 1}
              value={currentIdx}
              onChange={(e) => scrub(parseInt(e.target.value, 10))}
              className="flex-1"
            />
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 w-16 text-right">
              {currentStep.t.toFixed(2)}s
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 font-mono text-xs">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-0.5 transition-colors ${
                  speed === s
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 2×2 CHART GRID */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* CHART 1: Trajectory (Pos Y vs Pos X) */}
        <Card className="flex flex-col">
          <CardHeader
            title="Chart 1: Trajectory (Pos Y vs Pos X)"
            subtitle="Motion trail paths with start positions and impact burst marker"
            action={
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="flex items-center gap-1 text-[#3b82f6]">
                  <span className="h-2 w-2 rounded-full bg-[#3b82f6]" /> Drone 1
                </span>
                <span className="flex items-center gap-1 text-[#f59e0b]">
                  <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Drone 2
                </span>
              </div>
            }
          />
          <div className="px-3 pb-4 pt-2" style={{ height: 320 }}>
            <TrajectoryCanvas
              sim={sim}
              currentStep={currentStep}
              currentIdx={currentIdx}
              crashTime={crashTime}
              impactActive={impactFlashAt}
              config={config}
            />
          </div>
        </Card>

        {/* CHART 2: Linear Momentum vs Time */}
        <Card className="flex flex-col">
          <CardHeader
            title="Chart 2: Linear Momentum vs Time"
            subtitle="Solid for Px, dashed for Py · Total Px/Py line stays flat (conserved)"
            action={
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="text-[#3b82f6]">D1 (Px/Py)</span>
                <span className="text-[#f59e0b]">D2 (Px/Py)</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">Total Px/Py</span>
              </div>
            }
          />
          <div className="px-2 pb-4 pt-2" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartPoints} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={th.grid} vertical={false} />
                <XAxis
                  dataKey="t"
                  tick={th.tickStyle}
                  axisLine={{ stroke: th.axisLine }}
                  unit="s"
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <YAxis tick={th.tickStyle} axisLine={false} width={44} tickFormatter={(v) => fmt(v, 1)} />
                <Tooltip
                  cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => `t = ${fmt(Number(l), 2)} s`}
                      valueFormatter={(v) => `${fmt(v, 3)} kg·m/s`}
                    />
                  }
                />

                {/* Crash vertical reference line */}
                {crashTime !== null && (
                  <ReferenceLine
                    x={crashTime}
                    stroke={COLORS.impact}
                    strokeDasharray="4 4"
                    strokeWidth={1.8}
                    label={{ value: "Impact", position: "insideTopLeft", fill: COLORS.impact, fontSize: 10, fontWeight: "bold" }}
                  />
                )}
                {/* Current time scrub line */}
                <ReferenceLine x={currentStep.t} stroke={th.reference} strokeOpacity={0.6} strokeDasharray="2 2" />

                {/* Total Momentum Px and Py (Strictly Conserved) */}
                <Line
                  type="monotone"
                  dataKey="pTotalX"
                  name="Total Px (System)"
                  stroke={th.dark ? "#ffffff" : "#0f172a"}
                  strokeWidth={2.4}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="pTotalY"
                  name="Total Py (System)"
                  stroke={th.dark ? "#cbd5e1" : "#475569"}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />

                {/* Drone 1 Px & Py */}
                <Line type="monotone" dataKey="p1x" name="Drone 1 Px" stroke={COLORS.drone1} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="p1y" name="Drone 1 Py" stroke={COLORS.drone1} strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />

                {/* Drone 2 Px & Py */}
                <Line type="monotone" dataKey="p2x" name="Drone 2 Px" stroke={COLORS.drone2} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="p2y" name="Drone 2 Py" stroke={COLORS.drone2} strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* CHART 3: Kinetic Energy vs Time */}
        <Card className="flex flex-col">
          <CardHeader
            title="Chart 3: Kinetic Energy vs Time"
            subtitle="Dashed lines per drone · Total KE drops at impact (e = 0.7 dissipation)"
            action={
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-[#3b82f6]">KE₁ (D1)</span>
                <span className="text-[#f59e0b]">KE₂ (D2)</span>
                <span className="text-emerald-500 font-bold">Total KE</span>
              </div>
            }
          />
          <div className="px-2 pb-4 pt-2" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartPoints} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="keFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={th.grid} vertical={false} />
                <XAxis dataKey="t" tick={th.tickStyle} axisLine={{ stroke: th.axisLine }} unit="s" tickFormatter={(v) => v.toFixed(1)} />
                <YAxis tick={th.tickStyle} axisLine={false} width={44} tickFormatter={(v) => fmt(v, 1)} />
                <Tooltip
                  cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
                  content={<ChartTooltip labelFormatter={(l) => `t = ${fmt(Number(l), 2)} s`} valueFormatter={(v) => `${fmt(v, 2)} J`} />}
                />

                {crashTime !== null && (
                  <ReferenceLine
                    x={crashTime}
                    stroke={COLORS.impact}
                    strokeDasharray="4 4"
                    strokeWidth={1.8}
                    label={{ value: "Impact", position: "insideTopLeft", fill: COLORS.impact, fontSize: 10, fontWeight: "bold" }}
                  />
                )}
                <ReferenceLine x={currentStep.t} stroke={th.reference} strokeOpacity={0.6} strokeDasharray="2 2" />

                <Area type="monotone" dataKey="keTotal" name="Total KE" stroke="#10b981" strokeWidth={2.4} fill="url(#keFill)" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ke1" name="Drone 1 KE" stroke={COLORS.drone1} strokeWidth={1.8} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ke2" name="Drone 2 KE" stroke={COLORS.drone2} strokeWidth={1.8} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* CHART 4: Angular Velocity vs Time */}
        <Card className="flex flex-col">
          <CardHeader
            title="Chart 4: Angular Velocity vs Time"
            subtitle="Flat at 0 rad/s before impact, spikes from tangential friction, decays via kw = 2.0"
            action={
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-[#3b82f6]">Spin ω₁ (Drone 1)</span>
                <span className="text-[#f59e0b]">Spin ω₂ (Drone 2)</span>
              </div>
            }
          />
          <div className="px-2 pb-4 pt-2" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartPoints} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={th.grid} vertical={false} />
                <XAxis dataKey="t" tick={th.tickStyle} axisLine={{ stroke: th.axisLine }} unit="s" tickFormatter={(v) => v.toFixed(1)} />
                <YAxis tick={th.tickStyle} axisLine={false} width={44} tickFormatter={(v) => fmt(v, 1)} />
                <Tooltip
                  cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
                  content={<ChartTooltip labelFormatter={(l) => `t = ${fmt(Number(l), 2)} s`} valueFormatter={(v) => `${fmt(v, 2)} rad/s`} />}
                />
                <ReferenceLine y={0} stroke={th.axisLine} />

                {crashTime !== null && (
                  <ReferenceLine
                    x={crashTime}
                    stroke={COLORS.impact}
                    strokeDasharray="4 4"
                    strokeWidth={1.8}
                    label={{ value: "Impact", position: "insideTopLeft", fill: COLORS.impact, fontSize: 10, fontWeight: "bold" }}
                  />
                )}
                <ReferenceLine x={currentStep.t} stroke={th.reference} strokeOpacity={0.6} strokeDasharray="2 2" />

                <Line type="monotone" dataKey="w1" name="Spin ω₁" stroke={COLORS.drone1} strokeWidth={2.4} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="w2" name="Spin ω₂" stroke={COLORS.drone2} strokeWidth={2.4} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Interactive Parameters & Presets Panel */}
      <Card className="p-5">
        <CardHeader
          title="Interactive Simulation Settings & Presets"
          subtitle="Tweak masses, restitution, friction, damping, or test geometry live"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setConfig(DEFAULT_SIM_CONFIG);
                setActivePreset("Standard Oblique Collision");
              }}
              className="text-xs"
            >
              Reset Defaults
            </Button>
          }
          className="px-0 pt-0"
        />

        {/* Presets */}
        <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 py-1 mr-1">
            Presets:
          </span>
          {SIM_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p.name)}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition-all ${
                activePreset === p.name
                  ? "border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-300 shadow-sm"
                  : "border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0c1220] dark:text-slate-400"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Masses & Radii */}
          <div className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-[#0c1220]/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Drone Bodies (m, R)
            </p>
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span>Mass m₁</span>
                <span className="font-semibold text-brand-600 dark:text-brand-400">{config.m1.toFixed(2)} kg</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={4.0}
                step={0.05}
                value={config.m1}
                onChange={(e) => updateConfig({ m1: parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span>Mass m₂</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{config.m2.toFixed(2)} kg</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={4.0}
                step={0.05}
                value={config.m2}
                onChange={(e) => updateConfig({ m2: parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span>Radius R₁ / R₂</span>
                <span className="text-slate-600 dark:text-slate-300">{config.R1}m / {config.R2}m</span>
              </div>
              <input
                type="range"
                min={0.15}
                max={0.5}
                step={0.01}
                value={config.R1}
                onChange={(e) => updateConfig({ R1: parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>

          {/* Restitution & Friction */}
          <div className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-[#0c1220]/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Restitution & Friction (e, μ)
            </p>
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span>Restitution e</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{config.e.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={config.e}
                onChange={(e) => updateConfig({ e: parseFloat(e.target.value) })}
                className="mt-1"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">0 = stick, 1 = perfectly elastic bounce</p>
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span>Friction μ</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{config.mu.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.02}
                value={config.mu}
                onChange={(e) => updateConfig({ mu: parseFloat(e.target.value) })}
                className="mt-1"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Drives tangential impulse and torque spin</p>
            </div>
          </div>

          {/* Post-Crash Braking */}
          <div className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-[#0c1220]/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Post-Crash Braking (kv, kw)
            </p>
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span>Linear Damping kv</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{config.kv.toFixed(1)} s⁻¹</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={4.0}
                step={0.1}
                value={config.kv}
                onChange={(e) => updateConfig({ kv: parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span>Spin Damping kw</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{config.kw.toFixed(1)} s⁻¹</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={5.0}
                step={0.1}
                value={config.kw}
                onChange={(e) => updateConfig({ kw: parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>

          {/* Approach Speeds */}
          <div className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-[#0c1220]/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Initial Velocity Vectors
            </p>
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span>Drone 1 vx</span>
                <span className="font-semibold text-brand-600 dark:text-brand-400">{config.v1x.toFixed(1)} m/s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={4.5}
                step={0.1}
                value={config.v1x}
                onChange={(e) => updateConfig({ v1x: parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span>Drone 2 vx</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{config.v2x.toFixed(1)} m/s</span>
              </div>
              <input
                type="range"
                min={-4.5}
                max={-0.5}
                step={0.1}
                value={config.v2x}
                onChange={(e) => updateConfig({ v2x: parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
