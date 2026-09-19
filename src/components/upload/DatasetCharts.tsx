import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dataset, SignalGroup } from "../../lib/parsers/dataset";
import { unitFor } from "../../lib/parsers/dataset";
import { fmt, fmtInt } from "../../lib/format";
import { Card, CardHeader, EmptyChartPlaceholder } from "../ui";
import { ANIM, ChartLegend, ChartTooltip, LegendRow, PALETTE, useChartTheme } from "../charts/common";

const SERIES_COLORS = [PALETTE.blue, PALETTE.amber, PALETTE.violet, PALETTE.emerald, PALETTE.rose, PALETTE.cyan, PALETTE.lime, PALETTE.pink];

const H = 280;

interface Props {
  dataset: Dataset;
  selected: string[];
  xColumn: string;
}

const GROUP_META: Record<SignalGroup, { title: string; color: string; group?: string }> = {
  time: { title: "Time", color: PALETTE.slate, group: "Time" },
  velocity: { title: "Velocity", color: PALETTE.cyan, group: "Velocity" },
  momentum: { title: "Momentum", color: PALETTE.violet, group: "Momentum" },
  energy: { title: "Kinetic energy", color: PALETTE.emerald, group: "Kinetic energy" },
  force: { title: "Contact force", color: PALETTE.rose, group: "Contact force" },
  position: { title: "Position", color: PALETTE.blue, group: "Position" },
  other: { title: "Other signals", color: PALETTE.slate, group: "Signal" },
};

