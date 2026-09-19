import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { CollisionRecord } from "../../data/generateData";
import {
  byArena,
  byDroneModel,
  bucketSeries,
  energyBudget,
  statusDistribution,
  typeDistribution,
  type Granularity,
  type TimePoint,
} from "../../lib/analytics";
import { fmt, fmtCompact, fmtDate, fmtInt } from "../../lib/format";
import { Card, CardHeader, Segmented } from "../ui";
import { ANIM, ChartLegend, ChartTooltip, DRONE_COLORS, EmptyChart, PALETTE, STATUS_COLORS, TYPE_COLORS, useChartTheme, type TooltipItem } from "./common";

const CHART_H = 280;

/** Human label for a bucket key (hourly keys carry the hour, others the date). */
export function bucketLabel(key: string, granularity: Granularity) {
  if (granularity === "hour") return key.slice(11).replace("T", "");
  try {
    return fmtDate(key.length > 10 ? key.slice(0, 10) : key);
  } catch {
    return key;
  }
}

/* ============ Momentum & Energy trend (line) ============ */

type TrendMetric = "momentum" | "energy" | "velocity";

export function MomentumEnergyTrend({ points, granularity }: { points: TimePoint[]; granularity: Granularity }) {
  const th = useChartTheme();
  const [metric, setMetric] = useState<TrendMetric>("momentum");
  const hasData = points.some((d) => d.count > 0);
  const tickGap = points.length > 60 ? 8 : points.length > 30 ? 4 : 0;
  const xLabel = granularity === "hour" ? "Hour of day" : granularity === "day" ? "Daily averages" : "Weekly averages";

  const series: { key: keyof TimePoint; name: string; color: string; unit: string; dashed?: boolean }[] =
    metric === "momentum"
      ? [
          { key: "momentum", name: "System momentum |p|", color: PALETTE.violet, unit: "kg·m/s" },
          { key: "pError", name: "Momentum error", color: PALETTE.rose, unit: "%", dashed: true },
        ]
      : metric === "energy"
        ? [
            { key: "keBefore", name: "KE before impact", color: PALETTE.blue, unit: "J" },
            { key: "keAfter", name: "KE after impact", color: PALETTE.emerald, unit: "J" },
          ]
        : [
            { key: "closing", name: "Closing velocity", color: PALETTE.cyan, unit: "m/s" },
            { key: "separation", name: "Separation velocity", color: PALETTE.amber, unit: "m/s" },
          ];

  const dualAxis = metric === "momentum";

  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader
        title="Momentum & energy over time"
        subtitle={`${xLabel} across the filtered test log`}
        action={
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: "momentum", label: "Momentum" },
              { value: "energy", label: "Energy" },
              { value: "velocity", label: "Velocity" },
            ]}
          />
        }
      />
      <div className="px-2 pb-3 pt-2" style={{ height: CHART_H + 40 }}>
        {!hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: dualAxis ? 6 : 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={th.grid} vertical={false} />
              <XAxis
                dataKey="key"
                tick={th.tickStyle}
                axisLine={{ stroke: th.axisLine }}
                tickLine={false}
                interval={tickGap}
                minTickGap={24}
              />
              <YAxis
                yAxisId="left"
                tick={th.tickStyle}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v: number) => fmtCompact(v)}
              />
              {dualAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={th.tickStyle}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v: number) => `${v}%`}
                />
              )}
              <Tooltip
                cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
                content={
                  <ChartTooltip
                    labelFormatter={(l) => bucketLabel(String(l), granularity)}
                    valueFormatter={(v, _n, item) => `${fmt(v, 2)} ${item.unit ?? ""}`}
                    footer={(items) => {
                      const p = items[0]?.payload as TimePoint | undefined;
                      return p ? `${p.count} test${p.count === 1 ? "" : "s"} in this ${granularity}` : null;
                    }}
                  />
                }
              />
              <Legend content={<ChartLegend />} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  yAxisId={dualAxis && s.dashed ? "right" : "left"}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  unit={s.unit}
                  stroke={s.color}
                  strokeWidth={s.dashed ? 1.5 : 2.2}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                  dot={points.length <= 24 ? { r: 2.5, strokeWidth: 0, fill: s.color } : false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: th.dark ? "#0f172a" : "#fff" }}
                  connectNulls
                  {...ANIM}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ============ Collisions per period (stacked bar) ============ */

