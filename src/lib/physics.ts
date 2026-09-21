/**
 * Two-body collision physics used by the Collision Lab.
 *
 * Drone A starts on the left moving toward drone B. Contact is modelled as a
 * finite-duration impulse with a smooth-step velocity profile, which keeps
 * momentum and rotational dynamics conserved while kinetic energy undergoes
 * deformation and dissipation according to bumper restitution.
 *
 * Now expanded with:
 * - Collision radii (r1, r2)
 * - Spin inertia (I1, I2) and angular velocity (w1, w2)
 * - Impact eccentricity / offset and torque/spin exchange
 * - Material restitution breakdown (e1, e2) -> effective e
 * - Configurable observation time window (tTotal)
 */

export interface CollisionInput {
  /** mass of drone A (kg) */
  m1: number;
  /** initial linear velocity of drone A (m/s, +x to the right) */
  u1: number;
  /** mass of drone B (kg) */
  m2: number;
  /** initial linear velocity of drone B (m/s) */
  u2: number;
  /** effective coefficient of restitution 0 (perfectly inelastic) … 1 (elastic) */
  e: number;
  /** duration of physical contact in milliseconds */
  contactMs: number;

  /** collision radius of drone A (m) */
  r1?: number;
  /** collision radius of drone B (m) */
  r2?: number;
  /** spin moment of inertia for drone A (kg·m²) */
  i1?: number;
  /** spin moment of inertia for drone B (kg·m²) */
  i2?: number;
  /** initial angular velocity of drone A (rad/s, + counter-clockwise) */
  w1?: number;
  /** initial angular velocity of drone B (rad/s) */
  w2?: number;
  /** drone A bumper restitution (0 … 1) */
  e1?: number;
  /** drone B bumper restitution (0 … 1) */
  e2?: number;
  /** impact vertical contact offset / arm from centerline (m) */
  impactOffset?: number;
  /** total observation time window (s) */
  tTotal?: number;
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

  // Rotational & Geometry extensions
  r1: number;
  r2: number;
  i1: number;
  i2: number;
  w1Before: number;
  w1After: number;
  w2Before: number;
  w2After: number;
  lBefore: number;
  lAfter: number;
  l1Before: number;
  l1After: number;
  l2Before: number;
  l2After: number;
  keRot1Before: number;
  keRot2Before: number;
  keRot1After: number;
  keRot2After: number;
  keRotBefore: number;
  keRotAfter: number;
  totalEnergyBefore: number;
  totalEnergyAfter: number;
  torqueImpulse: number;
  e1: number;
  e2: number;
  eEffective: number;
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

  // Rotational properties
  w1: number;
  w2: number;
  theta1: number;
  theta2: number;
  l1: number;
  l2: number;
  l: number;
  keRot1: number;
  keRot2: number;
  keRot: number;
  totalEnergy: number;
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
  wMax: number;
  sample: (t: number) => SimPoint;
}

export const T_APPROACH = 0.6; // seconds before first contact
export const T_AFTER = 0.9; // seconds after release

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Standard visual radius of a drone from its mass (m) */
export function radiusFromMass(m: number): number {
  return Math.round((0.16 * Math.cbrt(Math.max(m, 0.05)) + 0.08) * 100) / 100;
}

/** Default moment of inertia for a quadcopter disk/arms model: I ≈ 0.45 * m * r² (kg·m²) */
export function inertiaFromMassAndRadius(m: number, r: number): number {
  return Math.round(0.45 * Math.max(m, 0.05) * r * r * 1000) / 1000;
}

