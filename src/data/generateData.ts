import { solveCollision } from "../lib/physics";
import { toISODate, startOfDay, addDays } from "../lib/format";

export type CollisionType = "Elastic" | "Partially Inelastic" | "Perfectly Inelastic";
export type Status = "Nominal" | "Warning" | "Anomaly";

export interface DroneModel {
  name: string;
  massRange: [number, number];
  short: string;
}

export const DRONE_MODELS: DroneModel[] = [
  { name: "Wasp Mini", short: "WSP", massRange: [0.45, 0.6] },
  { name: "Kestrel V", short: "KST", massRange: [0.9, 1.2] },
  { name: "Hornet Mk3", short: "HRN", massRange: [1.4, 1.7] },
  { name: "Falcon X2", short: "FLC", massRange: [2.0, 2.4] },
  { name: "Raptor S", short: "RPT", massRange: [3.2, 3.8] },
];

export const ARENAS = ["Arena A · Indoor", "Arena B · Wind Tunnel", "Field C · Outdoor"];
export const COLLISION_TYPES: CollisionType[] = ["Elastic", "Partially Inelastic", "Perfectly Inelastic"];
export const STATUSES: Status[] = ["Nominal", "Warning", "Anomaly"];
export const OPERATORS = ["A. Okafor", "M. Lindqvist", "S. Tanaka", "R. Alvarez", "J. Whitfield"];

export interface CollisionRecord {
  id: string;
  timestamp: number;
  date: string;
  droneA: string;
  droneB: string;
  arena: string;
  operator: string;
  type: CollisionType;
  massA: number;
  massB: number;
  uA: number;
  uB: number;
  vA: number;
  vB: number;
  e: number;
  closingSpeed: number;
  separationSpeed: number;
  pBefore: number;
  pAfter: number;
  /** measured momentum deviation after impact (%) */
  pError: number;
  keBefore: number;
  keAfter: number;
  keLoss: number;
  keLossPct: number;
  impulse: number;
  peakForce: number;
  contactMs: number;
  status: Status;
}

/* ---------- seeded random helpers ---------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const makeRng = (seed: number) => {
  const rnd = mulberry32(seed);
  const range = (lo: number, hi: number) => lo + (hi - lo) * rnd();
  const int = (lo: number, hi: number) => Math.floor(range(lo, hi + 1));
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const normal = () => {
    const u = 1 - rnd();
    const v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const weighted = <T,>(items: readonly T[], weights: readonly number[]) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rnd() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };
  return { rnd, range, int, pick, normal, weighted };
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Generates a realistic test log spanning the last `days` days.
 * Deterministic for a given seed so the dashboard is stable between renders.
 */
export function generateRecords(days = 120, seed = 20240917): CollisionRecord[] {
  const R = makeRng(seed);
  const today = startOfDay(new Date());
  const records: CollisionRecord[] = [];
  let seq = 1000;

  for (let d = days - 1; d >= 0; d--) {
    const day = addDays(today, -d);
    const dow = day.getDay();
    const progress = 1 - d / days; // 0 → oldest, 1 → today
    const weekend = dow === 0 || dow === 6;

    // campaign intensity slowly oscillates so weekly bars feel alive
    const intensity = 1 + 0.45 * Math.sin((progress * Math.PI * 2 * days) / 28);
    const base = weekend ? 0.7 : 3.2;
    const n = Math.max(0, Math.round(base * intensity + R.normal() * 0.9));

    for (let k = 0; k < n; k++) {
      const modelA = R.pick(DRONE_MODELS);
      const modelB = R.pick(DRONE_MODELS);
      const massA = round(R.range(modelA.massRange[0], modelA.massRange[1]), 2);
      const massB = round(R.range(modelB.massRange[0], modelB.massRange[1]), 2);

      const type = R.weighted(COLLISION_TYPES, [40, 42, 18]);
      // bumper programme improves elasticity over the campaign
      const e =
        type === "Elastic"
          ? round(R.range(0.8 + 0.05 * progress, 0.97), 3)
          : type === "Partially Inelastic"
            ? round(R.range(0.32, 0.72), 3)
            : round(R.range(0, 0.06), 3);

      const arena = R.weighted(ARENAS, [50, 30, 20]);
      const arenaBoost = arena === ARENAS[2] ? 1.3 : arena === ARENAS[1] ? 1.1 : 1;
      const uA = round(R.range(3, 13) * arenaBoost, 2);
      const uB = round(R.range(-11, 2) * arenaBoost, 2);
      const contactMs = Math.round(R.range(18, 95) * (1 - 0.25 * e));

      const res = solveCollision({ m1: massA, u1: uA, m2: massB, u2: uB, e, contactMs });

      // measurement error on the post-impact momentum (sensor noise + anomalies)
      const anomalyP = 0.1 - 0.06 * progress;
      const r = R.rnd();
      const err =
        r < anomalyP
          ? (R.rnd() < 0.5 ? -1 : 1) * R.range(3.2, 8.5)
          : r < anomalyP + 0.14
            ? (R.rnd() < 0.5 ? -1 : 1) * R.range(1.5, 3)
            : R.normal() * 0.55;
      const pError = round(err, 2);
      const pAfter = round(res.pBefore * (1 + pError / 100), 3);
      const status: Status = Math.abs(pError) < 1.5 ? "Nominal" : Math.abs(pError) < 3 ? "Warning" : "Anomaly";

      const hour = R.int(8, 17);
      const minute = R.int(0, 59);
      const ts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute).getTime();

      records.push({
        id: `CT-${seq++}`,
        timestamp: ts,
        date: toISODate(day),
        droneA: modelA.name,
        droneB: modelB.name,
        arena,
        operator: R.pick(OPERATORS),
        type,
        massA,
        massB,
        uA,
        uB,
        vA: round(res.v1, 2),
        vB: round(res.v2, 2),
        e,
        closingSpeed: round(res.closingSpeed, 2),
        separationSpeed: round(res.separationSpeed, 2),
        pBefore: round(res.pBefore, 3),
        pAfter,
        pError,
        keBefore: round(res.keBefore, 2),
        keAfter: round(res.keAfter, 2),
        keLoss: round(res.keLoss, 2),
        keLossPct: round(res.keLossPct, 1),
        impulse: round(res.impulse, 3),
        peakForce: round(res.peakForce, 1),
        contactMs,
        status,
      });
    }
  }

  return records.sort((a, b) => a.timestamp - b.timestamp);
}
