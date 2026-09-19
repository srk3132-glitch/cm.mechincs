/**
 * 1-D two-body collision physics used by the Collision Lab.
 *
 * Drone A starts on the left moving toward drone B.  Contact is modelled as a
 * finite-duration impulse with a smooth-step velocity profile, which keeps the
 * total momentum exactly conserved at every instant while the kinetic energy
 * dips (stored as deformation energy) and only partially recovers, depending
 * on the coefficient of restitution.
 */

export interface CollisionInput {
  /** mass of drone A (kg) */
  m1: number;
  /** initial velocity of drone A (m/s, +x to the right) */
  u1: number;
  /** mass of drone B (kg) */
  m2: number;
  /** initial velocity of drone B (m/s) */
  u2: number;
  /** coefficient of restitution 0 (perfectly inelastic) … 1 (elastic) */
  e: number;
  /** duration of physical contact in milliseconds */
  contactMs: number;
}

export interface CollisionResult {
  collides: boolean;
  v1: number;
  v2: number;
  vCom: number;
  closingSpeed: number;
  separationSpeed: number;
  pBefore: number;
  pAfter: number;
  p1Before: number;
  p2Before: number;
  p1After: number;
  p2After: number;
  keBefore: number;
  keAfter: number;
  ke1Before: number;
  ke2Before: number;
  ke1After: number;
  ke2After: number;
  keLoss: number;
  keLossPct: number;
  /** impulse delivered to drone A (N·s) – equal and opposite on B */
  impulse: number;
  /** peak contact force (N) for the smooth-step profile */
  peakForce: number;
}

export type SimPhase = "approach" | "contact" | "separation";

export interface SimPoint {
  t: number;
  x1: number;
  x2: number;
  v1: number;
  v2: number;
  vCom: number;
  p1: number;
  p2: number;
  p: number;
  ke1: number;
  ke2: number;
  ke: number;
  /** energy currently stored in deformation or dissipated (J) */
  eStored: number;
  /** contact force magnitude (N) */
  f: number;
  /** clearance between the two bumper surfaces (m); negative once they overlap */
  gap: number;
  phase: SimPhase;
}

export interface Simulation {
  input: CollisionInput;
  result: CollisionResult;
  points: SimPoint[];
  tContact: number;
  tRelease: number;
  tEnd: number;
  r1: number;
  r2: number;
  xMin: number;
  xMax: number;
  vMax: number;
  sample: (t: number) => SimPoint;
}

