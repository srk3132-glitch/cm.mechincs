import { Moon, Radar, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import type { Route } from "../hooks/useHashRoute";
import { Button } from "./ui";
import { cn } from "../utils/cn";

export const NAV: { route: Route; label: string; short: string }[] = [
  { route: "overview", label: "Overview", short: "Overview" },
  { route: "test-log", label: "Test log", short: "Log" },
  { route: "collision-lab", label: "Collision Lab", short: "Lab" },
  { route: "upload", label: "MATLAB import", short: "Upload" },
];

export function Header({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  const { dark, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button onClick={() => navigate("overview")} className="flex min-w-0 items-center gap-3 text-left">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-500/30">
            <Radar className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-white">
              Collision Drones <span className="text-slate-400 dark:text-slate-500">/</span> Momentum Tracking
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
              Impact telemetry, conservation checks &amp; energy budgets
            </p>
          </div>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <button
              key={n.route}
              onClick={() => navigate(n.route)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                route === n.route
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
              )}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 lg:inline-flex dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-emerald-500" />
            Telemetry live
          </span>
          <Button
            size="icon"
            variant="outline"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggle}
            className="relative overflow-hidden"
          >
            <Sun
              className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
            />
            <Moon
              className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`}
            />
          </Button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {NAV.map((n) => (
          <button
            key={n.route}
            onClick={() => navigate(n.route)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
              route === n.route
                ? "bg-brand-500 text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            )}
          >
            {n.short}
          </button>
        ))}
      </nav>
    </header>
  );
}
