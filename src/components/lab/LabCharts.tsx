import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Simulation, SimPoint } from "../../lib/physics";
import { fmt } from "../../lib/format";
import { Card, CardHeader } from "../ui";
import { ANIM, ChartTooltip, LegendRow, useChartTheme } from "../charts/common";
import { LAB_COLORS } from "./Track";

const H = 260;
const fmtT = (v: number) => `${fmt(v, 2)}s`;

interface TimeChartProps {
  sim: Simulation;
  t: number;
}

function useTimeAxis(sim: Simulation) {
  const th = useChartTheme();
  return {
    th,
    xAxis: (
      <XAxis
        type="number"
        dataKey="t"
        domain={[0, sim.tEnd]}
        tickFormatter={fmtT}
        tick={th.tickStyle}
        axisLine={{ stroke: th.axisLine }}
        tickLine={false}
        tickCount={7}
        allowDataOverflow
      />
    ),
  };
}

function ContactBand({ sim, t }: TimeChartProps) {
  const th = useChartTheme();
  return (
    <>
      {sim.result.collides && (
        <ReferenceArea
          x1={sim.tContact}
          x2={sim.tRelease}
          fill={LAB_COLORS.lost}
          fillOpacity={th.dark ? 0.12 : 0.08}
          strokeOpacity={0}
          label={{ value: "contact", position: "insideTop", fontSize: 10, fill: LAB_COLORS.lost }}
        />
      )}
      <ReferenceLine x={t} stroke={th.reference} strokeDasharray="3 3" strokeOpacity={0.7} />
    </>
  );
}

/* ============ Velocity ============ */

