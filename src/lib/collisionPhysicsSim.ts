/**
 * Two-body 2D Drone Collision Physics Simulation Engine.
 *
 * Implements:
 * - 2D kinematics with mass (m1, m2), collision radii (R1, R2), moment of inertia (I1, I2)
 * - Impulse formulation with normal restitution (e) and tangential friction (mu)
 * - Torque generation from tangential surface impulse updating angular velocity (w -= R*jt/I)
 * - Post-crash exponential braking on linear velocity (kv) and spin (kw)
 * - Discrete time-stepping at dt = 0.01s for T = 10s (1000 steps)
 */

export interface SimConfig {
  m1: number; // kg (default 1.5)
  m2: number; // kg (default 1.2)
  R1: number; // m (default 0.30)
  R2: number; // m (default 0.25)
  I1: number; // kg·m² (default 0.047)
  I2: number; // kg·m² (default 0.039)
  e: number;  // coefficient of restitution (default 0.7)
  mu: number; // friction coefficient (default 0.3)
  kv: number; // post-crash linear speed damping (default 1.5)
  kw: number; // post-crash spin damping (default 2.0)
  dt: number; // time step s (default 0.01)
  T: number;  // total time s (default 10.0)

  // Initial conditions
  p1x: number;
  p1y: number;
  v1x: number;
  v1y: number;
  p2x: number;
  p2y: number;
  v2x: number;
  v2y: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  m1: 1.5,
  m2: 1.2,
  R1: 0.30,
  R2: 0.25,
  I1: 0.047,
  I2: 0.039,
  e: 0.7,
  mu: 0.3,
  kv: 1.5,
  kw: 2.0,
  dt: 0.01,
  T: 10.0,

  // Initial approach paths leading to clean collision at t ≈ 1.6s
  p1x: -3.2,
  p1y: -1.0,
  v1x: 2.0,
  v1y: 0.62,
  p2x: 3.2,
  p2y: 1.0,
  v2x: -2.0,
  v2y: -0.62,
};

export interface SimStep {
  t: number;
  // Drone 1
  x1: number;
  y1: number;
  v1x: number;
  v1y: number;
  p1x: number;
  p1y: number;
  ke1: number;
  w1: number;

  // Drone 2
  x2: number;
  y2: number;
  v2x: number;
  v2y: number;
  p2x: number;
  p2y: number;
  ke2: number;
  w2: number;

  // System totals
  pTotalX: number;
  pTotalY: number;
  keTotal: number;
  isCrashed: boolean;
}

export interface SimResult {
  config: SimConfig;
  steps: SimStep[];
  crashIndex: number | null;
  crashTime: number | null;
  crashX: number | null;
  crashY: number | null;
  initialTotalMomentum: { x: number; y: number };
  postCrashTotalMomentum: { x: number; y: number };
  initialTotalKE: number;
  postCrashTotalKE: number;
  keLossPct: number;
}

