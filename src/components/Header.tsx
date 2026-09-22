import { Moon, Radar, Sun, Pause, Play, PanelLeftClose, PanelLeftOpen, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import type { Route } from "../hooks/useHashRoute";
import { Button } from "./ui";
import { cn } from "../utils/cn";

export const NAV: { route: Route; label: string; short: string }[] = [
  { route: "overview", label: "Live Test", short: "Live" },
  { route: "test-log", label: "Test Log", short: "Log" },
  { route: "compare-runs", label: "Compare Runs", short: "Compare" },
  { route: "settings", label: "Settings", short: "Settings" },
  { route: "collision-physics", label: "Collision Physics", short: "Physics" },
  { route: "collision-lab", label: "Collision Lab", short: "Lab" },
  { route: "upload", label: "MATLAB import", short: "Upload" },
];

function SignalWaveform({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-20 text-emerald-500/90 dark:text-emerald-400" viewBox="0 0 100 20" fill="none">
      <path
        d="M 0 10 L 22 10 L 28 3 L 34 17 L 40 4 L 46 16 L 52 10 L 100 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? "animate-pulse" : "opacity-30"}
      />
    </svg>
  );
}

interface HeaderProps {
  route: Route;
  navigate: (r: Route) => void;
  isLive?: boolean;
  onToggleLive?: () => void;
  lastEventTime?: string;
}

export function Header({ route, navigate, isLive = true, onToggleLive, lastEventTime = "2026-09-21 21:38 UTC" }: HeaderProps) {
  const { dark, toggle } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl transition-colors dark:border-slate-800/80 dark:bg-[#0a0f1d]/90">
      <div className="mx-auto flex max-w-[1600px] flex-col px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-[72px] items-center gap-3 py-3">
          <button onClick={() => navigate("overview")} className="group flex min-w-0 flex-1 items-center gap-3 text-left lg:flex-none">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-blue-600 to-indigo-700 text-white shadow-lg shadow-brand-500/30 transition-transform duration-200 group-hover:scale-105">
              <Radar className="h-5 w-5 animate-pulse" />
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-950 transition-colors",
                  isLive ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-white">
                  Collision Drones <span className="text-brand-500">·</span> Momentum Tracking
                </h1>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
                Impact telemetry, conservation checks &amp; kinetic energy budgets
              </p>
            </div>
          </button>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50/70 px-2.5 py-1 sm:flex dark:border-slate-800 dark:bg-[#0d1424]/60">
              <SignalWaveform active={isLive} />
              <div className="flex flex-col text-left font-mono">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Telemetry</span>
                <span className={cn("text-[10px] font-bold uppercase", isLive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                  {isLive ? "Acquiring" : "Holding"}
                </span>
              </div>
            </div>

            {onToggleLive && (
              <button
                onClick={onToggleLive}
                title={isLive ? "Click to pause telemetry feed" : "Click to resume telemetry feed"}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-semibold transition-all duration-200",
                  isLive
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400",
                )}
              >
                <span className="relative flex h-2 w-2">
                  {isLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className={cn("relative inline-flex h-2 w-2 rounded-full", isLive ? "bg-emerald-500" : "bg-amber-500")} />
                </span>
                <span>{isLive ? "LIVE" : "PAUSED"}</span>
                {isLive ? <Pause className="h-3 w-3 opacity-70" /> : <Play className="h-3 w-3 opacity-70" />}
              </button>
            )}

            <div className="hidden flex-col items-end xl:flex">
              <span className="font-mono text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Last Incident Log</span>
              <span className="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-300">{lastEventTime}</span>
            </div>

            <Button size="icon" variant="outline" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle} className="relative overflow-hidden">
              <Sun className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
              <Moon className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 pb-3 lg:hidden">
          <div className="flex-1 overflow-x-auto">
            <nav className="flex min-w-max gap-1">
              {NAV.map((n) => (
                <button
                  key={n.route}
                  onClick={() => navigate(n.route)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition-colors min-h-[44px]",
                    route === n.route ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                  )}
                >
                  {n.short}
                </button>
              ))}
            </nav>
          </div>
          <Button size="icon" variant="outline" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle} className="relative overflow-hidden shrink-0">
            <Sun className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
            <Moon className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
          </Button>
        </div>

        <div className="hidden lg:flex">
          <aside className={cn("flex shrink-0 flex-col border-r border-slate-200/70 bg-white/60 pr-3 pt-2 dark:border-slate-800/80 dark:bg-[#0b1221]/70", sidebarCollapsed ? "w-20" : "w-64")}>
            <div className="mb-3 flex items-center justify-end">
              <button
                type="button"
                aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            <nav className="space-y-1 pb-3">
              {NAV.map((n) => (
                <button
                  key={n.route}
                  onClick={() => navigate(n.route)}
                  aria-label={n.label}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 min-h-[44px]",
                    route === n.route
                      ? "bg-brand-500 text-white shadow-sm shadow-brand-500/25 dark:bg-brand-500"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white",
                    sidebarCollapsed && "justify-center px-2",
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-[10px] font-semibold">
                    {n.label.slice(0, 1)}
                  </span>
                  {!sidebarCollapsed && <span>{n.label}</span>}
                  {!sidebarCollapsed && route === n.route && <ChevronRight className="ml-auto h-4 w-4" />}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      </div>
    </header>
  );
}
