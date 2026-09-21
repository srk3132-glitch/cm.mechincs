import { CalendarDays, RotateCcw, SlidersHorizontal } from "lucide-react";
import { ARENAS, COLLISION_TYPES, DRONE_MODELS, STATUSES } from "../data/generateData";
import { RANGE_PRESETS, rangeForPreset, type Filters, type RangePreset } from "../lib/analytics";
import { fmtDateLong, fromISODate } from "../lib/format";
import { Button, Segmented, Select } from "./ui";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  minDate: string;
  maxDate: string;
  shown: number;
  total: number;
  onReset: () => void;
}

const inputCls =
  "h-9 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 font-mono text-xs text-slate-800 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700/80 dark:bg-[#0d1424] dark:text-slate-100";

export function FilterBar({ filters, onChange, minDate, maxDate, shown, total, onReset }: Props) {
  const setPreset = (p: RangePreset) => onChange({ ...filters, preset: p, ...rangeForPreset(p, minDate, filters) });
  const setDate = (key: "from" | "to", value: string) => {
    if (!value) return;
    let from = key === "from" ? value : filters.from;
    let to = key === "to" ? value : filters.to;
    if (from > to) {
      if (key === "from") to = from;
      else from = to;
    }
    onChange({ ...filters, preset: "custom", from, to });
  };

  const isDefault =
    filters.preset === "30d" &&
    filters.type === "All" &&
    filters.drone === "All" &&
    filters.arena === "All" &&
    filters.status === "All";

  return (
    <div className="z-30 -mx-4 border-y border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl transition-colors sm:-mx-6 sm:px-6 lg:sticky lg:top-16 lg:-mx-8 lg:px-8 dark:border-slate-800/80 dark:bg-[#0a0f1d]/85 dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        {/* Date range */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <CalendarDays className="h-3 w-3" /> Date range
            </span>
            <Segmented
              value={filters.preset}
              onChange={setPreset}
              options={[...RANGE_PRESETS.map((r) => ({ value: r.key, label: r.label })), { value: "custom" as const, label: "Custom" }]}
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">From</span>
              <input
                type="date"
                className={inputCls}
                value={filters.from}
                min={minDate}
                max={maxDate}
                onChange={(e) => setDate("from", e.target.value)}
              />
            </label>
            <span className="pb-2.5 text-slate-400">→</span>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">To</span>
              <input
                type="date"
                className={inputCls}
                value={filters.to}
                min={minDate}
                max={maxDate}
                onChange={(e) => setDate("to", e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Segments */}
        <div className="flex flex-wrap items-end gap-2">
          <span className="hidden items-center gap-1 pb-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:flex dark:text-slate-400">
            <SlidersHorizontal className="h-3 w-3" /> Segments
          </span>
          <Select label="Collision type" value={filters.type} onChange={(e) => onChange({ ...filters, type: e.target.value as Filters["type"] })} className="min-w-[150px] flex-1 sm:flex-none">
            <option value="All">All types</option>
            {COLLISION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select label="Drone model" value={filters.drone} onChange={(e) => onChange({ ...filters, drone: e.target.value })} className="min-w-[140px] flex-1 sm:flex-none">
            <option value="All">All models</option>
            {DRONE_MODELS.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select label="Arena" value={filters.arena} onChange={(e) => onChange({ ...filters, arena: e.target.value })} className="min-w-[150px] flex-1 sm:flex-none">
            <option value="All">All arenas</option>
            {ARENAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select label="Status" value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value as Filters["status"] })} className="min-w-[120px] flex-1 sm:flex-none">
            <option value="All">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="md" onClick={onReset} disabled={isDefault} title="Reset filters" className="px-2.5">
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>
      <div className="mx-auto mt-2 flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{shown.toLocaleString()}</span> of{" "}
          {total.toLocaleString()} collision tests
        </span>
        <span className="hidden sm:inline">·</span>
        <span>
          {fmtDateLong(fromISODate(filters.from))} – {fmtDateLong(fromISODate(filters.to))}
        </span>
      </div>
    </div>
  );
}