export function solveCollision(inp: CollisionInput): CollisionResult {
  const { m1, u1, m2, u2 } = inp;
  const r1 = inp.r1 && inp.r1 > 0 ? inp.r1 : radiusFromMass(m1);
  const r2 = inp.r2 && inp.r2 > 0 ? inp.r2 : radiusFromMass(m2);
  const i1 = inp.i1 && inp.i1 > 0 ? inp.i1 : inertiaFromMassAndRadius(m1, r1);
  const i2 = inp.i2 && inp.i2 > 0 ? inp.i2 : inertiaFromMassAndRadius(m2, r2);
  const w1Before = inp.w1 ?? 0;
  const w2Before = inp.w2 ?? 0;
  const offset = inp.impactOffset ?? 0;

  // Resolve restitution: if e1 and e2 provided, eEffective = e1 * e2; otherwise use e
  let e1 = inp.e1 !== undefined ? clamp(inp.e1, 0, 1) : Math.sqrt(clamp(inp.e, 0, 1));
  let e2 = inp.e2 !== undefined ? clamp(inp.e2, 0, 1) : Math.sqrt(clamp(inp.e, 0, 1));
  let e = clamp(inp.e1 !== undefined && inp.e2 !== undefined ? e1 * e2 : inp.e, 0, 1);

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

  // Rotational physics:
  // Normal impulse delivered to drone A is J_n = impulse = m1 * (v1 - u1)
  // Lever arm torque from eccentricity: tau_ecc = J_n * offset
  // Tangential friction coupling from surface relative speed:
  const vSurfaceRel = w1Before * r1 + w2Before * r2;
  const frictionMu = 0.16;
  const normalImpulseMag = Math.abs(impulse);
  // Maximum tangential impulse that would equalize surface velocities
  const maxTangentialImpulse = (r1 * r1 / i1 + r2 * r2 / i2) > 1e-9
    ? Math.abs(vSurfaceRel) / (r1 * r1 / i1 + r2 * r2 / i2)
    : 0;
  const tangentialImpulse = Math.min(frictionMu * normalImpulseMag, maxTangentialImpulse);
  const frictionSign = vSurfaceRel >= 0 ? 1 : -1;

  // Net angular impulse (torque * dt) on drone A and drone B
  const angularImpulseA = collides ? impulse * offset - frictionSign * tangentialImpulse * r1 : 0;
  const angularImpulseB = collides ? -impulse * offset - frictionSign * tangentialImpulse * r2 : 0;

  const w1After = collides ? w1Before + angularImpulseA / i1 : w1Before;
  const w2After = collides ? w2Before + angularImpulseB / i2 : w2Before;

  const l1Before = i1 * w1Before;
  const l2Before = i2 * w2Before;
  const l1After = i1 * w1After;
  const l2After = i2 * w2After;
  const lBefore = l1Before + l2Before;
  const lAfter = l1After + l2After;

  const keRot1Before = 0.5 * i1 * w1Before * w1Before;
  const keRot2Before = 0.5 * i2 * w2Before * w2Before;
  const keRot1After = 0.5 * i1 * w1After * w1After;
  const keRot2After = 0.5 * i2 * w2After * w2After;
  const keRotBefore = keRot1Before + keRot2Before;
  const keRotAfter = keRot1After + keRot2After;

  const totalEnergyBefore = keBefore + keRotBefore;
  const totalEnergyAfter = keAfter + keRotAfter;

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
    r1,
    r2,
    i1,
    i2,
    w1Before,
    w1After,
    w2Before,
    w2After,
    lBefore,
    lAfter,
    l1Before,
    l1After,
    l2Before,
    l2After,
    keRot1Before,
    keRot2Before,
    keRot1After,
    keRot2After,
    keRotBefore,
    keRotAfter,
    totalEnergyBefore,
    totalEnergyAfter,
    torqueImpulse: Math.abs(angularImpulseA),
    e1,
    e2,
    eEffective: e,
  };
}

