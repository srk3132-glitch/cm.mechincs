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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  DEFAULT_SIM_CONFIG,
  runTwoDroneSimulation,
  SIM_PRESETS,
  type SimConfig,
  type SimStep,
} from "../../lib/collisionPhysicsSim";
import { fmt } from "../../lib/format";
import type { Dataset } from "../../lib/parsers/dataset";
import { Badge, Button, Card, CardHeader, SectionHeading, StatTile } from "../ui";
import { ChartTooltip, useChartTheme } from "../charts/common";
import { DatasetCharts, DatasetEnergyDonut, DatasetHistogram } from "../upload/DatasetCharts";

const COLORS = {
  drone1: "#3b82f6", // Electric blue
  drone2: "#f59e0b", // Amber / soft red
  total: "#f8fafc",  // Neutral white / light gray for dark theme
  totalDark: "#0f172a",
  impact: "#ef4444", // Soft red
  trail: "#06b6d4",
};

export function CollisionPhysicsModule({ importedDataset }: { importedDataset?: Dataset | null }) {
  const th = useChartTheme();
  const [config, setConfig] = useState<SimConfig>(DEFAULT_SIM_CONFIG);

  if (importedDataset) {
    const selected = importedDataset.numericColumns.filter((column) => column !== importedDataset.xColumn);
    const visible = selected.length ? selected : importedDataset.numericColumns.slice(0, 3);

    return (
      <div className="space-y-6 pt-6">
        <SectionHeading
          eyebrow="Imported physics results"
          title={`${importedDataset.name} · collision signal results`}
          description="MATLAB telemetry was parsed into a live chart set, showing the uploaded signal stack and energy summary directly in the collision physics workspace."
          action={
            <Badge tone="blue" className="font-mono text-xs px-2.5 py-1">
              {importedDataset.rows.length.toLocaleString()} rows
            </Badge>
          }
        />

        <div className="grid gap-4 md:grid-cols-2">
          <DatasetEnergyDonut dataset={importedDataset} />
          <DatasetHistogram dataset={importedDataset} column={importedDataset.xColumn || importedDataset.numericColumns[0]} />
        </div>

        <DatasetCharts dataset={importedDataset} selected={visible} xColumn={importedDataset.xColumn} />
      </div>
    );
  }
  const [activePreset, setActivePreset] = useState("Standard Oblique Collision");

  // Run the physics simulation client-side
  const sim = useMemo(() => runTwoDroneSimulation(config), [config]);

  // Replay playback state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Reset playback when sim changes
  useEffect(() => {
    setCurrentIdx(0);
    setPlaying(true);
  }, [sim]);

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
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid stroke={th.grid} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Pos X"
                  domain={[-4.5, 4.5]}
                  tick={th.tickStyle}
                  axisLine={{ stroke: th.axisLine }}
                  label={{ value: "Position X (m)", position: "insideBottom", offset: -12, fontSize: 10, fill: th.muted }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Pos Y"
                  domain={[-2.5, 2.5]}
                  tick={th.tickStyle}
                  axisLine={false}
                  width={36}
                  label={{ value: "Position Y (m)", angle: -90, position: "insideLeft", fontSize: 10, fill: th.muted }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: th.cursor }}
                  content={
                    <ChartTooltip
                      labelFormatter={(_l, items) => `t = ${fmt(items[0]?.payload?.t ?? currentStep.t, 2)}s`}
                      valueFormatter={(v) => `${fmt(v, 2)} m`}
                    />
                  }
                />

                {/* Reference Center Lines */}
                <ReferenceLine x={0} stroke={th.axisLine} strokeDasharray="3 3" opacity={0.4} />
                <ReferenceLine y={0} stroke={th.axisLine} strokeDasharray="3 3" opacity={0.4} />

                {/* Full paths (faint background paths) */}
                <Scatter
                  name="Full Path Drone 1"
                  data={fullPathDrone1}
                  line={{ stroke: COLORS.drone1, strokeWidth: 1.2, strokeDasharray: "3 3" }}
                  fill="none"
                  shape={() => null}
                  isAnimationActive={false}
                />
                <Scatter
                  name="Full Path Drone 2"
                  data={fullPathDrone2}
                  line={{ stroke: COLORS.drone2, strokeWidth: 1.2, strokeDasharray: "3 3" }}
                  fill="none"
                  shape={() => null}
                  isAnimationActive={false}
                />

                {/* Start Position Markers */}
                <Scatter
                  name="Start Drone 1"
                  data={[{ x: config.p1x, y: config.p1y }]}
                  fill={COLORS.drone1}
                  shape="circle"
                  legendType="none"
                />
                <Scatter
                  name="Start Drone 2"
                  data={[{ x: config.p2x, y: config.p2y }]}
                  fill={COLORS.drone2}
                  shape="circle"
                  legendType="none"
                />

                {/* Crash Point Burst Marker */}
                {sim.crashX !== null && sim.crashY !== null && currentStep.t >= (sim.crashTime ?? 0) && (
                  <Scatter
                    name="Impact Point"
                    data={[{ x: sim.crashX, y: sim.crashY }]}
                    fill={COLORS.impact}
                    shape="star"
                  />
                )}

                {/* Active Moving Drones */}
                <Scatter
                  name="Drone 1 Current"
                  data={[{ x: currentStep.x1, y: currentStep.y1 }]}
                  fill={COLORS.drone1}
                  shape={(props: any) => (
                    <g>
                      <circle cx={props.cx} cy={props.cy} r={9} fill={COLORS.drone1} fillOpacity={0.8} />
                      <circle cx={props.cx} cy={props.cy} r={14} fill="none" stroke={COLORS.drone1} strokeWidth={1.5} className="animate-ping" opacity={0.4} />
                      <text x={props.cx} y={props.cy + 3.5} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="bold">
                        1
                      </text>
                    </g>
                  )}
                />
                <Scatter
                  name="Drone 2 Current"
                  data={[{ x: currentStep.x2, y: currentStep.y2 }]}
                  fill={COLORS.drone2}
                  shape={(props: any) => (
                    <g>
                      <circle cx={props.cx} cy={props.cy} r={8} fill={COLORS.drone2} fillOpacity={0.8} />
                      <circle cx={props.cx} cy={props.cy} r={13} fill="none" stroke={COLORS.drone2} strokeWidth={1.5} className="animate-ping" opacity={0.4} />
                      <text x={props.cx} y={props.cy + 3.5} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="bold">
                        2
                      </text>
                    </g>
                  )}
                />
              </ScatterChart>
            </ResponsiveContainer>
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
