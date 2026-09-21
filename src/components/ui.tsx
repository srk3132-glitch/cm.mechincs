import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../utils/cn";
import { EmptyChart as EmptyChartBase } from "./charts/common";

export const EmptyChartPlaceholder = EmptyChartBase;

/* ---------------- Card ---------------- */

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-slate-200/80 bg-white/85 p-0 shadow-sm shadow-slate-200/50 backdrop-blur-md transition-all duration-200",
        "dark:border-slate-800/80 dark:bg-[#0f172a]/70 dark:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.55)] dark:backdrop-blur-xl dark:hover:border-brand-500/25",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:border before:border-transparent dark:before:border-white/[0.05]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------------- Section heading ---------------- */

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- Button ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "icon";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; active?: boolean }) {
  const variants: Record<Variant, string> = {
    primary:
      "bg-brand-600 text-white hover:bg-brand-500 shadow-md shadow-brand-500/25 dark:bg-brand-500 dark:hover:bg-brand-400 dark:shadow-brand-500/20",
    secondary:
      "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 dark:border dark:border-slate-700/60",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80",
    outline:
      "border border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800",
  };
  const sizes: Record<Size, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    icon: "h-9 w-9",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        active && "ring-2 ring-brand-500/50",
        className,
      )}
      {...props}
    />
  );
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-slate-200/60 bg-slate-100/90 p-0.5 text-xs font-medium dark:border-slate-800 dark:bg-[#0c1220]/90",
        className,
      )}
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 transition-all duration-200",
            o.value === value
              ? "bg-white text-slate-900 shadow-sm dark:bg-[#1e293b] dark:text-white dark:shadow-md dark:shadow-black/40"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Select ---------------- */

export function Select({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
      )}
      <span className="relative">
        <select
          className={cn(
            "h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white/90 pl-3 pr-8 text-sm text-slate-800",
            "transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30",
            "dark:border-slate-700/80 dark:bg-[#0d1424] dark:text-slate-100",
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

/* ---------------- Badge ---------------- */

export type Tone = "emerald" | "amber" | "rose" | "blue" | "violet" | "slate" | "cyan";

const toneClasses: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  blue: "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/30",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

export function Badge({ tone = "slate", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset backdrop-blur-sm",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- Stat tile ---------------- */

export function StatTile({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 px-3.5 py-3 shadow-sm backdrop-blur transition-all duration-200 hover:border-brand-500/30 dark:border-slate-800/80 dark:bg-[#0c1220]/75 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {accent && (
        <div
          className="absolute left-0 right-0 top-0 h-[2px] opacity-80"
          style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
        />
      )}
      <div className="flex items-center gap-1.5 pt-0.5">
        {accent && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">{unit}</span>}
      </p>
      {hint && <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}