export function CollisionsByPeriod({ records, from, to }: { records: CollisionRecord[]; from: string; to: string }) {
  const th = useChartTheme();
  const { granularity, points: data } = useMemo(() => bucketSeries(records, from, to), [records, from, to]);
  const hasData = records.length > 0;
  const unitLabel = granularity === "hour" ? "hour" : granularity === "day" ? "day" : "week";
  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader
        title={`Collision tests per ${unitLabel}`}
        subtitle={granularity === "hour" ? "Stacked by collision regime · hours of the selected day" : "Stacked by collision regime"}
      />
      <div className="px-2 pb-3 pt-2" style={{ height: CHART_H + 40 }}>
        {!hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }} barCategoryGap="28%">
              <CartesianGrid stroke={th.grid} vertical={false} />
              <XAxis dataKey="label" tick={th.tickStyle} axisLine={{ stroke: th.axisLine }} tickLine={false} minTickGap={16} />
              <YAxis tick={th.tickStyle} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: th.cursor, opacity: 0.25 }}
                content={
                  <ChartTooltip
                    labelFormatter={(l) => bucketLabel(String(l), granularity)}
                    valueFormatter={(v) => fmtInt(v)}
                    footer={(items) => {
                      const total = items.reduce((a, it) => a + Number(it.value ?? 0), 0);
                      return `Total: ${total}`;
                    }}
                  />
                }
              />
              <Legend content={<ChartLegend />} />
              <Bar dataKey="Elastic" stackId="a" fill={TYPE_COLORS.Elastic} radius={[0, 0, 0, 0]} {...ANIM} />
              <Bar dataKey="Partially Inelastic" stackId="a" fill={TYPE_COLORS["Partially Inelastic"]} {...ANIM} />
              <Bar dataKey="Perfectly Inelastic" stackId="a" fill={TYPE_COLORS["Perfectly Inelastic"]} radius={[4, 4, 0, 0]} {...ANIM} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ============ Reusable donut ============ */