export function simulate(input: CollisionInput): Simulation {
  const result = solveCollision(input);
  const { m1, u1, m2, u2 } = input;
  const tau = Math.max(input.contactMs, 1) / 1000;
  const tc = T_APPROACH;
  const tr = tc + tau;
  const tEnd = input.tTotal && input.tTotal > tr + 0.2 ? input.tTotal : tr + T_AFTER;
  const r1 = result.r1;
  const r2 = result.r2;
  const i1 = result.i1;
  const i2 = result.i2;
  const x10 = -r1 - u1 * tc;
  const x20 = r2 - u2 * tc;
  const dv1 = result.v1 - u1;
  const dv2 = result.v2 - u2;
  const dw1 = result.w1After - result.w1Before;
  const dw2 = result.w2After - result.w2Before;
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

    // Rotational dynamics over time
    const w1 = result.w1Before + dw1 * st;
    const w2 = result.w2Before + dw2 * st;
    const theta1 = result.w1Before * t + dw1 * It;
    const theta2 = result.w2Before * t + dw2 * It;
    const l1 = i1 * w1;
    const l2 = i2 * w2;
    const l = l1 + l2;
    const keRot1 = 0.5 * i1 * w1 * w1;
    const keRot2 = 0.5 * i2 * w2 * w2;
    const keRot = keRot1 + keRot2;
    const totalEnergy = ke1 + ke2 + keRot;

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
      eStored: Math.max(0, result.totalEnergyBefore - totalEnergy),
      f: Math.abs(m1 * dv1 * ds(t)),
      gap: x2 - r2 - (x1 + r1),
      phase,
      w1,
      w2,
      theta1,
      theta2,
      l1,
      l2,
      l,
      keRot1,
      keRot2,
      keRot,
      totalEnergy,
    };
  };

  const times: number[] = [];
  const n1 = 30;
  const n2 = 60;
  const n3 = 45;
  for (let i = 0; i < n1; i++) times.push((tc * i) / n1);
  for (let i = 0; i <= n2; i++) times.push(tc + (tau * i) / n2);
  const tAfterSpan = tEnd - tr;
  for (let i = 1; i <= n3; i++) times.push(tr + (tAfterSpan * i) / n3);

  const points = times.map(sample);
  let xMin = Infinity;
  let xMax = -Infinity;
  let vMax = 0;
  let wMax = 0;
  for (const p of points) {
    xMin = Math.min(xMin, p.x1 - r1, p.x2 - r2);
    xMax = Math.max(xMax, p.x1 + r1, p.x2 + r2);
    vMax = Math.max(vMax, Math.abs(p.v1), Math.abs(p.v2));
    wMax = Math.max(wMax, Math.abs(p.w1), Math.abs(p.w2));
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
    wMax,
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
  autoRadius?: boolean;
  autoInertia?: boolean;
}

/**
 * Post-impact velocity of one drone as a function of e.
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
  e1: number;
  e2: number;
  target: number;
  clamped: boolean;
}

/** Turns the editable lab state into a solvable input. */
export function resolveLabConfig(cfg: LabConfig): ResolvedLab {
  const { mode, target, autoRadius, autoInertia, ...input } = cfg;

  const r1 = autoRadius ? radiusFromMass(input.m1) : (input.r1 ?? radiusFromMass(input.m1));
  const r2 = autoRadius ? radiusFromMass(input.m2) : (input.r2 ?? radiusFromMass(input.m2));
  const i1 = autoInertia ? inertiaFromMassAndRadius(input.m1, r1) : (input.i1 ?? inertiaFromMassAndRadius(input.m1, r1));
  const i2 = autoInertia ? inertiaFromMassAndRadius(input.m2, r2) : (input.i2 ?? inertiaFromMassAndRadius(input.m2, r2));

  let finalE = input.e;
  let finalE1 = input.e1 !== undefined ? clamp(input.e1, 0, 1) : Math.sqrt(clamp(input.e, 0, 1));
  let finalE2 = input.e2 !== undefined ? clamp(input.e2, 0, 1) : Math.sqrt(clamp(input.e, 0, 1));
  let clamped = false;

  if (mode === "e") {
    // If e1 and e2 are set, e is derived from e1 * e2
    if (input.e1 !== undefined && input.e2 !== undefined) {
      finalE = clamp(input.e1 * input.e2, 0, 1);
    }
    const r = velocityRange({ ...input, e: finalE }, "v2");
    return {
      input: { ...input, r1, r2, i1, i2, e: finalE, e1: finalE1, e2: finalE2 },
      e: finalE,
      e1: finalE1,
      e2: finalE2,
      target: r.atE0 + finalE * (r.atE1 - r.atE0),
      clamped: false,
    };
  }

  const who = mode;
  const res = eFromTargetVelocity(input, who, target);
  finalE = res.e;
  clamped = res.clamped;
  finalE1 = Math.sqrt(finalE);
  finalE2 = Math.sqrt(finalE);

  const solved = solveCollision({ ...input, r1, r2, i1, i2, e: finalE });
  return {
    input: { ...input, r1, r2, i1, i2, e: finalE, e1: finalE1, e2: finalE2 },
    e: finalE,
    e1: finalE1,
    e2: finalE2,
    target: solved[who],
    clamped,
  };
}

