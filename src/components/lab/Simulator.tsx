import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlaskConical,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CircleDot,
  RotateCw,
  ShieldAlert,
  Clock,
} from "lucide-react";
import {
  LAB_PRESETS,
  resolveLabConfig,
  simulate,
  velocityRange,
  radiusFromMass,
  inertiaFromMassAndRadius,
  type LabConfig,
} from "../../lib/physics";
import { fmt } from "../../lib/format";
import { Badge, Button, Card, CardHeader, SectionHeading, Segmented, StatTile } from "../ui";
import { Donut } from "../charts/OverviewCharts";
import { Track, LAB_COLORS } from "./Track";
import {
  EnergyChart,
  ForceChart,
  MomentumChart,
  PhasePortrait,
  PositionChart,
  SpinChart,
  VelocityChart,
} from "./LabCharts";

/* ---------------- parameter control ---------------- */

function Param({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
  color,
  hint,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  color?: string;
  hint?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const commit = (raw: string) => {
    setText(raw);
    const n = parseFloat(raw);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
          {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            value={text}
            min={min}
            max={max}
            step={step}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => setText(String(value))}
            className="h-7 w-20 rounded-md border border-slate-200 bg-white px-2 text-right font-mono text-xs tabular-nums text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <span className="w-12 text-[11px] text-slate-400">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-2"
      />
      {hint && <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

const SPEEDS = [0.1, 0.25, 0.5, 1, 2];

interface Props {
  value: LabConfig;
  onChange: (v: LabConfig) => void;
  loadedFrom?: string | null;
}

type TabType = "all" | "kinematics" | "geometry" | "restitution" | "spin" | "timing";

export function Simulator({ value, onChange, loadedFrom }: Props) {
  const { input, e, e1, e2, clamped } = useMemo(() => resolveLabConfig(value), [value]);
  const sim = useMemo(() => simulate(input), [input]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.25);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const visibleRef = useRef(true);
  const sectionRef = useRef<HTMLElement | null>(null);

  // reset playback when the scenario changes
  useEffect(() => {
    tRef.current = 0;
    setT(0);
    setPlaying(true);
  }, [sim]);

  // only burn CPU on the animation while the lab is actually on screen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries.some((entry) => entry.isIntersecting);
        if (visibleRef.current) lastRef.current = null;
      },
      { rootMargin: "200px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) {
      lastRef.current = null;
      return;
    }
    let acc = 0;
    const loop = (nowTime: number) => {
      if (!visibleRef.current) {
        lastRef.current = null;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (lastRef.current !== null) {
        const dt = ((nowTime - lastRef.current) / 1000) * speed;
        tRef.current += dt;
        if (tRef.current > sim.tEnd + 0.4 * speed) tRef.current = 0;
        acc += nowTime - lastRef.current;
        if (acc > 36) {
          acc = 0;
          setT(Math.min(tRef.current, sim.tEnd));
        }
      }
      lastRef.current = nowTime;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [playing, speed, sim.tEnd]);

  const scrub = (v: number) => {
    const clampedVal = Math.min(sim.tEnd, Math.max(0, v));
    tRef.current = clampedVal;
    setT(clampedVal);
    setPlaying(false);
  };

  const stepTime = (delta: number) => {
    const next = Math.min(sim.tEnd, Math.max(0, tRef.current + delta));
    tRef.current = next;
    setT(next);
    setPlaying(false);
  };

  const set = (patch: Partial<LabConfig>) => onChange({ ...value, ...patch });

  /** Switching solve mode seeds the target with whatever velocity is current. */
  const setMode = (mode: LabConfig["mode"]) => {
    if (mode === value.mode) return;
    if (mode === "e") onChange({ ...value, mode });
    else onChange({ ...value, mode, target: mode === "v1" ? r.v1 : r.v2 });
  };

  const r = sim.result;
  const now = sim.sample(t);
  const regime = e >= 0.8 ? "Elastic" : e <= 0.06 ? "Perfectly inelastic" : "Partially inelastic";
  const regimeTone = e >= 0.8 ? "emerald" : e <= 0.06 ? "amber" : "blue";
  const phaseTone = now.phase === "contact" ? "rose" : now.phase === "approach" ? "blue" : "emerald";
  const range = velocityRange(input, value.mode === "v1" ? "v1" : "v2");

  const energyData = [
    { name: "Drone A Trans KE", value: r.ke1After },
    { name: "Drone B Trans KE", value: r.ke2After },
    { name: "Drone A Spin KE", value: r.keRot1After },
    { name: "Drone B Spin KE", value: r.keRot2After },
    { name: "Dissipated", value: r.keLoss },
  ];

  // Resolved radius and inertia for display
  const curR1 = value.r1 ?? radiusFromMass(value.m1);
  const curR2 = value.r2 ?? radiusFromMass(value.m2);
  const curI1 = value.i1 ?? inertiaFromMassAndRadius(value.m1, curR1);
  const curI2 = value.i2 ?? inertiaFromMassAndRadius(value.m2, curR2);
  const curW1 = value.w1 ?? 0;
  const curW2 = value.w2 ?? 0;
  const curE1 = value.e1 ?? Math.sqrt(clamp(value.e, 0, 1));
  const curE2 = value.e2 ?? Math.sqrt(clamp(value.e, 0, 1));
  const curContactMs = value.contactMs;
  const curTTotal = value.tTotal ?? Math.round((sim.tEnd) * 10) / 10;
  const curOffset = value.impactOffset ?? 0;

  return (
    <section id="lab" ref={sectionRef} className="scroll-mt-24 space-y-4 lg:scroll-mt-44">
      <SectionHeading
        eyebrow="Collision Lab"
        title="Multi-Parameter Collision & Spin Simulator"
        description="Configure mass, velocities, individual collision radii (r₁, r₂), spin inertia (I₁, I₂), angular spin (ω₁, ω₂), bumper restitution (e₁, e₂), and contact timing. Watch linear & rotational physics interact in real time."
        action={
          loadedFrom ? (
            <Badge tone="violet" className="px-2.5 py-1">
              <FlaskConical className="h-3 w-3" /> Loaded from test {loadedFrom}
            </Badge>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* ---- inputs panel ---- */}
        <Card className="lg:col-span-4 xl:col-span-3">
          <CardHeader
            title="Scenario parameters"
            subtitle="Explore linear & rotational collision dynamics"
          />

          {/* Tab Filter Chips */}
          <div className="flex flex-wrap gap-1 border-b border-slate-100 px-4 pb-2.5 pt-1 dark:border-slate-800">
            {[
              { id: "all", label: "All", icon: SlidersHorizontal },
              { id: "kinematics", label: "Kinematics", icon: FlaskConical },
              { id: "geometry", label: "Radii r₁, r₂", icon: CircleDot },
              { id: "restitution", label: "Restitution e₁, e₂", icon: ShieldAlert },
              { id: "spin", label: "Spin & I", icon: RotateCw },
              { id: "timing", label: "Timing t", icon: Clock },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-brand-500 text-white shadow-sm dark:bg-brand-600"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="max-h-[720px] space-y-4 overflow-y-auto px-5 pb-5 pt-3">
            {/* 1. KINEMATICS */}
            {(activeTab === "all" || activeTab === "kinematics") && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Core Kinematics
                </p>
                <div className="space-y-3 rounded-xl border border-brand-200/60 bg-brand-50/40 p-3 dark:border-brand-500/20 dark:bg-brand-500/5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: LAB_COLORS.a }}>
                    Drone A
                  </p>
                  <Param
                    label="Mass m₁"
                    unit="kg"
                    value={value.m1}
                    min={0.2}
                    max={6}
                    step={0.05}
                    onChange={(m1) => set({ m1 })}
                    color={LAB_COLORS.a}
                  />
                  <Param
                    label="Initial velocity u₁"
                    unit="m/s"
                    value={value.u1}
                    min={-15}
                    max={20}
                    step={0.1}
                    onChange={(u1) => set({ u1 })}
                    color={LAB_COLORS.a}
                  />
                </div>
                <div className="space-y-3 rounded-xl border border-amber-200/60 bg-amber-50/40 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: LAB_COLORS.b }}>
                    Drone B
                  </p>
                  <Param
                    label="Mass m₂"
                    unit="kg"
                    value={value.m2}
                    min={0.2}
                    max={6}
                    step={0.05}
                    onChange={(m2) => set({ m2 })}
                    color={LAB_COLORS.b}
                  />
                  <Param
                    label="Initial velocity u₂"
                    unit="m/s"
                    value={value.u2}
                    min={-20}
                    max={15}
                    step={0.1}
                    onChange={(u2) => set({ u2 })}
                    color={LAB_COLORS.b}
                  />
                </div>
              </div>
            )}

            {/* 2. COLLISION RADII */}
            {(activeTab === "all" || activeTab === "geometry") && (
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Collision Radii (r₁, r₂)
                  </p>
                  <button
                    onClick={() => {
                      const rA = radiusFromMass(value.m1);
                      const rB = radiusFromMass(value.m2);
                      set({ r1: rA, r2: rB });
                    }}
                    className="text-[10px] font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Auto from mass
                  </button>
                </div>
                <Param
                  label="Drone A radius r₁"
                  unit="m"
                  value={curR1}
                  min={0.08}
                  max={1.0}
                  step={0.01}
                  onChange={(r1) => set({ r1 })}
                  color={LAB_COLORS.a}
                  hint="Scales visual drone size, bumper contact surface & spin leverage"
                />
                <Param
                  label="Drone B radius r₂"
                  unit="m"
                  value={curR2}
                  min={0.08}
                  max={1.0}
                  step={0.01}
                  onChange={(r2) => set({ r2 })}
                  color={LAB_COLORS.b}
                  hint="Scales visual drone size, bumper contact surface & spin leverage"
                />
              </div>
            )}

            {/* 3. RESTITUTION (e1, e2, e) & SOLVE MODE */}
            {(activeTab === "all" || activeTab === "restitution") && (
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Solve for
                  </p>
                  <Segmented
                    value={value.mode}
                    onChange={setMode}
                    options={[
                      { value: "e", label: "Restitution (e)" },
                      { value: "v1", label: "v₁ · A" },
                      { value: "v2", label: "v₂ · B" },
                    ]}
                    className="w-full [&>button]:flex-1"
                  />
                </div>

                {value.mode === "e" ? (
                  <div className="space-y-3">
                    <Param
                      label="Combined Restitution e"
                      unit=""
                      value={e}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(eVal) => {
                        const sq = Math.sqrt(eVal);
                        set({ e: eVal, e1: sq, e2: sq });
                      }}
                      hint="Effective coefficient of restitution (e = e₁ · e₂)"
                    />
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                      <div>
                        <Param
                          label="Bumper e₁ (A)"
                          unit=""
                          value={curE1}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(e1Val) => {
                            const newE = clamp(e1Val * curE2, 0, 1);
                            set({ e1: e1Val, e: newE });
                          }}
                          color={LAB_COLORS.a}
                        />
                      </div>
                      <div>
                        <Param
                          label="Bumper e₂ (B)"
                          unit=""
                          value={curE2}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(e2Val) => {
                            const newE = clamp(curE1 * e2Val, 0, 1);
                            set({ e2: e2Val, e: newE });
                          }}
                          color={LAB_COLORS.b}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Param
                    label={value.mode === "v1" ? "Target velocity v₁ (A)" : "Target velocity v₂ (B)"}
                    unit="m/s"
                    value={value.target}
                    min={range.min}
                    max={range.max}
                    step={0.05}
                    onChange={(v) => set({ target: v })}
                    color={value.mode === "v1" ? LAB_COLORS.a : LAB_COLORS.b}
                    hint={
                      r.collides
                        ? `Reachable range ${fmt(range.min, 2)} … ${fmt(range.max, 2)} m/s → e = ${fmt(e, 3)}`
                        : "Drones never meet, so no target is reachable"
                    }
                  />
                )}

                {value.mode !== "e" && r.collides && (
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Derived restitution</span>
                    <span className="mx-1.5">·</span>
                    <span className="font-mono tabular-nums">e = {fmt(e, 3)} (e₁ ≈ {fmt(e1, 2)}, e₂ ≈ {fmt(e2, 2)})</span>
                    {clamped && (
                      <p className="mt-1 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" /> Target clamped – outside physically reachable range.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. SPIN & INERTIA */}
            {(activeTab === "all" || activeTab === "spin") && (
              <div className="space-y-3 rounded-xl border border-cyan-200/60 bg-cyan-50/30 p-3 dark:border-cyan-500/20 dark:bg-cyan-500/5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                    Spin & Inertia (I₁, I₂, ω₁, ω₂)
                  </p>
                  <button
                    onClick={() => {
                      const iA = inertiaFromMassAndRadius(value.m1, curR1);
                      const iB = inertiaFromMassAndRadius(value.m2, curR2);
                      set({ i1: iA, i2: iB });
                    }}
                    className="text-[10px] font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                  >
                    Auto I
                  </button>
                </div>
                <Param
                  label="Spin inertia I₁ (A)"
                  unit="kg·m²"
                  value={curI1}
                  min={0.005}
                  max={0.8}
                  step={0.005}
                  onChange={(i1) => set({ i1 })}
                  color={LAB_COLORS.a}
                />
                <Param
                  label="Initial spin ω₁ (A)"
                  unit="rad/s"
                  value={curW1}
                  min={-150}
                  max={150}
                  step={5}
                  onChange={(w1) => set({ w1 })}
                  color={LAB_COLORS.a}
                />
                <div className="border-t border-cyan-200/50 pt-2 dark:border-cyan-500/20" />
                <Param
                  label="Spin inertia I₂ (B)"
                  unit="kg·m²"
                  value={curI2}
                  min={0.005}
                  max={0.8}
                  step={0.005}
                  onChange={(i2) => set({ i2 })}
                  color={LAB_COLORS.b}
                />
                <Param
                  label="Initial spin ω₂ (B)"
                  unit="rad/s"
                  value={curW2}
                  min={-150}
                  max={150}
                  step={5}
                  onChange={(w2) => set({ w2 })}
                  color={LAB_COLORS.b}
                />
                <div className="border-t border-cyan-200/50 pt-2 dark:border-cyan-500/20" />
                <Param
                  label="Impact offset h"
                  unit="m"
                  value={curOffset}
                  min={-0.2}
                  max={0.2}
                  step={0.01}
                  onChange={(impactOffset) => set({ impactOffset })}
                  hint="Vertical contact arm – induces torque and angular acceleration"
                />
              </div>
            )}

            {/* 5. TIMING & CONTACT */}
            {(activeTab === "all" || activeTab === "timing") && (
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Timing & Observation
                </p>
                <Param
                  label="Contact duration τ"
                  unit="ms"
                  value={curContactMs}
                  min={5}
                  max={250}
                  step={1}
                  onChange={(contactMs) => set({ contactMs })}
                  hint="Shorter contact → higher peak contact force for the same impulse"
                />
                <Param
                  label="Total observation window T"
                  unit="s"
                  value={curTTotal}
                  min={0.8}
                  max={3.5}
                  step={0.1}
                  onChange={(tTotal) => set({ tTotal })}
                  hint="Overall simulation span before and after impact"
                />
              </div>
            )}

            {/* Regime badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge tone={regimeTone}>{regime}</Badge>
              <Badge tone="slate">
                e = <span className="ml-1 font-mono">{fmt(e, 2)}</span>
              </Badge>
              {!r.collides && (
                <Badge tone="rose">
                  <AlertCircle className="h-3 w-3" /> No impact: A must move faster than B
                </Badge>
              )}
            </div>

            {/* Presets */}
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Sparkles className="h-3 w-3" /> Presets
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {LAB_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => onChange({ ...p.input, mode: "e", target: 0 })}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-left transition-colors hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
                  >
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-100">{p.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* ---- track + results ---- */}
        <div className="space-y-4 lg:col-span-8 xl:col-span-9">
          <Card>
            <CardHeader
              title="Impact & Spin Playback"
              subtitle="Scrub or step through the timeline to see simultaneous linear and rotational exchange"
              action={
                <div className="flex items-center gap-2">
                  <Badge tone={phaseTone} className="capitalize">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        now.phase === "contact" ? "animate-pulse-ring bg-rose-500" : "bg-current"
                      }`}
                    />
                    {now.phase}
                  </Badge>
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    t = {fmt(t * 1000, 0).padStart(4, " ")} / {fmt(sim.tEnd * 1000, 0)} ms
                  </span>
                </div>
              }
            />
            <div className="px-3 pt-2">
              <Track sim={sim} t={t} />
            </div>

            {/* Controls bar with step forward / step backward */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:gap-3 sm:px-5">
              <Button
                size="icon"
                variant="primary"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" onClick={() => scrub(0)} aria-label="Restart">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => stepTime(-0.02)}
                title="Step backward 20ms"
                aria-label="Step back"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => stepTime(0.02)}
                title="Step forward 20ms"
                aria-label="Step forward"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <input
                type="range"
                min={0}
                max={sim.tEnd}
                step={0.001}
                value={t}
                onChange={(e) => scrub(parseFloat(e.target.value))}
                className="min-w-[120px] flex-1"
                aria-label="Timeline"
              />
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] transition-colors sm:px-2 sm:py-1 ${
                      speed === s
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* ---- Stat tiles grid ---- */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <StatTile
              label="Final velocity A (v₁)"
              value={fmt(r.v1, 2)}
              unit="m/s"
              accent={LAB_COLORS.a}
              hint={`from ${fmt(value.u1, 2)} m/s`}
            />
            <StatTile
              label="Final velocity B (v₂)"
              value={fmt(r.v2, 2)}
              unit="m/s"
              accent={LAB_COLORS.b}
              hint={`from ${fmt(value.u2, 2)} m/s`}
            />
            <StatTile
              label="Spin ω₁ (A)"
              value={fmt(r.w1After, 1)}
              unit="rad/s"
              accent={LAB_COLORS.a}
              hint={`from ${fmt(r.w1Before, 1)} rad/s (Δ ${fmt(r.w1After - r.w1Before, 1)})`}
            />
            <StatTile
              label="Spin ω₂ (B)"
              value={fmt(r.w2After, 1)}
              unit="rad/s"
              accent={LAB_COLORS.b}
              hint={`from ${fmt(r.w2Before, 1)} rad/s (Δ ${fmt(r.w2After - r.w2Before, 1)})`}
            />
            <StatTile
              label="System linear momentum"
              value={fmt(r.pAfter, 3)}
              unit="kg·m/s"
              accent={LAB_COLORS.total}
              hint={
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> conserved (Δ {fmt(Math.abs(r.pAfter - r.pBefore), 6)})
                </span>
              }
            />
            <StatTile
              label="System angular momentum"
              value={fmt(r.lAfter, 3)}
              unit="kg·m²/s"
              accent={LAB_COLORS.rot}
              hint={`from ${fmt(r.lBefore, 3)} kg·m²/s`}
            />
            <StatTile
              label="Rotational KE before → after"
              value={`${fmt(r.keRotBefore, 1)} → ${fmt(r.keRotAfter, 1)}`}
              unit="J"
              accent={LAB_COLORS.rot}
              hint={`I₁ = ${fmt(r.i1, 3)}, I₂ = ${fmt(r.i2, 3)}`}
            />
            <StatTile
              label="Total Energy (Trans + Rot)"
              value={`${fmt(r.totalEnergyBefore, 1)} → ${fmt(r.totalEnergyAfter, 1)}`}
              unit="J"
              accent={LAB_COLORS.ke}
              hint={`Dissipated: ${fmt(r.keLoss, 1)} J (${fmt(r.keLossPct, 1)}%)`}
            />
            <StatTile
              label="Collision Radii"
              value={`${fmt(sim.r1, 2)}m / ${fmt(sim.r2, 2)}m`}
              unit=""
              hint={`Span: ${fmt(sim.r1 + sim.r2, 2)}m bumper contact`}
            />
            <StatTile
              label="Restitution Breakdown"
              value={`e = ${fmt(e, 2)}`}
              unit=""
              hint={`e₁ = ${fmt(e1, 2)}, e₂ = ${fmt(e2, 2)}`}
            />
            <StatTile
              label="Peak contact force"
              value={fmt(r.peakForce, 0)}
              unit="N"
              hint={`over ${value.contactMs} ms (Impulse: ${fmt(r.impulse, 2)} N·s)`}
            />
            <StatTile
              label="Separation gap"
              value={fmt(Math.max(0, now.gap), 2)}
              unit="m"
              accent={LAB_COLORS.lost}
              hint={now.phase === "contact" ? "bumpers touching" : "clearance between surfaces"}
            />
          </div>
        </div>
      </div>

      {/* ---- physics charts ---- */}
      <div className="grid gap-4 md:grid-cols-2">
        <VelocityChart sim={sim} t={t} />
        <PositionChart sim={sim} t={t} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MomentumChart sim={sim} t={t} />
        <SpinChart sim={sim} t={t} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <EnergyChart sim={sim} t={t} />
        <PhasePortrait sim={sim} t={t} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ForceChart sim={sim} t={t} />
        <Donut
          title="Energy after impact"
          subtitle="Distribution of kinetic energy and deformation loss"
          data={energyData}
          colors={[LAB_COLORS.a, LAB_COLORS.b, "#06b6d4", "#22d3ee", LAB_COLORS.lost]}
          centerLabel="KE retained"
          centerValue={`${fmt(100 - r.keLossPct, 1)}%`}
          valueFormatter={(v) => `${fmt(v, 1)} J`}
        />
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader title="Conservation & Dynamics Ledger" subtitle="Linear, angular and energy balances" />
          <div className="px-5 pb-5 pt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="pb-2 font-medium">Quantity</th>
                  <th className="pb-2 text-right font-medium">Before</th>
                  <th className="pb-2 text-right font-medium">After</th>
                  <th className="pb-2 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums text-slate-800 dark:text-slate-100">
                {[
                  { q: "p₁ (A)", b: r.p1Before, a: r.p1After, u: "kg·m/s" },
                  { q: "p₂ (B)", b: r.p2Before, a: r.p2After, u: "kg·m/s" },
                  { q: "Σp (Linear)", b: r.pBefore, a: r.pAfter, u: "kg·m/s", bold: true },
                  { q: "L₁ (A)", b: r.l1Before, a: r.l1After, u: "kg·m²/s" },
                  { q: "L₂ (B)", b: r.l2Before, a: r.l2After, u: "kg·m²/s" },
                  { q: "ΣL (Spin)", b: r.lBefore, a: r.lAfter, u: "kg·m²/s", bold: true },
                  { q: "Trans KE₁ (A)", b: r.ke1Before, a: r.ke1After, u: "J" },
                  { q: "Trans KE₂ (B)", b: r.ke2Before, a: r.ke2After, u: "J" },
                  { q: "Rot KE₁ (A)", b: r.keRot1Before, a: r.keRot1After, u: "J" },
                  { q: "Rot KE₂ (B)", b: r.keRot2Before, a: r.keRot2After, u: "J" },
                  { q: "ΣE Total", b: r.totalEnergyBefore, a: r.totalEnergyAfter, u: "J", bold: true },
                ].map((row) => {
                  const d = row.a - row.b;
                  return (
                    <tr
                      key={row.q}
                      className={`border-t border-slate-100 dark:border-slate-800 ${
                        row.bold ? "font-semibold" : ""
                      }`}
                    >
                      <td className="py-1.5 font-sans">
                        {row.q} <span className="text-[10px] text-slate-400">{row.u}</span>
                      </td>
                      <td className="py-1.5 text-right">{fmt(row.b, 2)}</td>
                      <td className="py-1.5 text-right">{fmt(row.a, 2)}</td>
                      <td
                        className={`py-1.5 text-right ${
                          Math.abs(d) < 1e-6
                            ? "text-emerald-600 dark:text-emerald-400"
                            : d < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-brand-600 dark:text-brand-400"
                        }`}
                      >
                        {Math.abs(d) < 1e-6 ? "0.00" : `${d > 0 ? "+" : ""}${fmt(d, 2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Linear momentum is strictly conserved. Impulsive torque during contact transfers spin between bodies. Kinetic
              energy is conserved when e = 1 and surfaces are frictionless; otherwise deformation and friction dissipate energy.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
