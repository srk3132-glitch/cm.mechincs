import type { ReactNode } from "react";
import { useTheme } from "../../hooks/useTheme";

export const PALETTE = {
  blue: "#4d8dfc",     // richer broadcast-grade blue for velocity & approach
  violet: "#8f7cf6",   // refined violet for system momentum & total energy
  emerald: "#3ec9a4",  // richer green for nominal state
  amber: "#f7a35c",    // warm amber for kinetic energy & impact loads
  rose: "#ff6b5c",     // softened collision red
  cyan: "#57d4ff",     // bright cyan for spin dynamics
  slate: "#64748b",
  pink: "#ff7aca",
  lime: "#9adf56",
};

export const TYPE_COLORS: Record<string, string> = {
  Elastic: PALETTE.emerald,
  "Partially Inelastic": PALETTE.blue,
  "Perfectly Inelastic": PALETTE.amber,
};

export const STATUS_COLORS: Record<string, string> = {
  Nominal: PALETTE.emerald,
  Warning: PALETTE.amber,
  Anomaly: PALETTE.rose,
};

export const DRONE_COLORS = [PALETTE.amber, PALETTE.cyan, PALETTE.blue, PALETTE.violet, PALETTE.rose];

export const ANIM = { animationDuration: 750, animationEasing: "ease-out" as const };

export function useChartTheme() {
  const { dark } = useTheme();
  return {
    dark,
    grid: dark ? "rgba(148,163,184,0.08)" : "rgba(100,116,139,0.12)",
    axis: dark ? "#94a3b8" : "#64748b",
    axisLine: dark ? "rgba(148,163,184,0.18)" : "rgba(100,116,139,0.22)",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#64748b",
    cursor: dark ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.25)",
    reference: dark ? "#f8fafc" : "#0f172a",
    tickStyle: { fontSize: 11, fill: dark ? "#94a3b8" : "#64748b", fontFamily: "JetBrains Mono, monospace" },
  };
}

/* ---------------- Tooltip ---------------- */

export interface TooltipItem {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
  unit?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  labelFormatter?: (label: string | number | undefined, payload: TooltipItem[]) => ReactNode;
  valueFormatter?: (value: number, name: string, item: TooltipItem) => ReactNode;
  hideLabel?: boolean;
  footer?: (payload: TooltipItem[]) => ReactNode;
}

export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter, hideLabel, footer }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.filter((p) => p.value !== undefined && p.value !== null);
  if (!items.length) return null;
  return (
    <div className="min-w-[170px] rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-blue-500/25 dark:bg-[#0c1220]/95 dark:shadow-[0_16px_36px_rgba(0,0,0,0.65)]">
      {!hideLabel && (
        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
          <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-700 dark:text-slate-200">
            {labelFormatter ? labelFormatter(label, items) : label}
          </p>
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
        </div>
      )}
      <ul className="space-y-1.5">
        {items.map((it, i) => {
          const numeric = typeof it.value === "number" ? it.value : Number(it.value);
          const name = String(it.name ?? it.dataKey ?? "");
          return (
            <li key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="inline-block h-2 w-2 rounded-full ring-1 ring-white/20" style={{ backgroundColor: it.color }} />
                {name}
              </span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {valueFormatter
                  ? valueFormatter(numeric, name, it)
                  : Number.isFinite(numeric)
                    ? numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })
                    : String(it.value)}
                {!valueFormatter && it.unit && <span className="ml-0.5 text-slate-400">{it.unit}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {footer && (
        <div className="mt-2 border-t border-slate-200/70 pt-1.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {footer(items)}
        </div>
      )}
    </div>
  );
}

/* ---------------- Legend ---------------- */

export interface LegendItem {
  value?: string | number;
  color?: string;
  type?: string;
  payload?: { strokeDasharray?: string | number; fill?: string; stroke?: string } & Record<string, unknown>;
}

export function ChartLegend({ payload, align = "center" }: { payload?: LegendItem[]; align?: "center" | "left" }) {
  if (!payload?.length) return null;
  return (
    <ul className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 ${align === "center" ? "justify-center" : ""}`}>
      {payload.map((p, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color ?? p.payload?.fill ?? p.payload?.stroke ?? PALETTE.slate }}
          />
          {String(p.value ?? "")}
        </li>
      ))}
    </ul>
  );
}

export function LegendRow({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.dashed ? (
            <span className="inline-block h-0 w-3 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function EmptyChart({ message = "No data points in this range" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 p-6 text-center text-xs text-slate-400 dark:text-slate-500">
      <div className="h-8 w-8 rounded-full border border-dashed border-slate-300 dark:border-slate-700" />
      <p>{message}</p>
    </div>
  );
}