export const VelocityChart = memo(function VelocityChart({ sim, t }: TimeChartProps) {
  const { th, xAxis } = useTimeAxis(sim);
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Velocity vs. time"
        subtitle="Both drones and the centre-of-mass velocity (which never changes)"
        action={
          <LegendRow
            items={[
              { label: "Drone A", color: LAB_COLORS.a },
              { label: "Drone B", color: LAB_COLORS.b },
              { label: "CoM", color: LAB_COLORS.com, dashed: true },
            ]}
          />
        }
      />
      <div className="px-2 pb-3 pt-2" style={{ height: H }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sim.points} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={th.grid} vertical={false} />
            {xAxis}
            <YAxis tick={th.tickStyle} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${fmt(v, 1)}`} unit="" />
            <Tooltip
              cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
              content={<ChartTooltip labelFormatter={(l) => `t = ${fmt(Number(l) * 1000, 0)} ms`} valueFormatter={(v) => `${fmt(v, 2)} m/s`} />}
            />
            <ReferenceLine y={0} stroke={th.axisLine} />
            <ContactBand sim={sim} t={t} />
            <Line type="monotone" dataKey="vCom" name="Centre of mass" stroke={LAB_COLORS.com} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="v1" name="Drone A" stroke={LAB_COLORS.a} strokeWidth={2.4} dot={false} {...ANIM} />
            <Line type="monotone" dataKey="v2" name="Drone B" stroke={LAB_COLORS.b} strokeWidth={2.4} dot={false} {...ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

/* ============ Angular Velocity (Spin) ============ */

export const SpinChart = memo(function SpinChart({ sim, t }: TimeChartProps) {
  const { th, xAxis } = useTimeAxis(sim);
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Angular velocity (spin) vs. time"
        subtitle="Rotational spin exchange from torque and tangential friction"
        action={
          <LegendRow
            items={[
              { label: "Spin ω₁ (A)", color: LAB_COLORS.a },
              { label: "Spin ω₂ (B)", color: LAB_COLORS.b },
            ]}
          />
        }
      />
      <div className="px-2 pb-3 pt-2" style={{ height: H }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sim.points} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={th.grid} vertical={false} />
            {xAxis}
            <YAxis tick={th.tickStyle} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${fmt(v, 0)}`} />
            <Tooltip
              cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
              content={<ChartTooltip labelFormatter={(l) => `t = ${fmt(Number(l) * 1000, 0)} ms`} valueFormatter={(v) => `${fmt(v, 1)} rad/s`} />}
            />
            <ReferenceLine y={0} stroke={th.axisLine} />
            <ContactBand sim={sim} t={t} />
            <Line type="monotone" dataKey="w1" name="Spin ω₁ (A)" stroke={LAB_COLORS.a} strokeWidth={2.4} dot={false} {...ANIM} />
            <Line type="monotone" dataKey="w2" name="Spin ω₂ (B)" stroke={LAB_COLORS.b} strokeWidth={2.4} dot={false} {...ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

/* ============ Momentum ============ */

export const MomentumChart = memo(function MomentumChart({ sim, t }: TimeChartProps) {
  const { th, xAxis } = useTimeAxis(sim);
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Momentum vs. time"
        subtitle="Individual momenta exchange while the system total stays flat"
        action={
          <LegendRow
            items={[
              { label: "p₁ (A)", color: LAB_COLORS.a },
              { label: "p₂ (B)", color: LAB_COLORS.b },
              { label: "Σp system", color: LAB_COLORS.total },
            ]}
          />
        }
      />
      <div className="px-2 pb-3 pt-2" style={{ height: H }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sim.points} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={th.grid} vertical={false} />
            {xAxis}
            <YAxis tick={th.tickStyle} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${fmt(v, 1)}`} />
            <Tooltip
              cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
              content={<ChartTooltip labelFormatter={(l) => `t = ${fmt(Number(l) * 1000, 0)} ms`} valueFormatter={(v) => `${fmt(v, 3)} kg·m/s`} />}
            />
            <ReferenceLine y={0} stroke={th.axisLine} />
            <ContactBand sim={sim} t={t} />
            <Line type="monotone" dataKey="p" name="Σp system" stroke={LAB_COLORS.total} strokeWidth={3} dot={false} {...ANIM} />
            <Line type="monotone" dataKey="p1" name="p₁ (A)" stroke={LAB_COLORS.a} strokeWidth={2} dot={false} {...ANIM} />
            <Line type="monotone" dataKey="p2" name="p₂ (B)" stroke={LAB_COLORS.b} strokeWidth={2} dot={false} {...ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

/* ============ Kinetic energy ============ */

export const EnergyChart = memo(function EnergyChart({ sim, t }: TimeChartProps) {
  const { th, xAxis } = useTimeAxis(sim);
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Kinetic energy vs. time"
        subtitle="Linear and rotational energy convert and dissipate during impact"
        action={
          <LegendRow
            items={[
              { label: "Trans KE", color: LAB_COLORS.ke },
              { label: "Spin KE", color: LAB_COLORS.rot },
              { label: "Total E", color: LAB_COLORS.total },
              { label: "Stored / lost", color: LAB_COLORS.lost },
            ]}
          />
        }
      />
      <div className="px-2 pb-3 pt-2" style={{ height: H }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sim.points} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="lostFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LAB_COLORS.lost} stopOpacity={0.5} />
                <stop offset="100%" stopColor={LAB_COLORS.lost} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={th.grid} vertical={false} />
            {xAxis}
            <YAxis tick={th.tickStyle} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${fmt(v, 0)}`} />
            <Tooltip
              cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
              content={<ChartTooltip labelFormatter={(l) => `t = ${fmt(Number(l) * 1000, 0)} ms`} valueFormatter={(v) => `${fmt(v, 2)} J`} />}
            />
            <ContactBand sim={sim} t={t} />
            <Area type="monotone" dataKey="eStored" name="Stored / dissipated" stroke={LAB_COLORS.lost} strokeWidth={1.5} fill="url(#lostFill)" {...ANIM} />
            <Line type="monotone" dataKey="totalEnergy" name="Total E" stroke={LAB_COLORS.total} strokeWidth={2.6} dot={false} {...ANIM} />
            <Line type="monotone" dataKey="ke" name="Trans KE" stroke={LAB_COLORS.ke} strokeWidth={2} dot={false} {...ANIM} />
            <Line type="monotone" dataKey="keRot" name="Spin KE" stroke={LAB_COLORS.rot} strokeWidth={1.8} strokeDasharray="4 3" dot={false} {...ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

/* ============ Phase portrait ============ */

interface XY {
  x: number;
  y: number;
  t: number;
  who: string;
}

const dotShape =
  (r: number, stroke?: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (props: any) => <circle cx={props.cx} cy={props.cy} r={r} fill={props.fill} stroke={stroke} strokeWidth={stroke ? 2 : 0} />;

export const PhasePortrait = memo(function PhasePortrait({ sim, t }: TimeChartProps) {
  const th = useChartTheme();
  const { a, b } = useMemo(() => {
    const a: XY[] = sim.points.map((p) => ({ x: p.x1, y: p.v1, t: p.t, who: "Drone A" }));
    const b: XY[] = sim.points.map((p) => ({ x: p.x2, y: p.v2, t: p.t, who: "Drone B" }));
    return { a, b };
  }, [sim]);
  const now = sim.sample(t);
  const cur: XY[] = [
    { x: now.x1, y: now.v1, t, who: "Drone A" },
    { x: now.x2, y: now.v2, t, who: "Drone B" },
  ];
  const xPad = (sim.xMax - sim.xMin) * 0.05;
  const vPad = sim.vMax * 0.15 + 0.2;

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Phase portrait (x, v)"
        subtitle="State-space trajectory of each drone – the vertical jump is the impact"
        action={
          <LegendRow
            items={[
              { label: "Drone A", color: LAB_COLORS.a },
              { label: "Drone B", color: LAB_COLORS.b },
            ]}
          />
        }
      />
      <div className="px-2 pb-3 pt-2" style={{ height: H }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={th.grid} />
            <XAxis
              type="number"
              dataKey="x"
              name="position"
              domain={[Number((sim.xMin - xPad).toFixed(2)), Number((sim.xMax + xPad).toFixed(2))]}
              tick={th.tickStyle}
              axisLine={{ stroke: th.axisLine }}
              tickLine={false}
              tickFormatter={(v: number) => `${fmt(v, 1)}`}
              label={{ value: "position x (m)", position: "insideBottom", offset: -2, fontSize: 10, fill: th.muted }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="velocity"
              domain={[Number((-sim.vMax - vPad).toFixed(1)), Number((sim.vMax + vPad).toFixed(1))]}
              tick={th.tickStyle}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v: number) => `${fmt(v, 1)}`}
              label={{ value: "v (m/s)", angle: -90, position: "insideLeft", fontSize: 10, fill: th.muted }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: th.cursor }}
              content={
                <ChartTooltip
                  labelFormatter={(_l, items) => {
                    const p = items[0]?.payload as XY | undefined;
                    return p ? `${p.who} · t = ${fmt(p.t * 1000, 0)} ms` : "";
                  }}
                  valueFormatter={(v, n) => (n === "position" ? `${fmt(v, 2)} m` : `${fmt(v, 2)} m/s`)}
                />
              }
            />
            <ReferenceLine y={0} stroke={th.axisLine} />
            <ReferenceLine x={0} stroke={LAB_COLORS.lost} strokeDasharray="3 4" strokeOpacity={0.5} />
            <Scatter name="Drone A" data={a} fill={LAB_COLORS.a} line={{ stroke: LAB_COLORS.a, strokeWidth: 2 }} shape={dotShape(1.6)} {...ANIM} />
            <Scatter name="Drone B" data={b} fill={LAB_COLORS.b} line={{ stroke: LAB_COLORS.b, strokeWidth: 2 }} shape={dotShape(1.6)} {...ANIM} />
            <Scatter name="start" data={[a[0], b[0]]} fill={th.dark ? "#0f172a" : "#fff"} shape={dotShape(4, th.muted)} isAnimationActive={false} />
            <Scatter name="now" data={cur} fill={th.reference} shape={dotShape(5.5, th.dark ? "#0f172a" : "#fff")} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

/* ============ Position tracking ============ */

export const PositionChart = memo(function PositionChart({ sim, t }: TimeChartProps) {
  const { th, xAxis } = useTimeAxis(sim);
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Position tracking"
        subtitle="Where each drone is along the track – x = 0 is the contact plane"
        action={
          <LegendRow
            items={[
              { label: "Drone A x₁", color: LAB_COLORS.a },
              { label: "Drone B x₂", color: LAB_COLORS.b },
              { label: "Surface gap", color: LAB_COLORS.lost, dashed: true },
            ]}
          />
        }
      />
      <div className="px-2 pb-3 pt-2" style={{ height: H }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sim.points} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={th.grid} vertical={false} />
            {xAxis}
            <YAxis
              tick={th.tickStyle}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={[Number((sim.xMin - 0.2).toFixed(2)), Number((sim.xMax + 0.2).toFixed(2))]}
              tickFormatter={(v: number) => fmt(v, 1)}
            />
            <Tooltip
              cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }}
              content={<ChartTooltip labelFormatter={(l) => `t = ${fmt(Number(l) * 1000, 0)} ms`} valueFormatter={(v) => `${fmt(v, 2)} m`} />}
            />
            <ReferenceLine y={0} stroke={LAB_COLORS.lost} strokeDasharray="3 4" strokeOpacity={0.6} />
            <ContactBand sim={sim} t={t} />
            <Line type="monotone" dataKey="x1" name="Drone A x₁" stroke={LAB_COLORS.a} strokeWidth={2.4} dot={false} {...ANIM} />
            <Line type="monotone" dataKey="x2" name="Drone B x₂" stroke={LAB_COLORS.b} strokeWidth={2.4} dot={false} {...ANIM} />
            <Line
              type="monotone"
              dataKey="gap"
              name="Surface gap"
              stroke={LAB_COLORS.lost}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
              {...ANIM}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

/* ============ Contact force ============ */

export const ForceChart = memo(function ForceChart({ sim, t }: TimeChartProps) {
  const th = useChartTheme();
  const tau = sim.tRelease - sim.tContact;
  const lo = sim.tContact - tau * 0.35;
  const hi = sim.tRelease + tau * 0.35;
  const data = useMemo(() => {
    const pts: SimPoint[] = sim.points.filter((p) => p.t >= lo - 1e-9 && p.t <= hi + 1e-9);
    return [sim.sample(lo), ...pts, sim.sample(hi)];
  }, [sim, lo, hi]);
  return (
    <Card className="flex flex-col">
      <CardHeader title="Contact force" subtitle={`Zoomed to the ${fmt(tau * 1000, 0)} ms contact window · peak ${fmt(sim.result.peakForce, 0)} N`} />
      <div className="px-2 pb-3 pt-2" style={{ height: 220 }}>
        {!sim.result.collides ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">No contact – drones never meet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="forceLab" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LAB_COLORS.lost} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={LAB_COLORS.lost} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={th.grid} vertical={false} />
              <XAxis type="number" dataKey="t" domain={[lo, hi]} tickFormatter={(v: number) => `${fmt(v * 1000, 0)}`} tick={th.tickStyle} axisLine={{ stroke: th.axisLine }} tickLine={false} tickCount={6} unit=" ms" allowDataOverflow />
              <YAxis tick={th.tickStyle} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${fmt(v, 0)}`} />
              <Tooltip cursor={{ stroke: th.cursor, strokeDasharray: "4 4" }} content={<ChartTooltip labelFormatter={(l) => `t = ${fmt(Number(l) * 1000, 1)} ms`} valueFormatter={(v) => `${fmt(v, 1)} N`} />} />
              {t >= lo && t <= hi && <ReferenceLine x={t} stroke={th.reference} strokeDasharray="3 3" strokeOpacity={0.7} />}
              <Area type="monotone" dataKey="f" name="Contact force" stroke={LAB_COLORS.lost} strokeWidth={2} fill="url(#forceLab)" dot={false} {...ANIM} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
});