export const T_APPROACH = 0.6; // seconds before first contact
export const T_AFTER = 0.9; // seconds after release

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function solveCollision(inp: CollisionInput): CollisionResult {
  const { m1, u1, m2, u2 } = inp;
  const e = clamp(inp.e, 0, 1);
  const M = m1 + m2;
  const pBefore = m1 * u1 + m2 * u2;
  const vCom = pBefore / M;
  const collides = u1 > u2;

  const v1 = collides ? (m1 * u1 + m2 * u2 + m2 * e * (u2 - u1)) / M : u1;
  const v2 = collides ? (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / M : u2;

  const ke1Before = 0.5 * m1 * u1 * u1;
  const ke2Before = 0.5 * m2 * u2 * u2;
  const ke1After = 0.5 * m1 * v1 * v1;
  const ke2After = 0.5 * m2 * v2 * v2;
  const keBefore = ke1Before + ke2Before;
  const keAfter = ke1After + ke2After;
  const keLoss = Math.max(0, keBefore - keAfter);
  const impulse = m1 * (v1 - u1);
  const tau = Math.max(inp.contactMs, 1) / 1000;

  return {
    collides,
    v1,
    v2,
    vCom,
    closingSpeed: Math.max(0, u1 - u2),
    separationSpeed: Math.max(0, v2 - v1),
    pBefore,
    pAfter: m1 * v1 + m2 * v2,
    p1Before: m1 * u1,
    p2Before: m2 * u2,
    p1After: m1 * v1,
    p2After: m2 * v2,
    keBefore,
    keAfter,
    ke1Before,
    ke2Before,
    ke1After,
    ke2After,
    keLoss,
    keLossPct: keBefore > 0 ? (keLoss / keBefore) * 100 : 0,
    impulse,
    peakForce: (Math.abs(impulse) * 1.5) / tau,
  };
}

/** visual radius of a drone from its mass (m) */
export function radiusFromMass(m: number) {
  return 0.16 * Math.cbrt(Math.max(m, 0.05)) + 0.08;
}

export function simulate(input: CollisionInput): Simulation {
  const result = solveCollision(input);
  const { m1, u1, m2, u2 } = input;
  const tau = Math.max(input.contactMs, 1) / 1000;
  const tc = T_APPROACH;
  const tr = tc + tau;
  const tEnd = tr + T_AFTER;
  const r1 = radiusFromMass(m1);
  const r2 = radiusFromMass(m2);
  const x10 = -r1 - u1 * tc;
  const x20 = r2 - u2 * tc;
  const dv1 = result.v1 - u1;
  const dv2 = result.v2 - u2;
  const collides = result.collides;

  // smooth-step progress, its integral and its derivative
  const s = (t: number) => {
    if (!collides || t <= tc) return 0;
    if (t >= tr) return 1;
    const q = (t - tc) / tau;
    return q * q * (3 - 2 * q);
  };
  const I = (t: number) => {
    if (!collides || t <= tc) return 0;
    if (t >= tr) return tau / 2 + (t - tr);
    const q = (t - tc) / tau;
    return tau * (q * q * q - (q * q * q * q) / 2);
  };
  const ds = (t: number) => {
    if (!collides || t <= tc || t >= tr) return 0;
    const q = (t - tc) / tau;
    return (6 * q * (1 - q)) / tau;
  };

  const sample = (t: number): SimPoint => {
    const st = s(t);
    const It = I(t);
    const v1 = u1 + dv1 * st;
    const v2 = u2 + dv2 * st;
    const x1 = x10 + u1 * t + dv1 * It;
    const x2 = x20 + u2 * t + dv2 * It;
    const p1 = m1 * v1;
    const p2 = m2 * v2;
    const ke1 = 0.5 * m1 * v1 * v1;
    const ke2 = 0.5 * m2 * v2 * v2;
    const phase: SimPhase = !collides || t < tc ? "approach" : t <= tr ? "contact" : "separation";
    return {
      t,
      x1,
      x2,
      v1,
      v2,
      vCom: result.vCom,
      p1,
      p2,
      p: p1 + p2,
      ke1,
      ke2,
      ke: ke1 + ke2,
      eStored: Math.max(0, result.keBefore - (ke1 + ke2)),
      f: Math.abs(m1 * dv1 * ds(t)),
      gap: x2 - r2 - (x1 + r1),
      phase,
    };
  };

  const times: number[] = [];
  const n1 = 30;
  const n2 = 60;
  const n3 = 45;
  for (let i = 0; i < n1; i++) times.push((tc * i) / n1);
  for (let i = 0; i <= n2; i++) times.push(tc + (tau * i) / n2);
  for (let i = 1; i <= n3; i++) times.push(tr + (T_AFTER * i) / n3);

  const points = times.map(sample);
  let xMin = Infinity;
  let xMax = -Infinity;
  let vMax = 0;
  for (const p of points) {
    xMin = Math.min(xMin, p.x1 - r1, p.x2 - r2);
    xMax = Math.max(xMax, p.x1 + r1, p.x2 + r2);
    vMax = Math.max(vMax, Math.abs(p.v1), Math.abs(p.v2));
  }

  return {
    input,
    result,
    points,
    tContact: tc,
    tRelease: tr,
    tEnd,
    r1,
    r2,
    xMin,
    xMax,
    vMax,
    sample,
  };
}

export interface LabPreset {
  name: string;
  description: string;
  input: CollisionInput;
}

/* ------------------------------------------------------------------ *
 * Solving the lab "forwards" (e → v) or "backwards" (v target → e)   *
 * ------------------------------------------------------------------ */

/** Which quantity the lab sliders drive. */
export type SolveMode = "e" | "v1" | "v2";

export interface LabConfig extends CollisionInput {
  mode: SolveMode;
  /** desired post-impact velocity of the selected drone (m/s) */
  target: number;
}

/**
 * Post-impact velocity of one drone as a function of e.  Because the impulse is
 * linear in e, the feasible range is simply the segment between the perfectly
 * inelastic result (e = 0, both drones move at v_com) and the elastic result.
 */
export function velocityRange(inp: CollisionInput, who: "v1" | "v2") {
  const { m1, u1, m2, u2 } = inp;
  const M = m1 + m2;
  const p = m1 * u1 + m2 * u2;
  const atE0 = p / M;
  const atE1 = who === "v1" ? (p + m2 * (u2 - u1)) / M : (p + m1 * (u1 - u2)) / M;
  return { min: Math.min(atE0, atE1), max: Math.max(atE0, atE1), atE0, atE1 };
}

/**
 * Restitution coefficient that produces a requested post-impact velocity.
 * Targets outside the physically reachable range are clamped to it, so the
 * caller can tell the user the value was limited.
 */
export function eFromTargetVelocity(inp: CollisionInput, who: "v1" | "v2", target: number) {
  const r = velocityRange(inp, who);
  const span = r.max - r.min;
  if (!solveCollision(inp).collides || span < 1e-9) return { e: 0, clamped: false };
  const clampedTarget = clamp(target, r.min, r.max);
  const e = who === "v1" ? (r.atE0 - clampedTarget) / span : (clampedTarget - r.atE0) / span;
  return { e: clamp(e, 0, 1), clamped: Math.abs(target - clampedTarget) > 1e-6 };
}

export interface ResolvedLab {
  input: CollisionInput;
  e: number;
  target: number;
  clamped: boolean;
}

/** Turns the editable lab state (which may drive e, v₁ or v₂) into a solvable input. */
export function resolveLabConfig(cfg: LabConfig): ResolvedLab {
  const { mode, target, ...input } = cfg;
  if (mode === "e") {
    const r = velocityRange(input, "v2");
    return { input, e: input.e, target: r.atE0 + input.e * (r.atE1 - r.atE0), clamped: false };
  }
  const who = mode;
  const { e, clamped } = eFromTargetVelocity(input, who, target);
  const solved = solveCollision({ ...input, e });
  return { input: { ...input, e }, e, target: solved[who], clamped };
}

export const LAB_PRESETS: LabPreset[] = [
  {
    name: "Head-on elastic",
    description: "Equal masses swap velocities",
    input: { m1: 1.5, u1: 8, m2: 1.5, u2: -8, e: 0.95, contactMs: 40 },
  },
  {
    name: "Docking (perfectly inelastic)",
    description: "Drones couple and move together",
    input: { m1: 1.2, u1: 6, m2: 2.4, u2: 1, e: 0, contactMs: 90 },
  },
  {
    name: "Heavy vs light",
    description: "Raptor S strikes a Wasp Mini",
    input: { m1: 3.5, u1: 10, m2: 0.5, u2: -4, e: 0.7, contactMs: 55 },
  },
  {
    name: "Rear-end tap",
    description: "Faster drone catches a slower one",
    input: { m1: 1.6, u1: 12, m2: 2.2, u2: 7, e: 0.5, contactMs: 60 },
  },
];
