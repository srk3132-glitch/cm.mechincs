import type { CollisionRecord, CollisionType, Status } from "../data/generateData";
import { COLLISION_TYPES, STATUSES, DRONE_MODELS, ARENAS } from "../data/generateData";
import { addDays, dayDiff, fromISODate, toISODate, startOfDay } from "./format";

export type RangePreset = "1d" | "7d" | "30d" | "90d" | "all" | "custom";

export interface Filters {
  preset: RangePreset;
  from: string;
  to: string;
  type: "All" | CollisionType;
  drone: "All" | string;
  arena: "All" | string;
  status: "All" | Status;
}

export const RANGE_PRESETS: { key: RangePreset; label: string; title: string; days?: number }[] = [
  { key: "1d", label: "1D", title: "Last 24 hours", days: 1 },
  { key: "7d", label: "7D", title: "Last 7 days", days: 7 },
  { key: "30d", label: "30D", title: "Last 30 days", days: 30 },
  { key: "90d", label: "90D", title: "Last 90 days", days: 90 },
  { key: "all", label: "All", title: "Whole campaign" },
];

export function rangeForPreset(preset: RangePreset, minDate: string, current: Filters): { from: string; to: string } {
  const today = startOfDay(new Date());
  const to = toISODate(today);
  const p = RANGE_PRESETS.find((r) => r.key === preset);
  if (preset === "all") return { from: minDate, to };
  if (p?.days) return { from: toISODate(addDays(today, -(p.days - 1))), to };
  return { from: current.from, to: current.to };
}

export function defaultFilters(minDate: string): Filters {
  const base: Filters = {
    preset: "30d",
    from: minDate,
    to: toISODate(new Date()),
    type: "All",
    drone: "All",
    arena: "All",
    status: "All",
  };
  return { ...base, ...rangeForPreset("30d", minDate, base) };
}

export function previousRange(from: string, to: string) {
  const f = fromISODate(from);
  const t = fromISODate(to);
  const len = dayDiff(f, t) + 1;
  return { from: toISODate(addDays(f, -len)), to: toISODate(addDays(f, -1)) };
}

export function applySegmentFilters(records: CollisionRecord[], f: Filters) {
  return records.filter(
    (r) =>
      (f.type === "All" || r.type === f.type) &&
      (f.drone === "All" || r.droneA === f.drone || r.droneB === f.drone) &&
      (f.arena === "All" || r.arena === f.arena) &&
      (f.status === "All" || r.status === f.status),
  );
}

export function applyDateRange(records: CollisionRecord[], from: string, to: string) {
  return records.filter((r) => r.date >= from && r.date <= to);
}

export function applyFilters(records: CollisionRecord[], f: Filters) {
  return applyDateRange(applySegmentFilters(records, f), f.from, f.to);
}

/* ---------------- KPIs ---------------- */

export interface Kpis {
  count: number;
  avgClosing: number;
  avgMomentum: number;
  avgKeRetained: number;
  avgPeakForce: number;
  anomalyRate: number;
  avgPError: number;
  totalEnergyDissipated: number;
}

const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);

export function computeKpis(records: CollisionRecord[]): Kpis {
  return {
    count: records.length,
    avgClosing: mean(records.map((r) => r.closingSpeed)),
    avgMomentum: mean(records.map((r) => Math.abs(r.pBefore))),
    avgKeRetained: mean(records.map((r) => 100 - r.keLossPct)),
    avgPeakForce: mean(records.map((r) => r.peakForce)),
    anomalyRate: records.length ? (records.filter((r) => r.status === "Anomaly").length / records.length) * 100 : NaN,
    avgPError: mean(records.map((r) => Math.abs(r.pError))),
    totalEnergyDissipated: records.reduce((a, r) => a + r.keLoss, 0),
  };
}

export function pctChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return NaN;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/* ---------------- granularity ---------------- */

export type Granularity = "hour" | "day" | "week";