export const LAB_PRESETS: LabPreset[] = [
  {
    name: "Head-on elastic",
    description: "Equal masses swap velocities; zero initial spin",
    input: {
      m1: 1.5,
      u1: 8,
      m2: 1.5,
      u2: -8,
      e: 0.95,
      e1: 0.98,
      e2: 0.97,
      r1: 0.28,
      r2: 0.28,
      w1: 0,
      w2: 0,
      contactMs: 40,
      tTotal: 1.6,
      impactOffset: 0,
    },
  },
  {
    name: "Spinning prop strike",
    description: "High angular velocity exchange with tangential friction",
    input: {
      m1: 1.8,
      u1: 7,
      m2: 1.8,
      u2: -5,
      e: 0.72,
      e1: 0.85,
      e2: 0.85,
      r1: 0.32,
      r2: 0.32,
      i1: 0.08,
      i2: 0.08,
      w1: 120,
      w2: -40,
      contactMs: 50,
      tTotal: 1.8,
      impactOffset: 0.05,
    },
  },
  {
    name: "Asymmetric radii (Titan vs Micro)",
    description: "Giant drone (r = 0.55m) collides with micro scout (r = 0.15m)",
    input: {
      m1: 4.2,
      u1: 9,
      m2: 0.45,
      u2: -3,
      e: 0.65,
      e1: 0.8,
      e2: 0.81,
      r1: 0.55,
      r2: 0.15,
      i1: 0.45,
      i2: 0.008,
      w1: 15,
      w2: -30,
      contactMs: 65,
      tTotal: 1.7,
      impactOffset: 0,
    },
  },
  {
    name: "Soft bumper vs rigid shield",
    description: "Dissipative bumper (e₁ = 0.25) striking hard body (e₂ = 0.96)",
    input: {
      m1: 2.0,
      u1: 8.5,
      m2: 2.0,
      u2: -5.5,
      e: 0.24,
      e1: 0.25,
      e2: 0.96,
      r1: 0.3,
      r2: 0.3,
      w1: 0,
      w2: 0,
      contactMs: 75,
      tTotal: 1.8,
      impactOffset: 0,
    },
  },
  {
    name: "Off-center glancing spin tap",
    description: "Vertical offset h = 0.12m induces strong angular acceleration",
    input: {
      m1: 1.6,
      u1: 10,
      m2: 2.0,
      u2: 4,
      e: 0.8,
      e1: 0.9,
      e2: 0.89,
      r1: 0.32,
      r2: 0.34,
      i1: 0.07,
      i2: 0.11,
      w1: -50,
      w2: 20,
      contactMs: 45,
      tTotal: 2.0,
      impactOffset: 0.12,
    },
  },
  {
    name: "Docking (perfectly inelastic)",
    description: "Drones couple with e = 0 and stick together",
    input: {
      m1: 1.2,
      u1: 6,
      m2: 2.4,
      u2: 1,
      e: 0,
      e1: 0,
      e2: 0,
      r1: 0.26,
      r2: 0.33,
      w1: 0,
      w2: 0,
      contactMs: 90,
      tTotal: 1.8,
      impactOffset: 0,
    },
  },
];
