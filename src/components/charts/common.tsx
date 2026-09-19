import type { ReactNode } from "react";
import { useTheme } from "../../hooks/useTheme";

export const PALETTE = {
  blue: "#337dff",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  slate: "#64748b",
  pink: "#ec4899",
  lime: "#84cc16",
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

export const ANIM = { animationDuration: 700, animationEasing: "ease-out" as const };

export function useChartTheme() {
  const { dark } = useTheme();
  return {
    dark,
    grid: dark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.14)",
    axis: dark ? "#94a3b8" : "#64748b",
    axisLine: dark ? "rgba(148,163,184,0.25)" : "rgba(100,116,139,0.25)",
    text: dark ? "#e2e8f0" : "#0f172a",
    muted: dark ? "#94a3b8" : "#64748b",
    cursor: dark ? "rgba(148,163,184,0.25)" : "rgba(100,116,139,0.3)",
    reference: dark ? "#f8fafc" : "#0f172a",
    tickStyle: { fontSize: 11, fill: dark ? "#94a3b8" : "#64748b" },
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
    <div className="min-w-[160px] rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-xs shadow-xl shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/40">
      {!hideLabel && (
        <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-200">
          {labelFormatter ? labelFormatter(label, items) : label}
        </p>
      )}
      <ul className="space-y-1">
        {items.map((it, i) => {
          const numeric = typeof it.value === "number" ? it.value : Number(it.value);
          const name = String(it.name ?? it.dataKey ?? "");
          return (
            <li key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} />
                {name}
              </span>
              <span className="font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
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
      {footer && <div className="mt-2 border-t border-slate-200/70 pt-1.5 text-slate-500 dark:border-slate-700 dark:text-slate-400">{footer(items)}</div>}
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

/* ---------------- Empty state ---------------- */

export function EmptyChart({ message = "No data for the selected filters" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
      <div className="h-10 w-10 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700" />
      <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