export function granularityFor(from: string, to: string): Granularity {
  const span = dayDiff(fromISODate(from), fromISODate(to)) + 1;
  if (span <= 1) return "hour";
  if (span <= 21) return "day";
  return "week";
}

/* ---------------- unified time series ---------------- */

export interface TimePoint {
  key: string;
  label: string;
  ts: number;
  count: number;
  momentum: number | null;
  keBefore: number | null;
  keAfter: number | null;
  keRetained: number | null;
  closing: number | null;
  separation: number | null;
  restitution: number | null;
  force: number | null;
  pError: number | null;
  anomalies: number;
  absU1: number | null;
  absU2: number | null;
  absV1: number | null;
  absV2: number | null;
}

const pointFrom = (records: CollisionRecord[], key: string, label: string, ts: number): TimePoint => {
  const m = (fn: (r: CollisionRecord) => number) => (records.length ? mean(records.map(fn)) : null);
  const closing = m((r) => r.closingSpeed);
  const separation = m((r) => r.separationSpeed);
  return {
    key,
    label,
    ts,
    count: records.length,
    momentum: m((r) => Math.abs(r.pBefore)),
    keBefore: m((r) => r.keBefore),
    keAfter: m((r) => r.keAfter),
    keRetained: m((r) => 100 - r.keLossPct),
    closing,
    separation,
    restitution: closing && closing > 0 && separation !== null ? separation / closing : null,
    force: m((r) => r.peakForce),
    pError: m((r) => Math.abs(r.pError)),
    anomalies: records.filter((r) => r.status === "Anomaly").length,
    absU1: m((r) => Math.abs(r.uA)),
    absU2: m((r) => Math.abs(r.uB)),
    absV1: m((r) => Math.abs(r.vA)),
    absV2: m((r) => Math.abs(r.vB)),
  };
};

/**
 * Time series that adapts to the selected range: hourly for a single day,
 * daily up to three weeks, weekly beyond that.
 */
export function timeSeries(records: CollisionRecord[], from: string, to: string) {
  const g = granularityFor(from, to);
  const points: TimePoint[] = [];
  const f = fromISODate(from);
  const t = fromISODate(to);

  if (g === "hour") {
    const groups = new Map<number, CollisionRecord[]>();
    for (const r of records) {
      const h = new Date(r.timestamp).getHours();
      const arr = groups.get(h);
      if (arr) arr.push(r);
      else groups.set(h, [r]);
    }
    for (let h = 0; h < 24; h++) {
      const ts = new Date(f.getFullYear(), f.getMonth(), f.getDate(), h).getTime();
      const label = `${String(h).padStart(2, "0")}:00`;
      points.push(pointFrom(groups.get(h) ?? [], `${from}T${String(h).padStart(2, "0")}`, label, ts));
    }
  } else {
    const byDay = new Map<string, CollisionRecord[]>();
    for (const r of records) {
      const arr = byDay.get(r.date);
      if (arr) arr.push(r);
      else byDay.set(r.date, [r]);
    }
    const bucketOf = (d: Date) => {
      if (g === "day") return { start: startOfDay(d), step: 1 };
      const c = startOfDay(d);
      const dow = (c.getDay() + 6) % 7; // Monday = 0
      return { start: addDays(c, -dow), step: 7 };
    };
    const first = bucketOf(f).start;
    for (let d = first; d <= t; d = addDays(d, g === "day" ? 1 : 7)) {
      const rs: CollisionRecord[] = [];
      for (let k = 0; k < (g === "day" ? 1 : 7); k++) {
        const chunk = byDay.get(toISODate(addDays(d, k)));
        if (chunk) rs.push(...chunk);
      }
      const label =
        g === "day"
          ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      points.push(pointFrom(rs, toISODate(d), label, d.getTime()));
    }
  }
  return { granularity: g, points };
}

/* ---------------- bucketed counts by regime ---------------- */

