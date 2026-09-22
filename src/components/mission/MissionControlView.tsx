import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  Navigation,
  Pause,
  Play,
  Radar,
  Radio,
  RotateCcw,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { fmt } from "../../lib/format";
import { Badge, Button } from "../ui";
import { cn } from "../../utils/cn";

export interface DroneAgent {
  id: string;
  callsign: string;
  color: string;
  accent: string;
  glow: string;
  mass: number; // kg
  x: number; // arena x (-200 to 200 m)
  y: number; // arena y (-200 to 200 m)
  vx: number; // m/s
  vy: number; // m/s
  altitude: number; // m
  heading: number; // deg
  battery: number; // %
  history: { x: number; y: number }[];
}

const INITIAL_DRONES: DroneAgent[] = [
  {
    id: "d1",
    callsign: "Drone 1 · Alpha",
    color: "#38bdf8", // Cyan
    accent: "text-cyan-400",
    glow: "rgba(56, 189, 248, 0.45)",
    mass: 1.8,
    x: -120,
    y: -60,
    vx: 18.5,
    vy: 9.2,
    altitude: 42.4,
    heading: 26.5,
    battery: 88,
    history: [],
  },
  {
    id: "d2",
    callsign: "Drone 2 · Beta",
    color: "#f59e0b", // Amber
    accent: "text-amber-400",
    glow: "rgba(245, 158, 11, 0.45)",
    mass: 2.2,
    x: 125,
    y: 65,
    vx: -19.2,
    vy: -10.1,
    altitude: 43.1,
    heading: 207.7,
    battery: 76,
    history: [],
  },
  {
    id: "d3",
    callsign: "Drone 3 · Gamma",
    color: "#34d399", // Emerald
    accent: "text-emerald-400",
    glow: "rgba(52, 211, 153, 0.45)",
    mass: 1.5,
    x: 40,
    y: -130,
    vx: -6.4,
    vy: 16.8,
    altitude: 48.0,
    heading: 110.8,
    battery: 92,
    history: [],
  },
  {
    id: "d4",
    callsign: "Drone 4 · Delta",
    color: "#a78bfa", // Violet
    accent: "text-violet-400",
    glow: "rgba(167, 139, 250, 0.45)",
    mass: 2.0,
    x: -45,
    y: 135,
    vx: 7.1,
    vy: -17.2,
    altitude: 41.5,
    heading: 292.4,
    battery: 64,
    history: [],
  },
];