export function Donut({
  title,
  subtitle,
  data,
  colors,
  centerLabel,
  centerValue,
  valueFormatter,
}: {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  colors: string[];
  centerLabel: string;
  centerValue: string;
  valueFormatter: (v: number) => string;
}) {
  const th = useChartTheme();
  const total = data.reduce((a, d) => a + d.value, 0);
  const [active, setActive] = useState<number | null>(null);
  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader title={title} subtitle={subtitle} />
      <div className="relative px-2 pb-3 pt-1" style={{ height: 250 }}>
        {total <= 0 ? (
          <EmptyChart />
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={
                    <ChartTooltip
                      hideLabel
                      valueFormatter={(v) => `${valueFormatter(v)} · ${fmt((v / total) * 100, 1)}%`}
                    />
                  }
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="84%"
                  paddingAngle={2}
                  cornerRadius={4}
                  stroke="none"
                  onMouseEnter={(_, i) => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  {...ANIM}
                >
                  {data.map((d, i) => (
                    <Cell
                      key={d.name}
                      fill={colors[i % colors.length]}
                      opacity={active === null || active === i ? 1 : 0.4}
                      style={{ transition: "opacity 200ms ease" }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {active !== null && data[active] ? `${fmt((data[active].value / total) * 100, 0)}%` : centerValue}
              </p>
              <p className="max-w-[110px] text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {active !== null && data[active] ? data[active].name : centerLabel}
              </p>
            </div>
          </>
        )}
      </div>
      <ul className="mx-5 mb-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2" style={{ color: th.muted }}>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
              {d.name}
            </span>
            <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
              {valueFormatter(d.value)}
              <span className="ml-1.5 text-slate-400">{total ? fmt((d.value / total) * 100, 0) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TypeDonut({ records }: { records: CollisionRecord[] }) {
  const data = useMemo(() => typeDistribution(records), [records]);
  return (
    <Donut
      title="Collision regimes"
      subtitle="Share of tests by restitution class"
      data={data}
      colors={data.map((d) => TYPE_COLORS[d.name])}
      centerLabel="tests"
      centerValue={fmtInt(records.length)}
      valueFormatter={fmtInt}
    />
  );
}

export function EnergyDonut({ records }: { records: CollisionRecord[] }) {
  const data = useMemo(() => energyBudget(records), [records]);
  const total = data.reduce((a, d) => a + d.value, 0);
  const retained = total ? ((data[0].value + data[1].value) / total) * 100 : 0;
  return (
    <Donut
      title="Post-impact energy budget"
      subtitle="Where the initial kinetic energy ends up"
      data={data}
      colors={[PALETTE.blue, PALETTE.violet, PALETTE.rose]}
      centerLabel="KE retained"
      centerValue={`${fmt(retained, 1)}%`}
      valueFormatter={(v) => `${fmtCompact(v)} J`}
    />
  );
}

export function StatusDonut({ records }: { records: CollisionRecord[] }) {
  const data = useMemo(() => statusDistribution(records), [records]);
  const nominal = records.length ? (data[0].value / records.length) * 100 : 0;
  return (
    <Donut
      title="Conservation check status"
      subtitle="Measured Δp against the expected momentum"
      data={data}
      colors={data.map((d) => STATUS_COLORS[d.name])}
      centerLabel="nominal"
      centerValue={`${fmt(nominal, 0)}%`}
      valueFormatter={fmtInt}
    />
  );
}

/* ============ KE loss & force by drone model (bar) ============ */

export function DroneModelBars({ records }: { records: CollisionRecord[] }) {
  const th = useChartTheme();
  const data = useMemo(() => byDroneModel(records), [records]);
  const hasData = records.length > 0;
  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader title="Energy loss & impact force by model" subtitle="Average per test the model participated in" />
      <div className="px-2 pb-3 pt-2" style={{ height: CHART_H + 40 }}>
        {!hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid stroke={th.grid} vertical={false} />
              <XAxis dataKey="short" tick={th.tickStyle} axisLine={{ stroke: th.axisLine }} tickLine={false} />
              <YAxis yAxisId="l" tick={th.tickStyle} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => `${v}%`} />
              <YAxis yAxisId="r" orientation="right" tick={th.tickStyle} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => fmtCompact(v)} />
              <Tooltip
                cursor={{ fill: th.cursor, opacity: 0.25 }}
                content={
                  <ChartTooltip
                    labelFormatter={(_l, items) => {
                      const p = items[0]?.payload as { name?: string; tests?: number } | undefined;
                      return `${p?.name ?? ""} · ${p?.tests ?? 0} tests`;
                    }}
                    valueFormatter={(v, n) => (n.includes("force") ? `${fmtInt(v)} N` : `${fmt(v, 1)}%`)}
                  />
                }
              />
              <Legend content={<ChartLegend />} />
              <Bar yAxisId="l" dataKey="keLoss" name="KE dissipated" radius={[5, 5, 0, 0]} {...ANIM}>
                {data.map((_, i) => (
                  <Cell key={i} fill={DRONE_COLORS[i % DRONE_COLORS.length]} />
                ))}
              </Bar>
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="force"
                name="Peak impact force"
                stroke={th.dark ? "#f8fafc" : "#0f172a"}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, fill: th.dark ? "#0f172a" : "#fff" }}
                {...ANIM}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ============ Arena load (horizontal bars) ============ */

export function ArenaBars({ records }: { records: CollisionRecord[] }) {
  const th = useChartTheme();
  const data = useMemo(() => byArena(records), [records]);
  const hasData = records.length > 0;
  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader title="Arena utilisation" subtitle="Tests and anomalies by facility" />
      <div className="px-2 pb-3 pt-2" style={{ height: CHART_H + 40 }}>
        {!hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, bottom: 0, left: 8 }} barCategoryGap="28%">
              <CartesianGrid stroke={th.grid} horizontal={false} />
              <XAxis type="number" tick={th.tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="short" tick={th.tickStyle} axisLine={false} tickLine={false} width={64} />
              <Tooltip
                cursor={{ fill: th.cursor, opacity: 0.25 }}
                content={
                  <ChartTooltip
                    labelFormatter={(_l, items) => (items[0]?.payload as { name?: string })?.name ?? ""}
                    valueFormatter={(v, n) => (n.includes("force") ? `${fmtInt(v)} N` : fmtInt(v))}
                  />
                }
              />
              <Legend content={<ChartLegend />} />
              <Bar dataKey="tests" name="Tests" fill={PALETTE.blue} radius={[0, 5, 5, 0]} {...ANIM} />
              <Bar dataKey="anomalies" name="Anomalies" fill={PALETTE.rose} radius={[0, 5, 5, 0]} {...ANIM} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ============ Impact force trend (area) ============ */

export function ForceTrend({ points, granularity }: { points: TimePoint[]; granularity: Granularity }) {
  const th = useChartTheme();
  const hasData = points.some((d) => d.count > 0);
  const unitLabel = granularity === "hour" ? "hourly" : granularity === "day" ? "daily" : "weekly";
  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader title="Impact force trend" subtitle={`${unitLabel[0].toUpperCase()}${unitLabel.slice(1)} mean peak contact force`} />
      <div className="px-2 pb-3 pt-2" style={{ height: CHART_H + 40 }}>
        {!hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="forceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.amber} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={PALETTE.amber} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={th.grid} vertical={false} />
              <XAxis dataKey="key" tickFormatter={(v: string) => bucketLabel(v, granularity)} tick={th.tickStyle} axisLine={{ stroke: th.axisLine }} tickLine={false} minTickGap={28} />
              <YAxis tick={th.tickStyle} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmtCompact(v)} />
              <Tooltip
                cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
                content={<ChartTooltip labelFormatter={(l) => bucketLabel(String(l), granularity)} valueFormatter={(v) => `${fmtInt(v)} N`} />}
              />
              <Area type="monotone" dataKey="force" name="Peak force" stroke={PALETTE.amber} strokeWidth={2} fill="url(#forceFill)" connectNulls dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: th.dark ? "#0f172a" : "#fff" }} {...ANIM} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ============ Fleet phase space (scatter) ============ */

export function FleetPhaseSpace({ records }: { records: CollisionRecord[] }) {
  const th = useChartTheme();
  const groups = useMemo(() => {
    const g: Record<string, CollisionRecord[]> = {};
    for (const r of records) (g[r.type] ??= []).push(r);
    return Object.entries(g);
  }, [records]);
  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader title="Fleet impact phase space" subtitle="Closing velocity vs. dissipated energy · bubble = system momentum" />
      <div className="px-2 pb-3 pt-2" style={{ height: CHART_H + 40 }}>
        {!records.length ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={th.grid} />
              <XAxis type="number" dataKey="closingSpeed" name="Closing velocity" unit=" m/s" tick={th.tickStyle} axisLine={{ stroke: th.axisLine }} tickLine={false} label={{ value: "closing velocity (m/s)", position: "insideBottom", offset: -2, fontSize: 10, fill: th.muted }} />
              <YAxis type="number" dataKey="keLossPct" name="KE dissipated" unit="%" tick={th.tickStyle} axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
              <ZAxis type="number" dataKey="pBefore" range={[20, 160]} name="Momentum" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: th.cursor }}
                content={
                  <ChartTooltip
                    labelFormatter={(_l, items: TooltipItem[]) => {
                      const p = items[0]?.payload as CollisionRecord | undefined;
                      return p ? `${p.id} · ${p.droneA} → ${p.droneB}` : "";
                    }}
                    valueFormatter={(v, n) => (n.includes("Momentum") ? `${fmt(v, 2)} kg·m/s` : n.includes("KE") ? `${fmt(v, 1)}%` : `${fmt(v, 2)} m/s`)}
                  />
                }
              />
              <Legend content={<ChartLegend />} />
              {groups.map(([type, rs]) => (
                <Scatter key={type} name={type} data={rs} fill={TYPE_COLORS[type]} fillOpacity={0.7} {...ANIM} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ============ Velocity chart ============ */

export function VelocityChart({ points, granularity }: { points: TimePoint[]; granularity: Granularity }) {
  const th = useChartTheme();
  const hasData = points.some((d) => d.count > 0);
  const [mode, setMode] = useState<"restitution" | "perDrone">("restitution");
  const tickGap = points.length > 30 ? 4 : points.length > 14 ? 2 : 0;

  const restitutionSeries = [
    { key: "closing", name: "Closing velocity", color: PALETTE.cyan, unit: "m/s" },
    { key: "separation", name: "Separation velocity", color: PALETTE.amber, unit: "m/s" },
  ];
  const perDroneSeries = [
    { key: "absU1", name: "Drone A · |u| before", color: PALETTE.blue, unit: "m/s" },
    { key: "absU2", name: "Drone B · |u| before", color: PALETTE.violet, unit: "m/s" },
    { key: "absV1", name: "Drone A · |v| after", color: PALETTE.emerald, unit: "m/s", dashed: true },
    { key: "absV2", name: "Drone B · |v| after", color: PALETTE.rose, unit: "m/s", dashed: true },
  ];
  const series = mode === "restitution" ? restitutionSeries : perDroneSeries;

  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader
        title="Velocity"
        subtitle="Closing and separation speed define the recovered energy – e = v′sep / v′cl"
        action={
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "restitution", label: "Closing vs sep." },
              { value: "perDrone", label: "Per drone" },
            ]}
          />
        }
      />
      <div className="px-2 pb-3 pt-2" style={{ height: CHART_H + 40 }}>
        {!hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 46, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={th.grid} vertical={false} />
              <XAxis dataKey="key" tick={th.tickStyle} axisLine={{ stroke: th.axisLine }} tickLine={false} interval={tickGap} minTickGap={22} />
              <YAxis yAxisId="v" tick={th.tickStyle} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmt(v, 0)} unit=" m/s" />
              {mode === "restitution" && (
                <YAxis
                  yAxisId="e"
                  orientation="right"
                  tick={th.tickStyle}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  domain={[0, 1]}
                  tickFormatter={(v: number) => v.toFixed(1)}
                />
              )}
              <Tooltip
                cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
                content={
                  <ChartTooltip
                    labelFormatter={(l) => bucketLabel(String(l), granularity)}
                    valueFormatter={(v, n) => (n.startsWith("e =") ? v.toFixed(3) : `${fmt(v, 2)} m/s`)}
                  />
                }
              />
              <Legend content={<ChartLegend />} />
              {mode === "restitution" && (
                <Line
                  yAxisId="e"
                  type="monotone"
                  dataKey="restitution"
                  name="e = sep ÷ clos"
                  stroke={th.reference}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                  {...ANIM}
                />
              )}
              {series.map((s) => (
                <Line
                  key={s.key}
                  yAxisId="v"
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  unit={s.unit}
                  stroke={s.color}
                  strokeWidth={2.2}
                  strokeDasharray={"dashed" in s && s.dashed ? "5 4" : undefined}
                  dot={points.length <= 24 ? { r: 2.5, strokeWidth: 0, fill: s.color } : false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: th.dark ? "#0f172a" : "#fff" }}
                  connectNulls
                  {...ANIM}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
