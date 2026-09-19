import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, Pause, Play, RotateCcw, Sparkles, AlertCircle, Check } from "lucide-react";
import { LAB_PRESETS, resolveLabConfig, simulate, velocityRange, type LabConfig } from "../../lib/physics";
import { fmt } from "../../lib/format";
import { Badge, Button, Card, CardHeader, SectionHeading, Segmented, StatTile } from "../ui";
import { Donut } from "../charts/OverviewCharts";
import { Track, LAB_COLORS } from "./Track";
import { EnergyChart, ForceChart, MomentumChart, PhasePortrait, PositionChart, VelocityChart } from "./LabCharts";

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
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="mt-2" />
      {hint && <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

const SPEEDS = [0.1, 0.25, 0.5, 1];

interface Props {
  value: LabConfig;
  onChange: (v: LabConfig) => void;
  loadedFrom?: string | null;
}

export function Simulator({ value, onChange, loadedFrom }: Props) {
  const { input, e, clamped } = useMemo(() => resolveLabConfig(value), [value]);
  const sim = useMemo(() => simulate(input), [input]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.25);
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
        visibleRef.current = entries.some((e) => e.isIntersecting);
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
    const loop = (now: number) => {
      if (!visibleRef.current) {
        lastRef.current = null;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (lastRef.current !== null) {
        const dt = ((now - lastRef.current) / 1000) * speed;
        tRef.current += dt;
        if (tRef.current > sim.tEnd + 0.4 * speed) tRef.current = 0;
        acc += now - lastRef.current;
        if (acc > 36) {
          acc = 0;
          setT(Math.min(tRef.current, sim.tEnd));
        }
      }
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [playing, speed, sim.tEnd]);

  const scrub = (v: number) => {
    tRef.current = v;
    setT(v);
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
    { name: "Drone A KE", value: r.ke1After },
    { name: "Drone B KE", value: r.ke2After },
    { name: "Dissipated", value: r.keLoss },
  ];

  return (
    <section id="lab" ref={sectionRef} className="scroll-mt-24 space-y-4 lg:scroll-mt-44">
      <SectionHeading
        eyebrow="Collision Lab"
        title="Enter the values, watch the physics"
        description="Set both drones' mass and velocity — or pin a post-impact velocity and let the lab solve for the restitution coefficient. Velocity, position, momentum, kinetic energy, the phase portrait and the contact force all update instantly."
        action={
          loadedFrom ? (
            <Badge tone="violet" className="px-2.5 py-1">
              <FlaskConical className="h-3 w-3" /> Loaded from test {loadedFrom}
            </Badge>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* ---- inputs ---- */}
        <Card className="lg:col-span-4 xl:col-span-3">
          <CardHeader title="Scenario parameters" subtitle="1-D head-on geometry · A starts on the left" />
          <div className="space-y-5 px-5 pb-5 pt-4">
            <div className="space-y-4 rounded-xl border border-brand-200/60 bg-brand-50/40 p-3.5 dark:border-brand-500/20 dark:bg-brand-500/5">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: LAB_COLORS.a }}>
                Drone A
              </p>
              <Param label="Mass" unit="kg" value={value.m1} min={0.2} max={6} step={0.05} onChange={(m1) => set({ m1 })} color={LAB_COLORS.a} />
              <Param label="Initial velocity" unit="m/s" value={value.u1} min={-15} max={20} step={0.1} onChange={(u1) => set({ u1 })} color={LAB_COLORS.a} />
            </div>
            <div className="space-y-4 rounded-xl border border-amber-200/60 bg-amber-50/40 p-3.5 dark:border-amber-500/20 dark:bg-amber-500/5">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: LAB_COLORS.b }}>
                Drone B
              </p>
              <Param label="Mass" unit="kg" value={value.m2} min={0.2} max={6} step={0.05} onChange={(m2) => set({ m2 })} color={LAB_COLORS.b} />
              <Param label="Initial velocity" unit="m/s" value={value.u2} min={-20} max={15} step={0.1} onChange={(u2) => set({ u2 })} color={LAB_COLORS.b} />
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Solve for
                </p>
                <Segmented
                  value={value.mode}
                  onChange={setMode}
                  options={[
                    { value: "e", label: "e" },
                    { value: "v1", label: "v₁ · A" },
                    { value: "v2", label: "v₂ · B" },
                  ]}
                  className="w-full [&>button]:flex-1"
                />
              </div>

              {value.mode === "e" ? (
                <Param
                  label="Coefficient of restitution e"
                  unit=""
                  value={value.e}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(eVal) => set({ e: eVal })}
                  hint="0 = drones stick together · 1 = perfectly elastic bounce"
                />
              ) : (
                <Param
                  label={value.mode === "v1" ? "Target velocity of drone A after impact" : "Target velocity of drone B after impact"}
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
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Derived restitution</span>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono tabular-nums">e = {fmt(e, 3)}</span>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono tabular-nums">{fmt(r.keLossPct, 1)}% energy dissipated</span>
                  {clamped && (
                    <p className="mt-1 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3" /> Target clamped – outside the physically reachable range.
                    </p>
                  )}
                </div>
              )}

              <Param label="Contact duration" unit="ms" value={value.contactMs} min={5} max={250} step={1} onChange={(contactMs) => set({ contactMs })} hint="Shorter contact → higher peak force for the same impulse" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
            <div>
              <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Sparkles className="h-3 w-3" /> Presets
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
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
              title="Impact playback"
              subtitle="Scrub the timeline – the marker on every chart follows"
              action={
                <div className="flex items-center gap-2">
                  <Badge tone={phaseTone} className="capitalize">
                    <span className={`h-1.5 w-1.5 rounded-full ${now.phase === "contact" ? "animate-pulse-ring bg-rose-500" : "bg-current"}`} />
                    {now.phase}
                  </Badge>
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">t = {fmt(t * 1000, 0).padStart(5, " ")} ms</span>
                </div>
              }
            />
            <div className="px-3 pt-2">
              <Track sim={sim} t={t} />
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <Button size="icon" variant="primary" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" onClick={() => scrub(0)} aria-label="Restart">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <input
                type="range"
                min={0}
                max={sim.tEnd}
                step={0.001}
                value={t}
                onChange={(e) => scrub(parseFloat(e.target.value))}
                className="min-w-[140px] flex-1"
                aria-label="Timeline"
              />
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${speed === s ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <StatTile label="Final velocity A" value={fmt(r.v1, 2)} unit="m/s" accent={LAB_COLORS.a} hint={`from ${fmt(value.u1, 2)} m/s`} />
            <StatTile label="Final velocity B" value={fmt(r.v2, 2)} unit="m/s" accent={LAB_COLORS.b} hint={`from ${fmt(value.u2, 2)} m/s`} />
            <StatTile label="System momentum" value={fmt(r.pAfter, 3)} unit="kg·m/s" accent={LAB_COLORS.total} hint={<span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" /> conserved (Δ {fmt(Math.abs(r.pAfter - r.pBefore), 6)})</span>} />
            <StatTile label="Position at impact" value={fmt(now.x1, 2)} unit="m" accent={LAB_COLORS.com} hint={`contact plane at x = 0`} />
            <StatTile label="Separation gap" value={fmt(Math.max(0, now.gap), 2)} unit="m" accent={LAB_COLORS.lost} hint={now.phase === "contact" ? "bumpers touching" : "distance between surfaces"} />
            <StatTile label="KE before → after" value={`${fmt(r.keBefore, 1)} → ${fmt(r.keAfter, 1)}`} unit="J" accent={LAB_COLORS.ke} hint={`${fmt(100 - r.keLossPct, 1)}% retained`} />
            <StatTile label="Energy dissipated" value={fmt(r.keLoss, 2)} unit="J" accent={LAB_COLORS.lost} hint={`${fmt(r.keLossPct, 1)}% of initial KE`} />
            <StatTile label="Impulse on A" value={fmt(r.impulse, 3)} unit="N·s" hint="equal & opposite on B" />
            <StatTile label="Peak contact force" value={fmt(r.peakForce, 0)} unit="N" hint={`over ${value.contactMs} ms`} />
            <StatTile label="Closing → separation" value={`${fmt(r.closingSpeed, 2)} → ${fmt(r.separationSpeed, 2)}`} unit="m/s" hint={`CoM velocity ${fmt(r.vCom, 2)} m/s`} />
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
        <EnergyChart sim={sim} t={t} />
        <PhasePortrait sim={sim} t={t} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ForceChart sim={sim} t={t} />
        <Donut
          title="Energy after impact"
          subtitle="Kinetic energy split once the drones separate"
          data={energyData}
          colors={[LAB_COLORS.a, LAB_COLORS.b, LAB_COLORS.lost]}
          centerLabel="KE retained"
          centerValue={`${fmt(100 - r.keLossPct, 1)}%`}
          valueFormatter={(v) => `${fmt(v, 1)} J`}
        />
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader title="Conservation ledger" subtitle="Before vs. after the impact" />
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
                  { q: "Σp", b: r.pBefore, a: r.pAfter, u: "kg·m/s", bold: true },
                  { q: "KE₁ (A)", b: r.ke1Before, a: r.ke1After, u: "J" },
                  { q: "KE₂ (B)", b: r.ke2Before, a: r.ke2After, u: "J" },
                  { q: "ΣKE", b: r.keBefore, a: r.keAfter, u: "J", bold: true },
                ].map((row) => {
                  const d = row.a - row.b;
                  return (
                    <tr key={row.q} className={`border-t border-slate-100 dark:border-slate-800 ${row.bold ? "font-semibold" : ""}`}>
                      <td className="py-1.5 font-sans">
                        {row.q} <span className="text-[10px] text-slate-400">{row.u}</span>
                      </td>
                      <td className="py-1.5 text-right">{fmt(row.b, 2)}</td>
                      <td className="py-1.5 text-right">{fmt(row.a, 2)}</td>
                      <td className={`py-1.5 text-right ${Math.abs(d) < 1e-6 ? "text-emerald-600 dark:text-emerald-400" : d < 0 ? "text-rose-600 dark:text-rose-400" : "text-brand-600 dark:text-brand-400"}`}>
                        {Math.abs(d) < 1e-6 ? "0.00" : `${d > 0 ? "+" : ""}${fmt(d, 2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Momentum is conserved exactly because the contact force is internal. Kinetic energy is only conserved when e = 1; otherwise the
              shortfall goes into bumper deformation, heat and sound.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