export function runTwoDroneSimulation(cfg: SimConfig = DEFAULT_SIM_CONFIG): SimResult {
  const { m1, m2, R1, R2, I1, I2, e, mu, kv, kw, dt, T } = cfg;
  const numSteps = Math.floor(T / dt);

  // Dynamic state
  let x1 = cfg.p1x;
  let y1 = cfg.p1y;
  let v1x = cfg.v1x;
  let v1y = cfg.v1y;
  let w1 = 0;

  let x2 = cfg.p2x;
  let y2 = cfg.p2y;
  let v2x = cfg.v2x;
  let v2y = cfg.v2y;
  let w2 = 0;

  let crashed = false;
  let crashIndex: number | null = null;
  let crashTime: number | null = null;
  let crashX: number | null = null;
  let crashY: number | null = null;

  const steps: SimStep[] = [];
  const Rsum = R1 + R2;

  for (let i = 0; i <= numSteps; i++) {
    const t = Math.round(i * dt * 1000) / 1000;

    // Check collision condition if not yet crashed
    if (!crashed) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= Rsum && dist > 1e-6) {
        // Normal unit vector from 1 toward 2
        const nx = dx / dist;
        const ny = dy / dist;

        // Relative velocity v_rel = v1 - v2
        const vrelX = v1x - v2x;
        const vrelY = v1y - v2y;
        const vrelN = vrelX * nx + vrelY * ny;

        // Closing velocity is positive when approaching along n
        if (vrelN > 0) {
          // Tangent unit vector
          const tx = -ny;
          const ty = nx;
          const vrelT = vrelX * tx + vrelY * ty;

          // Normal impulse magnitude jn = (1 + e) * vrelN / (1/m1 + 1/m2)
          const invM = 1 / m1 + 1 / m2;
          const jn = ((1 + e) * vrelN) / invM;

          // Tangential friction impulse jt = -mu * jn * sign(vrelT)
          const signT = vrelT >= 0 ? 1 : -1;
          const jt = mu * jn * signT;

          // Apply impulses to linear velocities
          // Impulse on 1: -jn*n - jt*t
          // Impulse on 2: +jn*n + jt*t (equal and opposite)
          const J1x = -jn * nx - jt * tx;
          const J1y = -jn * ny - jt * ty;

          v1x += J1x / m1;
          v1y += J1y / m1;

          v2x -= J1x / m2;
          v2y -= J1y / m2;

          // Add spin from tangential impulse: w -= R * jt / I
          w1 -= (R1 * jt) / I1;
          w2 -= (R2 * jt) / I2;

          crashed = true;
          crashIndex = i;
          crashTime = t;
          crashX = (x1 + x2) / 2;
          crashY = (y1 + y2) / 2;
        }
      }
    }

    // Post-crash braking: exponentially dampen both linear velocity and spin
    if (crashed && crashIndex !== null && i > crashIndex) {
      const brakeV = Math.exp(-kv * dt);
      const brakeW = Math.exp(-kw * dt);

      v1x *= brakeV;
      v1y *= brakeV;
      v2x *= brakeV;
      v2y *= brakeV;

      w1 *= brakeW;
      w2 *= brakeW;
    }

    // Update positions from velocities
    x1 += v1x * dt;
    y1 += v1y * dt;
    x2 += v2x * dt;
    y2 += v2y * dt;

    // Linear momentum
    const p1x = m1 * v1x;
    const p1y = m1 * v1y;
    const p2x = m2 * v2x;
    const p2y = m2 * v2y;
    const pTotalX = p1x + p2x;
    const pTotalY = p1y + p2y;

    // Kinetic energy
    const ke1 = 0.5 * m1 * (v1x * v1x + v1y * v1y);
    const ke2 = 0.5 * m2 * (v2x * v2x + v2y * v2y);
    const keTotal = ke1 + ke2;

    steps.push({
      t,
      x1,
      y1,
      v1x,
      v1y,
      p1x,
      p1y,
      ke1,
      w1,
      x2,
      y2,
      v2x,
      v2y,
      p2x,
      p2y,
      ke2,
      w2,
      pTotalX,
      pTotalY,
      keTotal,
      isCrashed: crashed,
    });
  }

  const initialStep = steps[0];
  const crashStep = crashIndex !== null && crashIndex + 1 < steps.length ? steps[crashIndex + 1] : steps[steps.length - 1];

  const initialTotalMomentum = {
    x: initialStep?.pTotalX ?? 0,
    y: initialStep?.pTotalY ?? 0,
  };
  const postCrashTotalMomentum = {
    x: crashStep?.pTotalX ?? 0,
    y: crashStep?.pTotalY ?? 0,
  };

  const initialTotalKE = initialStep?.keTotal ?? 1;
  const postCrashTotalKE = crashStep?.keTotal ?? 0;
  const keLossPct = initialTotalKE > 0 ? Math.max(0, ((initialTotalKE - postCrashTotalKE) / initialTotalKE) * 100) : 0;

  return {
    config: cfg,
    steps,
    crashIndex,
    crashTime,
    crashX,
    crashY,
    initialTotalMomentum,
    postCrashTotalMomentum,
    initialTotalKE,
    postCrashTotalKE,
    keLossPct,
  };
}

export interface SimPreset {
  name: string;
  description: string;
  config: Partial<SimConfig>;
}

export const SIM_PRESETS: SimPreset[] = [
  {
    name: "Standard Oblique Collision",
    description: "Equal-speed oblique angle (m₁ = 1.5kg, m₂ = 1.2kg, e = 0.7, μ = 0.3)",
    config: { ...DEFAULT_SIM_CONFIG },
  },
  {
    name: "T-Bone (90° Intersect)",
    description: "Drone 1 crosses orthogonally across Drone 2's flight path",
    config: {
      ...DEFAULT_SIM_CONFIG,
      p1x: -3.5,
      p1y: 0.0,
      v1x: 2.2,
      v1y: 0.0,
      p2x: 0.0,
      p2y: -3.5,
      v2x: 0.0,
      v2y: 2.2,
      e: 0.65,
      mu: 0.4,
    },
  },
  {
    name: "High-Friction Spin Tap",
    description: "Higher friction (μ = 0.6) producing dramatic spin transfer",
    config: {
      ...DEFAULT_SIM_CONFIG,
      mu: 0.6,
      e: 0.75,
      p1x: -3.2,
      p1y: -0.6,
      v1x: 2.0,
      v1y: 0.35,
      p2x: 3.2,
      p2y: 0.6,
      v2x: -2.0,
      v2y: -0.35,
    },
  },
  {
    name: "Heavy Interceptor (Titan vs Scout)",
    description: "3.5kg heavy body strikes a light 0.8kg drone",
    config: {
      ...DEFAULT_SIM_CONFIG,
      m1: 3.5,
      m2: 0.8,
      R1: 0.42,
      R2: 0.20,
      I1: 0.12,
      I2: 0.02,
      e: 0.55,
      mu: 0.35,
    },
  },
];