export interface BucketPoint {
  key: string;
  label: string;
  ts: number;
  Elastic: number;
  "Partially Inelastic": number;
  "Perfectly Inelastic": number;
  total: number;
}

export function bucketSeries(records: CollisionRecord[], from: string, to: string) {
  const g = granularityFor(from, to);
  const points: BucketPoint[] = [];
  const f = fromISODate(from);
  const t = fromISODate(to);

  const blank = (key: string, label: string, ts: number): BucketPoint => ({
    key,
    label,
    ts,
    Elastic: 0,
    "Partially Inelastic": 0,
    "Perfectly Inelastic": 0,
    total: 0,
  });

  if (g === "hour") {
    for (let h = 0; h < 24; h++) {
      points.push(blank(`${from}T${String(h).padStart(2, "0")}`, `${String(h).padStart(2, "0")}:00`, new Date(f.getFullYear(), f.getMonth(), f.getDate(), h).getTime()));
    }
  } else {
    for (let d = g === "day" ? f : addDays(f, -((f.getDay() + 6) % 7)); d <= t; d = addDays(d, g === "day" ? 1 : 7)) {
      points.push(blank(toISODate(d), d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), d.getTime()));
    }
  }

  const byKey = new Map(points.map((p) => [p.key, p]));
  for (const r of records) {
    const d = new Date(r.timestamp);
    const key =
      g === "hour"
        ? `${r.date}T${String(d.getHours()).padStart(2, "0")}`
        : g === "day"
          ? r.date
          : toISODate(addDays(startOfDay(d), -((d.getDay() + 6) % 7)));
    const b = byKey.get(key);
    if (b) {
      b[r.type] += 1;
      b.total += 1;
    }
  }
  return { granularity: g, points };
}

/* ---------------- distributions & breakdowns ---------------- */

export interface NamedValue {
  name: string;
  value: number;
}

export function typeDistribution(records: CollisionRecord[]): NamedValue[] {
  return COLLISION_TYPES.map((t) => ({ name: t, value: records.filter((r) => r.type === t).length }));
}

export function statusDistribution(records: CollisionRecord[]): NamedValue[] {
  return STATUSES.map((s) => ({ name: s, value: records.filter((r) => r.status === s).length }));
}

export function energyBudget(records: CollisionRecord[]): NamedValue[] {
  let a = 0;
  let b = 0;
  let lost = 0;
  for (const r of records) {
    a += 0.5 * r.massA * r.vA * r.vA;
    b += 0.5 * r.massB * r.vB * r.vB;
    lost += r.keLoss;
  }
  return [
    { name: "Drone A KE", value: a },
    { name: "Drone B KE", value: b },
    { name: "Dissipated", value: lost },
  ];
}

export interface DroneStat {
  name: string;
  short: string;
  tests: number;
  keLoss: number;
  force: number;
  closing: number;
}

export function byDroneModel(records: CollisionRecord[]): DroneStat[] {
  return DRONE_MODELS.map((m) => {
    const rs = records.filter((r) => r.droneA === m.name || r.droneB === m.name);
    return {
      name: m.name,
      short: m.short,
      tests: rs.length,
      keLoss: rs.length ? mean(rs.map((r) => r.keLossPct)) : 0,
      force: rs.length ? mean(rs.map((r) => r.peakForce)) : 0,
      closing: rs.length ? mean(rs.map((r) => r.closingSpeed)) : 0,
    };
  });
}

export interface ArenaStat {
  name: string;
  short: string;
  tests: number;
  force: number;
  anomalies: number;
}

export function byArena(records: CollisionRecord[]): ArenaStat[] {
  return ARENAS.map((a) => {
    const rs = records.filter((r) => r.arena === a);
    return {
      name: a,
      short: a.split(" · ")[0],
      tests: rs.length,
      force: rs.length ? mean(rs.map((r) => r.peakForce)) : 0,
      anomalies: rs.filter((r) => r.status === "Anomaly").length,
    };
  });
}
