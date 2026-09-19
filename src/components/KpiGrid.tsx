import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Activity, AlertTriangle, Gauge, Layers, Weight, Zap, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Kpis, TimePoint } from "../lib/analytics";
import { pctChange } from "../lib/analytics";
import { fmt, fmtInt, fmtPct, fmtSigned } from "../lib/format";
import { Card } from "./ui";
import { PALETTE } from "./charts/common";

interface Props {
  current: Kpis;
  previous: Kpis;
  points: TimePoint[];
  rangeDays: number;
}

type Good = "up" | "down" | "neutral";

interface KpiDef {
  key: keyof Kpis;
  label: string;
  icon: typeof Activity;
  unit?: string;
  format: (v: number) => string;
  good: Good;
  color: string;
  spark: (d: TimePoint) => number | null;
  description: string;
}

const DEFS: KpiDef[] = [
  {
    key: "count",
    label: "Collision tests",
    icon: Layers,
    format: fmtInt,
    good: "up",
    color: PALETTE.blue,
    spark: (d) => d.count,
    description: "Total runs logged",
  },
  {
    key: "avgClosing",
    label: "Avg closing velocity",
    icon: Gauge,
    unit: "m/s",
    format: (v) => fmt(v, 2),
    good: "neutral",
    color: PALETTE.cyan,
    spark: (d) => d.closing,
    description: "Relative approach speed",
  },
  {
    key: "avgMomentum",
    label: "Avg system momentum",
    icon: Weight,
    unit: "kg·m/s",
    format: (v) => fmt(v, 2),
    good: "neutral",
    color: PALETTE.violet,
    spark: (d) => d.momentum,
    description: "|p| before impact",
  },
  {
    key: "avgKeRetained",
    label: "Kinetic energy retained",
    icon: Zap,
    unit: "%",
    format: (v) => fmt(v, 1),
    good: "up",
    color: PALETTE.emerald,
    spark: (d) => d.keRetained,
    description: "KE after ÷ KE before",
  },
  {
    key: "avgPeakForce",
    label: "Avg peak impact force",
    icon: Activity,
    unit: "N",
    format: (v) => fmtInt(v),
    good: "down",
    color: PALETTE.amber,
    spark: (d) => d.force,
    description: "Smooth-impulse peak",
  },
  {
    key: "anomalyRate",
    label: "Momentum anomaly rate",
    icon: AlertTriangle,
    unit: "%",
    format: (v) => fmt(v, 1),
    good: "down",
    color: PALETTE.rose,
    spark: (d) => (d.count ? (d.anomalies / d.count) * 100 : null),
    description: "|Δp| > 3% of expected",
  },
];

function Trend({ change, good }: { change: number; good: Good }) {
  if (!Number.isFinite(change)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Minus className="h-3 w-3" /> n/a
      </span>
    );
  }
  const up = change > 0.05;
  const flat = Math.abs(change) <= 0.05;
  const positive = good === "neutral" ? null : good === "up" ? up : !up;
  const cls = flat
    ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
    : positive === null
      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
      : positive
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>
      <Icon className="h-3 w-3" />
      {fmtSigned(change, 1)}%
    </span>
  );
}

export function KpiGrid({ current, previous, points, rangeDays }: Props) {
  const sparkData = useMemo(() => {
    // collapse to ≤ 24 buckets so sparklines stay smooth on long ranges
    const size = Math.max(1, Math.ceil(points.length / 24));
    const out: { i: number; values: Record<string, number | null> }[] = [];
    for (let i = 0; i < points.length; i += size) {
      const chunk = points.slice(i, i + size);
      const values: Record<string, number | null> = {};
      for (const def of DEFS) {
        const vals = chunk.map(def.spark).filter((v): v is number => v !== null && Number.isFinite(v));
        values[def.key] =
          def.key === "count" ? vals.reduce((a, b) => a + b, 0) : vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
      out.push({ i, values });
    }
    return out;
  }, [points]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {DEFS.map((def, idx) => {
        const value = current[def.key];
        const prev = previous[def.key];
        const change = pctChange(value, prev);
        const Icon = def.icon;
        const data = sparkData.map((s) => ({ i: s.i, v: s.values[def.key] }));
        return (
          <Card key={def.key} className="group relative overflow-hidden p-4 animate-fade-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${def.color}1f`, color: def.color }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{def.label}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{def.description}</p>
                </div>
              </div>
              <Trend change={change} good={def.good} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                  {Number.isFinite(value) ? def.format(value) : "–"}
                  {def.unit && Number.isFinite(value) && <span className="ml-1 text-xs font-normal text-slate-400">{def.unit}</span>}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                  prev {rangeDays}d:{" "}
                  <span className="font-mono">{Number.isFinite(prev) ? (def.unit === "%" ? fmtPct(prev) : def.format(prev)) : "–"}</span>
                </p>
              </div>
              <div className="h-10 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`spark-${def.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={def.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={def.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={def.color}
                      strokeWidth={1.5}
                      fill={`url(#spark-${def.key})`}
                      connectNulls
                      dot={false}
                      isAnimationActive
                      animationDuration={700}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 opacity-60 transition-opacity group-hover:opacity-100"
              style={{ background: `linear-gradient(90deg, ${def.color}, transparent)` }}
            />
          </Card>
        );
      })}
    </div>
  );
}