export function MissionControlView() {
  const [drones, setDrones] = useState<DroneAgent[]>(INITIAL_DRONES);
  const [playing, setPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [radarAngle, setRadarAngle] = useState(0);
  const [showVectors, setShowVectors] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [avoidanceMode, setAvoidanceMode] = useState(false);
  const [selectedDroneId, setSelectedDroneId] = useState<string>("d1");
  const reqRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Proximity & collision risk calculation
  const { minDistance, pairRisk, closestPair } = useMemo(() => {
    let minDist = Infinity;
    let pair = ["d1", "d2"];

    for (let i = 0; i < drones.length; i++) {
      for (let j = i + 1; j < drones.length; j++) {
        const dx = drones[i].x - drones[j].x;
        const dy = drones[i].y - drones[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          pair = [drones[i].callsign, drones[j].callsign];
        }
      }
    }

    // Risk scale: 0 to 100%
    // < 15m is critical (red), < 40m is warning (amber), > 80m is safe (green)
    const risk = Math.min(100, Math.max(5, Math.round((1 - Math.min(minDist, 100) / 100) * 100)));
    return { minDistance: minDist, pairRisk: risk, closestPair: pair };
  }, [drones]);

  // Main animation and physics simulation loop
  useEffect(() => {
    const updatePhysics = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const dt = Math.min(0.05, (timestamp - lastTimeRef.current) / 1000) * simSpeed;
      lastTimeRef.current = timestamp;

      setRadarAngle((prev) => (prev + dt * 45) % 360);

      if (playing) {
        setDrones((prevDrones) => {
          return prevDrones.map((d, idx) => {
            let nextVx = d.vx;
            let nextVy = d.vy;

            // Optional autonomous collision avoidance repulsive forces
            if (avoidanceMode) {
              prevDrones.forEach((other, otherIdx) => {
                if (idx !== otherIdx) {
                  const dx = d.x - other.x;
                  const dy = d.y - other.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist < 50 && dist > 1) {
                    const repulse = (50 - dist) * 0.8;
                    nextVx += (dx / dist) * repulse * dt;
                    nextVy += (dy / dist) * repulse * dt;
                  }
                }
              });
            }

            // Boundary bounce to keep in radar arena (-160 to 160)
            let nextX = d.x + nextVx * dt;
            let nextY = d.y + nextVy * dt;

            if (nextX > 155) {
              nextX = 155;
              nextVx = -Math.abs(nextVx);
            } else if (nextX < -155) {
              nextX = -155;
              nextVx = Math.abs(nextVx);
            }

            if (nextY > 155) {
              nextY = 155;
              nextVy = -Math.abs(nextVy);
            } else if (nextY < -155) {
              nextY = -155;
              nextVy = Math.abs(nextVy);
            }

            // Calculate heading
            const heading = (Math.atan2(nextVy, nextVx) * (180 / Math.PI) + 360) % 360;

            // Maintain subtle history trail
            const newHistory = [...d.history, { x: d.x, y: d.y }].slice(-24);

            return {
              ...d,
              x: nextX,
              y: nextY,
              vx: nextVx,
              vy: nextVy,
              heading,
              history: newHistory,
            };
          });
        });
      }

      reqRef.current = requestAnimationFrame(updatePhysics);
    };

    reqRef.current = requestAnimationFrame(updatePhysics);
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [playing, simSpeed, avoidanceMode]);

  const resetDrones = () => {
    setDrones(INITIAL_DRONES);
  };

  const selectedDrone = drones.find((d) => d.id === selectedDroneId) || drones[0];
  const selectedSpeed = Math.sqrt(selectedDrone.vx * selectedDrone.vx + selectedDrone.vy * selectedDrone.vy);
  const selectedMomentum = selectedDrone.mass * selectedSpeed;

  return (
    <div className="space-y-6 pt-4 text-slate-100">
      {/* 1. Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-cyan-500/20 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-0.5 text-[11px] font-mono font-medium text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
              <Radio className="h-3 w-3 animate-pulse text-cyan-400" /> MISSION CONTROL · AIRSPACE LIVE
            </span>
            <span className="text-xs text-slate-400 font-mono">UTC {new Date().toISOString().substring(11, 19)}</span>
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            Collision Drones <span className="text-cyan-400">·</span> Momentum Tracking Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Cinematic aerospace HUD tracking multi-drone vectors, real-time collision-risk heatmap zones,
            holographic telemetry feeds, and momentum impulse conservation.
          </p>
        </div>

        {/* Global Controls & Status */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPlaying(!playing)}
            className="border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-white font-mono text-xs"
          >
            {playing ? <Pause className="h-3.5 w-3.5 text-amber-400" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
            {playing ? "Pause Stream" : "Resume"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setAvoidanceMode(!avoidanceMode)}
            className={cn(
              "font-mono text-xs transition-colors",
              avoidanceMode
                ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                : "border-slate-700 bg-slate-900/80 text-slate-300",
            )}
          >
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            {avoidanceMode ? "CAS Active" : "CAS Inactive"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={resetDrones}
            className="border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-mono text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>

          <div className="flex items-center rounded-lg border border-slate-700/80 bg-slate-900/90 p-0.5 text-xs font-mono">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSimSpeed(s)}
                className={cn(
                  "rounded px-2 py-1 transition-colors",
                  simSpeed === s ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white",
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Top Metric HUD Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-xl border border-cyan-500/25 bg-slate-900/60 p-3.5 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>CLOSEST PROXIMITY</span>
            <AlertTriangle className={cn("h-3.5 w-3.5", minDistance < 25 ? "text-rose-500 animate-pulse" : "text-emerald-400")} />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">
            {fmt(minDistance, 1)} <span className="text-xs text-cyan-400 font-normal">m</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-slate-400 truncate">
            {closestPair[0]} ↔ {closestPair[1]}
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/25 bg-slate-900/60 p-3.5 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>COLLISION RISK</span>
            <ShieldAlert className={cn("h-3.5 w-3.5", pairRisk > 60 ? "text-rose-400 animate-bounce" : "text-amber-400")} />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">
            {pairRisk}%
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  pairRisk > 70 ? "bg-rose-500" : pairRisk > 40 ? "bg-amber-500" : "bg-emerald-500",
                )}
                style={{ width: `${pairRisk}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/25 bg-slate-900/60 p-3.5 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>SELECTED SPEED</span>
            <Gauge className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">
            {fmt(selectedSpeed, 1)} <span className="text-xs text-cyan-400 font-normal">m/s</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-slate-400">
            ≈ {fmt(selectedSpeed * 3.6, 1)} km/h
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/25 bg-slate-900/60 p-3.5 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>MOMENTUM |p|</span>
            <Activity className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">
            {fmt(selectedMomentum, 1)} <span className="text-xs text-amber-400 font-normal">kg·m/s</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-slate-400">
            Mass: {selectedDrone.mass} kg
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/25 bg-slate-900/60 p-3.5 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>ACTIVE DRONES</span>
            <Radar className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">
            {drones.length} <span className="text-xs text-emerald-400 font-normal">ONLINE</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Telemetry Locked
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/25 bg-slate-900/60 p-3.5 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>COLLISION MODE</span>
            <Navigation className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">
            {avoidanceMode ? "AUTO-CAS" : "INTERCEPT"}
          </div>
          <div className="mt-1 text-[11px] font-mono text-slate-400">
            {avoidanceMode ? "Repulsion fields" : "Ballistic trajectories"}
          </div>
        </div>
      </div>

      {/* 3. Main Command Center Grid: 3D Holographic Radar + Side Telemetry Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Telemetry Column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>DRONE TELEMETRY HUD</span>
            <span className="text-cyan-400 font-bold">ALPHA &amp; BETA</span>
          </div>

          {[drones[0], drones[1]].map((d) => {
            const speed = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
            const isSelected = selectedDroneId === d.id;

            return (
              <div
                key={d.id}
                onClick={() => setSelectedDroneId(d.id)}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 backdrop-blur-xl transition-all duration-200",
                  isSelected
                    ? "border-cyan-400/80 bg-slate-900/80 shadow-[0_0_24px_rgba(6,182,212,0.25)]"
                    : "border-slate-800/90 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color, boxShadow: `0 0 8px ${d.color}` }} />
                    <span className="font-mono text-sm font-bold text-white tracking-wide">{d.callsign}</span>
                  </div>
                  <Badge tone={d.battery > 50 ? "emerald" : "amber"} className="text-[10px] font-mono">
                    BAT {d.battery}%
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-2">
                    <span className="text-[10px] text-slate-400 uppercase">SPEED</span>
                    <div className="text-base font-bold text-cyan-300 mt-0.5">
                      {fmt(speed * 3.6, 1)} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-2">
                    <span className="text-[10px] text-slate-400 uppercase">ALTITUDE</span>
                    <div className="text-base font-bold text-slate-200 mt-0.5">
                      {fmt(d.altitude, 1)} <span className="text-[10px] font-normal text-slate-400">m</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-2">
                    <span className="text-[10px] text-slate-400 uppercase">HEADING</span>
                    <div className="text-base font-bold text-slate-200 mt-0.5">
                      {fmt(d.heading, 0)}°
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-2">
                    <span className="text-[10px] text-slate-400 uppercase">MOMENTUM</span>
                    <div className="text-base font-bold text-amber-300 mt-0.5">
                      {fmt(d.mass * speed, 1)} <span className="text-[10px] font-normal text-slate-400">kg·m/s</span>
                    </div>
                  </div>
                </div>

                {/* Battery bar with glowing accent */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Power Reserve</span>
                    <span>{d.battery}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${d.battery}%`,
                        backgroundColor: d.color,
                        boxShadow: `0 0 8px ${d.color}`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Collision Risk Heatmap Card */}
          <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold uppercase tracking-wider">COLLISION-RISK HEATMAP</span>
              <span className="text-rose-400 font-bold">{pairRisk}%</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Proximity density mapping based on closing speed &amp; distance.
            </p>
            <div className="mt-3 space-y-1.5">
              <div className="h-3 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 p-0.5 shadow-[0_0_12px_rgba(244,63,94,0.3)]">
                <div
                  className="h-full w-2 rounded-full bg-white shadow-[0_0_8px_#ffffff] transition-all duration-200"
                  style={{ marginLeft: `calc(${pairRisk}% - 4px)` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span className="text-emerald-400">LOW</span>
                <span className="text-amber-400">MODERATE</span>
                <span className="text-rose-400">CRITICAL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: 3D Holographic Radar Arena */}
        <div className="lg:col-span-6 flex flex-col">
          <div className="relative flex-1 rounded-3xl border border-cyan-500/30 bg-[#060b17] p-4 shadow-[0_0_40px_rgba(6,182,212,0.15)] overflow-hidden">
            {/* Top HUD Controls overlay on radar */}
            <div className="absolute top-4 left-5 right-5 z-20 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">
                  3D TACTICAL AIRSPACE RADAR
                </span>
              </div>

              <div className="pointer-events-auto flex items-center gap-1.5">
                <button
                  onClick={() => setShowVectors(!showVectors)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-mono transition-colors border",
                    showVectors
                      ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-300"
                      : "border-slate-800 bg-slate-900/60 text-slate-400",
                  )}
                >
                  Vectors
                </button>
                <button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-mono transition-colors border",
                    showHeatmap
                      ? "border-amber-500/60 bg-amber-950/40 text-amber-300"
                      : "border-slate-800 bg-slate-900/60 text-slate-400",
                  )}
                >
                  Heatmap
                </button>
              </div>
            </div>

            {/* Radar Canvas / SVG Display */}
            <div className="relative w-full aspect-square max-h-[560px] mx-auto flex items-center justify-center">
              <svg
                viewBox="-200 -200 400 400"
                className="w-full h-full select-none"
                style={{ filter: "drop-shadow(0 0 16px rgba(6, 182, 212, 0.1))" }}
              >
                <defs>
                  {/* Subtle Radar Background Grid Pattern */}
                  <pattern id="radarGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(56, 189, 248, 0.06)" strokeWidth="0.8" />
                    <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(56, 189, 248, 0.06)" strokeWidth="0.8" />
                  </pattern>

                  {/* Radial sweep glow */}
                  <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </linearGradient>

                  {/* Impact Risk Heatmap Radial Filter */}
                  <radialGradient id="riskGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.55" />
                    <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.35" />
                    <stop offset="85%" stopColor="#10b981" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* 1. Isometric / Cartesian Background Ground Plane */}
                <rect x="-195" y="-195" width="390" height="390" rx="16" fill="url(#radarGrid)" />

                {/* 2. Concentric Radar Range Rings */}
                {[40, 80, 120, 160].map((radius) => (
                  <g key={radius}>
                    <circle
                      cx="0"
                      cy="0"
                      r={radius}
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.2)"
                      strokeWidth="1"
                      strokeDasharray={radius === 160 ? "4 4" : undefined}
                    />
                    <text
                      x={radius + 4}
                      y="12"
                      fill="rgba(56, 189, 248, 0.45)"
                      fontSize="8"
                      fontFamily="ui-monospace, monospace"
                    >
                      {radius}m
                    </text>
                  </g>
                ))}

                {/* Crosshairs & Angle Lines */}
                <line x1="-185" y1="0" x2="185" y2="0" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
                <line x1="0" y1="-185" x2="0" y2="185" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
                <line x1="-130" y1="-130" x2="130" y2="130" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="0.8" strokeDasharray="3 3" />
                <line x1="-130" y1="130" x2="130" y2="-130" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="0.8" strokeDasharray="3 3" />

                {/* 3. Heatmap Glow between closest drones if risk is elevated */}
                {showHeatmap && minDistance < 100 && (
                  <g>
                    <ellipse
                      cx={(drones[0].x + drones[1].x) / 2}
                      cy={(drones[0].y + drones[1].y) / 2}
                      rx={Math.max(30, (100 - minDistance) * 0.9)}
                      ry={Math.max(20, (100 - minDistance) * 0.6)}
                      fill="url(#riskGlow)"
                      className="animate-pulse"
                    />
                  </g>
                )}

                {/* 4. Rotating Radar Beam Sweep */}
                <g transform={`rotate(${radarAngle} 0 0)`}>
                  <path d="M 0 0 L 160 0 A 160 160 0 0 1 125 100 Z" fill="url(#sweepGrad)" opacity="0.4" />
                  <line x1="0" y1="0" x2="160" y2="0" stroke="#38bdf8" strokeWidth="1.5" opacity="0.8" />
                </g>

                {/* 5. Intercept / Warning Proximity Line */}
                {minDistance < 70 && (
                  <line
                    x1={drones[0].x}
                    y1={drones[0].y}
                    x2={drones[1].x}
                    y2={drones[1].y}
                    stroke={minDistance < 25 ? "#ef4444" : "#f59e0b"}
                    strokeWidth="1.8"
                    strokeDasharray="4 4"
                    className="animate-pulse"
                  />
                )}

                {/* 6. Render Drones & Vectors */}
                {drones.map((d) => {
                  const isSelected = selectedDroneId === d.id;

                  // Velocity vector endpoint
                  const vScale = 1.6;
                  const vxEnd = d.x + d.vx * vScale;
                  const vyEnd = d.y + d.vy * vScale;

                  // Momentum arrow endpoint
                  const pScale = 1.2;
                  const pxEnd = d.x + (d.vx * d.mass * 0.7) * pScale;
                  const pyEnd = d.y + (d.vy * d.mass * 0.7) * pScale;

                  return (
                    <g key={d.id} className="cursor-pointer" onClick={() => setSelectedDroneId(d.id)}>
                      {/* Trail of motion */}
                      {d.history.map((pt, hIdx) => {
                        const opacity = (hIdx + 1) / d.history.length * 0.45;
                        return (
                          <circle
                            key={hIdx}
                            cx={pt.x}
                            cy={pt.y}
                            r={2}
                            fill={d.color}
                            opacity={opacity}
                          />
                        );
                      })}

                      {/* Velocity Vector (Cyan/Accent) */}
                      {showVectors && (
                        <g>
                          <line
                            x1={d.x}
                            y1={d.y}
                            x2={vxEnd}
                            y2={vyEnd}
                            stroke={d.color}
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <circle cx={vxEnd} cy={vyEnd} r="2.5" fill={d.color} />
                        </g>
                      )}

                      {/* Momentum Vector (Amber) */}
                      {showVectors && (
                        <g>
                          <line
                            x1={d.x}
                            y1={d.y}
                            x2={pxEnd}
                            y2={pyEnd}
                            stroke="#f59e0b"
                            strokeWidth="1.4"
                            strokeDasharray="3 2"
                          />
                        </g>
                      )}

                      {/* Drone Body Halo / Outer Rings */}
                      <circle
                        cx={d.x}
                        cy={d.y}
                        r={isSelected ? 16 : 12}
                        fill="none"
                        stroke={d.color}
                        strokeWidth={isSelected ? 1.8 : 1}
                        strokeDasharray={isSelected ? "4 2" : undefined}
                        opacity={0.8}
                        className={isSelected ? "animate-spin" : undefined}
                        style={{ transformOrigin: `${d.x}px ${d.y}px`, animationDuration: "8s" }}
                      />

                      {/* Drone Main Body Marker */}
                      <circle
                        cx={d.x}
                        cy={d.y}
                        r="6"
                        fill={d.color}
                        style={{ filter: `drop-shadow(0 0 8px ${d.color})` }}
                      />

                      {/* Drone Heading Arrow */}
                      <g transform={`rotate(${d.heading} ${d.x} ${d.y})`}>
                        <polygon
                          points={`${d.x + 9},${d.y} ${d.x + 3},${d.y - 3} ${d.x + 3},${d.y + 3}`}
                          fill="#ffffff"
                        />
                      </g>

                      {/* Callsign label */}
                      <text
                        x={d.x}
                        y={d.y - 14}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#ffffff"
                        fontWeight="bold"
                        fontFamily="ui-monospace, monospace"
                        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                      >
                        {d.callsign.split(" · ")[1]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Bottom HUD Legend overlay on radar */}
            <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-cyan-500/20 pt-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" /> Velocity (v)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Momentum (p)
                </span>
              </div>
              <span className="text-cyan-300">Target Range: 400m x 400m</span>
            </div>
          </div>
        </div>

        {/* Right Telemetry Column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>DRONE TELEMETRY HUD</span>
            <span className="text-emerald-400 font-bold">GAMMA &amp; DELTA</span>
          </div>

          {[drones[2], drones[3]].map((d) => {
            const speed = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
            const isSelected = selectedDroneId === d.id;

            return (
              <div
                key={d.id}
                onClick={() => setSelectedDroneId(d.id)}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 backdrop-blur-xl transition-all duration-200",
                  isSelected
                    ? "border-cyan-400/80 bg-slate-900/80 shadow-[0_0_24px_rgba(6,182,212,0.25)]"
                    : "border-slate-800/90 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color, boxShadow: `0 0 8px ${d.color}` }} />
                    <span className="font-mono text-sm font-bold text-white tracking-wide">{d.callsign}</span>
                  </div>
                  <Badge tone={d.battery > 50 ? "emerald" : "amber"} className="text-[10px] font-mono">
                    BAT {d.battery}%
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-2">
                    <span className="text-[10px] text-slate-400 uppercase">SPEED</span>
                    <div className="text-base font-bold text-cyan-300 mt-0.5">
                      {fmt(speed * 3.6, 1)} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-2">
                    <span className="text-[10px] text-slate-400 uppercase">ALTITUDE</span>
                    <div className="text-base font-bold text-slate-200 mt-0.5">
                      {fmt(d.altitude, 1)} <span className="text-[10px] font-normal text-slate-400">m</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-2">
                    <span className="text-[10px] text-slate-400 uppercase">HEADING</span>
                    <div className="text-base font-bold text-slate-200 mt-0.5">
                      {fmt(d.heading, 0)}°
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-2">
                    <span className="text-[10px] text-slate-400 uppercase">MOMENTUM</span>
                    <div className="text-base font-bold text-amber-300 mt-0.5">
                      {fmt(d.mass * speed, 1)} <span className="text-[10px] font-normal text-slate-400">kg·m/s</span>
                    </div>
                  </div>
                </div>

                {/* Battery bar with glowing accent */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Power Reserve</span>
                    <span>{d.battery}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${d.battery}%`,
                        backgroundColor: d.color,
                        boxShadow: `0 0 8px ${d.color}`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Selected Drone Flight Director Box */}
          <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold uppercase tracking-wider">FLIGHT DIRECTOR</span>
              <span className="text-cyan-400">{selectedDrone.callsign.split(" · ")[1]}</span>
            </div>
            <div className="mt-3 space-y-2 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Coordinate Pos (X, Y):</span>
                <span className="text-cyan-300 font-bold">
                  {fmt(selectedDrone.x, 1)}, {fmt(selectedDrone.y, 1)} m
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Velocity Vector:</span>
                <span className="text-slate-200">
                  [{fmt(selectedDrone.vx, 1)}, {fmt(selectedDrone.vy, 1)}] m/s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Collision Avoidance:</span>
                <span className={avoidanceMode ? "text-emerald-400 font-bold" : "text-amber-400"}>
                  {avoidanceMode ? "Armed & Shielded" : "Standby"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