function SeriesChart({
  dataset,
  columns,
  xColumn,
  title,
  subtitle,
  area,
}: {
  dataset: Dataset;
  columns: string[];
  xColumn: string;
  title: string;
  subtitle: string;
  area?: boolean;
}) {
  const th = useChartTheme();
  const data = dataset.rows;
  const unit = unitFor(columns[0] ?? "");
  const showDots = data.length <= 60;
  const xUnit = dataset.xUnit;
  const Comp: typeof ComposedChart = area ? AreaChart : ComposedChart;

  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <LegendRow
            items={columns.slice(0, 6).map((c, i) => ({
              label: c,
              color: SERIES_COLORS[columns.indexOf(c) % SERIES_COLORS.length] ?? SERIES_COLORS[i],
            }))}
          />
        }
      />
      <div className="px-2 pb-3 pt-2" style={{ height: H }}>
        {!columns.length ? (
          <EmptyChartPlaceholder message="No columns assigned to this chart" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Comp data={data} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
              <defs>
                {columns.map((c, i) => (
                  <linearGradient key={c} id={`fill-${c}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke={th.grid} vertical={false} />
              <XAxis
                dataKey={xColumn}
                type="number"
                domain={["dataMin", "dataMax"]}
                tick={th.tickStyle}
                axisLine={{ stroke: th.axisLine }}
                tickLine={false}
                tickFormatter={(v: number) => fmt(v, 2)}
                minTickGap={28}
              />
              <YAxis
                tick={th.tickStyle}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => fmt(v, 2)}
              />
              <ReferenceLine y={0} stroke={th.axisLine} />
              <Tooltip
                cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
                content={
                  <ChartTooltip
                    labelFormatter={(l) => `${dataset.xColumn} = ${fmt(Number(l), 3)} ${xUnit}`}
                    valueFormatter={(v) => `${fmt(v, 3)} ${unit}`}
                  />
                }
              />
              {columns.map((c, i) =>
                area ? (
                  <Area
                    key={c}
                    type="monotone"
                    dataKey={c}
                    name={c}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2.2}
                    fill={`url(#fill-${c})`}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: th.dark ? "#0f172a" : "#fff" }}
                    {...ANIM}
                  />
                ) : (
                  <Line
                    key={c}
                    type="monotone"
                    dataKey={c}
                    name={c}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2.2}
                    dot={showDots ? { r: 2.5, strokeWidth: 0, fill: SERIES_COLORS[i % SERIES_COLORS.length] } : false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: th.dark ? "#0f172a" : "#fff" }}
                    connectNulls
                    {...ANIM}
                  />
                ),
              )}
            </Comp>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/** Energy split donut – built from whatever energy columns the file contains. */
export function DatasetEnergyDonut({ dataset }: { dataset: Dataset }) {
  const data = useMemo(() => {
    const cols = dataset.groups.energy.length ? dataset.groups.energy : dataset.numericColumns.slice(0, 3);
    return cols.slice(0, 4).map((c) => ({
      name: c,
      value: dataset.rows.reduce((a, r) => a + (Number.isFinite(r[c]) ? Math.abs(r[c]) : 0), 0),
    }));
  }, [dataset]);

  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader title="Cumulative magnitude" subtitle="Summed |value| per uploaded signal" />
      <div className="px-2 pb-3 pt-2" style={{ height: 300 }}>
        {data.every((d) => d.value === 0) ? (
          <EmptyChartPlaceholder />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTooltip hideLabel valueFormatter={(v) => fmt(v, 2)} />} />
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="80%" paddingAngle={2} cornerRadius={4} stroke="none" {...ANIM}>
                {data.map((d, i) => (
                  <Cell key={d.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                ))}
              </Pie>
              <LegendRow items={data.map((d, i) => ({ label: d.name, color: SERIES_COLORS[i % SERIES_COLORS.length] }))} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/** Distribution of a chosen signal. */
export function DatasetHistogram({ dataset, column, bins = 14 }: { dataset: Dataset; column: string; bins?: number }) {
  const th = useChartTheme();
  const data = useMemo(() => {
    const vals = dataset.rows.map((r) => r[column]).filter(Number.isFinite);
    if (!vals.length) return [];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const step = (max - min) / bins || 1;
    const out = Array.from({ length: bins }, (_, i) => ({
      bin: min + step * (i + 0.5),
      label: `${fmt(min + step * i, 1)}`,
      count: 0,
    }));
    for (const v of vals) {
      const idx = Math.min(bins - 1, Math.floor((v - min) / step));
      if (out[idx]) out[idx].count += 1;
    }
    return out;
  }, [dataset, column, bins]);
  const unit = unitFor(column);

  return (
    <Card className="flex flex-col animate-fade-up">
      <CardHeader title={`${column} distribution`} subtitle={`${bins} bins over ${dataset.rows.length.toLocaleString()} samples`} />
      <div className="px-2 pb-3 pt-2" style={{ height: 260 }}>
        {!data.length ? (
          <EmptyChartPlaceholder />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }} barCategoryGap="12%">
              <CartesianGrid stroke={th.grid} vertical={false} />
              <XAxis dataKey="label" tick={th.tickStyle} axisLine={{ stroke: th.axisLine }} tickLine={false} minTickGap={16} />
              <YAxis tick={th.tickStyle} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: th.cursor, opacity: 0.25 }}
                content={
                  <ChartTooltip
                    labelFormatter={(l) => `≈ ${l} ${unit}`}
                    valueFormatter={(v) => `${fmtInt(v)} samples`}
                  />
                }
              />
              <Bar dataKey="count" name="Samples" radius={[4, 4, 0, 0]} {...ANIM}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE.blue} opacity={0.45 + 0.55 * (i / Math.max(1, data.length - 1))} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/**
 * Renders one chart per detected signal group (velocity, momentum, energy,
 * force, …) so the uploaded file drives the whole layout.
 */
export function DatasetCharts({ dataset, selected, xColumn }: Props) {
  const byGroup = (g: SignalGroup) => dataset.groups[g].filter((c) => selected.includes(c) && c !== xColumn);
  const velocity = byGroup("velocity");
  const momentum = byGroup("momentum");
  const energy = byGroup("energy");
  const force = byGroup("force");
  const position = byGroup("position");
  const other = byGroup("other").concat(byGroup("time").filter((c) => c !== xColumn));

  const groups: { cols: string[]; title: string; subtitle: string; area?: boolean }[] = [
    { cols: velocity, title: "Velocity", subtitle: `Velocity signals against ${xColumn}`, area: true },
    { cols: momentum, title: "Momentum", subtitle: `Momentum signals against ${xColumn}` },
    { cols: energy, title: "Kinetic energy", subtitle: `Energy signals against ${xColumn}`, area: true },
    { cols: force, title: "Impact force", subtitle: `Contact force signals against ${xColumn}`, area: true },
    { cols: position, title: "Position", subtitle: `Position signals against ${xColumn}` },
    { cols: other, title: "Other signals", subtitle: `Remaining numeric columns against ${xColumn}` },
  ].filter((g) => g.cols.length > 0);

  if (!groups.length) {
    return (
      <Card className="animate-fade-up">
        <div className="p-6">
          <EmptyChartPlaceholder message="Select at least one signal in the column list to draw charts." />
        </div>
      </Card>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <SeriesChart key={g.title} dataset={dataset} columns={g.cols} xColumn={xColumn} title={g.title} subtitle={g.subtitle} area={g.area} />
      ))}
    </>
  );
}

export { GROUP_META, SERIES_COLORS, ChartLegend };
