import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FlaskConical,
  Gauge,
  Radar,
  Search,
  Zap,
  Activity,
  Calendar,
} from "lucide-react";
import type { CollisionRecord } from "../data/generateData";
import { fmt, fmtDateTime } from "../lib/format";
import { Badge, Button, Card, CardHeader, type Tone } from "./ui";
import { cn } from "../utils/cn";

type SortDir = "asc" | "desc";

interface Column {
  key: string;
  label: string;
  numeric?: boolean;
  hideBelow?: "sm" | "md" | "lg" | "xl";
  value: (r: CollisionRecord) => number | string;
  render?: (r: CollisionRecord) => ReactNode;
}

const typeTone: Record<CollisionRecord["type"], Tone> = {
  Elastic: "emerald",
  "Partially Inelastic": "blue",
  "Perfectly Inelastic": "amber",
};
const statusTone: Record<CollisionRecord["status"], Tone> = {
  Nominal: "emerald",
  Warning: "amber",
  Anomaly: "rose",
};

const COLUMNS: Column[] = [
  {
    key: "id",
    label: "Test ID",
    value: (r) => r.id,
    render: (r) => (
      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{r.id}</span>
    ),
  },
  {
    key: "timestamp",
    label: "Date & Time",
    value: (r) => r.timestamp,
    render: (r) => (
      <span className="whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
        {fmtDateTime(r.timestamp)}
      </span>
    ),
  },
  {
    key: "drones",
    label: "Drones (A → B)",
    value: (r) => `${r.droneA} ${r.droneB}`,
    render: (r) => (
      <span className="whitespace-nowrap">
        <span className="font-medium text-slate-800 dark:text-slate-200">{r.droneA}</span>
        <span className="mx-1 text-slate-400">→</span>
        <span className="font-medium text-slate-800 dark:text-slate-200">{r.droneB}</span>
      </span>
    ),
  },
  {
    key: "arena",
    label: "Arena",
    hideBelow: "xl",
    value: (r) => r.arena,
    render: (r) => (
      <span className="whitespace-nowrap text-slate-600 dark:text-slate-400">{r.arena}</span>
    ),
  },
  {
    key: "type",
    label: "Regime",
    value: (r) => r.type,
    render: (r) => <Badge tone={typeTone[r.type]}>{r.type}</Badge>,
  },
  {
    key: "closingSpeed",
    label: "Closing (m/s)",
    numeric: true,
    value: (r) => r.closingSpeed,
    render: (r) => (
      <span className="font-mono tabular-nums">
        {fmt(r.closingSpeed, 2)} <span className="text-[10px] text-slate-400">m/s</span>
      </span>
    ),
  },
  {
    key: "e",
    label: "Restitution e",
    numeric: true,
    hideBelow: "md",
    value: (r) => r.e,
    render: (r) => <span className="font-mono tabular-nums">{fmt(r.e, 2)}</span>,
  },
  {
    key: "pBefore",
    label: "Σp (kg·m/s)",
    numeric: true,
    hideBelow: "md",
    value: (r) => r.pBefore,
    render: (r) => (
      <span className="font-mono tabular-nums">
        {fmt(r.pBefore, 2)} <span className="text-[10px] text-slate-400">kg·m/s</span>
      </span>
    ),
  },
  {
    key: "keLossPct",
    label: "KE lost",
    numeric: true,
    value: (r) => r.keLossPct,
    render: (r) => (
      <span className="flex items-center justify-end gap-2">
        <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-slate-200 sm:block dark:bg-slate-800">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-rose-500 transition-all duration-500"
            style={{ width: `${Math.min(100, r.keLossPct)}%` }}
          />
        </span>
        <span className="font-mono tabular-nums font-medium">
          {fmt(r.keLossPct, 1)} <span className="text-[10px] text-slate-400">%</span>
        </span>
      </span>
    ),
  },
  {
    key: "peakForce",
    label: "Peak Force",
    numeric: true,
    hideBelow: "sm",
    value: (r) => r.peakForce,
    render: (r) => (
      <span className="font-mono tabular-nums">
        {fmt(r.peakForce, 0)} <span className="text-[10px] text-slate-400">N</span>
      </span>
    ),
  },
  {
    key: "pError",
    label: "Δp error",
    numeric: true,
    value: (r) => Math.abs(r.pError),
    render: (r) => (
      <span
        className={cn(
          "font-mono tabular-nums",
          Math.abs(r.pError) >= 3
            ? "text-rose-600 dark:text-rose-400 font-semibold"
            : Math.abs(r.pError) >= 1.5
              ? "text-amber-600 dark:text-amber-400"
              : "text-slate-600 dark:text-slate-400",
        )}
      >
        {r.pError > 0 ? "+" : ""}
        {fmt(r.pError, 2)}%
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    value: (r) => r.status,
    render: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge>,
  },
];

const hideCls: Record<NonNullable<Column["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

function toCsv(rows: CollisionRecord[]) {
  const keys = Object.keys(rows[0] ?? {}) as (keyof CollisionRecord)[];
  const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

export function DataTable({ records, onLoad }: { records: CollisionRecord[]; onLoad: (r: CollisionRecord) => void }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("All");

  const filtered = useMemo(() => {
    let base = records;
    if (typeFilter !== "All") {
      base = base.filter((r) => r.type === typeFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      base = base.filter((r) =>
        [r.id, r.droneA, r.droneB, r.arena, r.type, r.status, r.operator].some((s) => s.toLowerCase().includes(q)),
      );
    }
    const col = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[1];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [records, query, sortKey, sortDir, typeFilter]);

  useEffect(() => setPage(0), [query, sortKey, sortDir, typeFilter, records, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: string, numeric?: boolean) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(numeric ? "desc" : "asc");
    }
  };

  const exportCsv = () => {
    if (!filtered.length) return;
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collision-tests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="animate-fade-up">
      <CardHeader
        title="Collision incident test log"
        subtitle={`${filtered.length.toLocaleString()} record${filtered.length === 1 ? "" : "s"} · click any row to expand telemetry details or load into the lab`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search test, drone, arena…"
                className="h-9 w-44 rounded-lg border border-slate-200/80 bg-white/90 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 sm:w-56 dark:border-slate-700/80 dark:bg-[#0c1220] dark:text-slate-100"
              />
            </label>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">CSV</span>
            </Button>
          </div>
        }
      />

      {/* Filter and Quick-Sort Pill Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-1 dark:border-slate-800/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Regime:
          </span>
          {["All", "Elastic", "Partially Inelastic", "Perfectly Inelastic"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "rounded-full px-2.5 py-0.5 font-mono text-[11px] transition-colors",
                typeFilter === t
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Sort:
          </span>
          {[
            { key: "timestamp", label: "Date" },
            { key: "keLossPct", label: "Energy Lost" },
            { key: "closingSpeed", label: "Closing Speed" },
            { key: "peakForce", label: "Peak Force" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => toggleSort(s.key, s.key !== "timestamp")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] transition-colors",
                sortKey === s.key
                  ? "bg-slate-900 text-white dark:bg-slate-700 dark:text-white"
                  : "bg-slate-100 text-slate-500 hover:text-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-slate-200",
              )}
            >
              {s.label}
              {sortKey === s.key && (
                sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-[#0b101e]/60 dark:text-slate-400">
              <th className="w-8 px-3 py-2.5" />
              {COLUMNS.map((c) => {
                const active = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 font-medium",
                      c.numeric ? "text-right" : "text-left",
                      c.hideBelow && hideCls[c.hideBelow],
                    )}
                  >
                    <button
                      onClick={() => toggleSort(c.key, c.numeric)}
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-slate-900 dark:hover:text-white",
                        c.numeric && "flex-row-reverse",
                        active && "text-brand-600 dark:text-brand-400 font-semibold",
                      )}
                    >
                      {c.label}
                      {active ? (
                        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />
                      )}
                    </button>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Radar className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No collision telemetry found
                    </p>
                    <p className="text-xs text-slate-400">
                      Adjust your filters or run a test to see incident data appear here.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isExpanded = expandedId === r.id;
                return (
                  <tr key={r.id} className="group border-b border-slate-100 transition-colors dark:border-slate-800/60">
                    <td colSpan={COLUMNS.length + 2} className="p-0">
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className={cn(
                          "flex cursor-pointer items-center py-2.5 px-3 transition-colors",
                          isExpanded
                            ? "bg-brand-50/50 dark:bg-brand-500/10"
                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40",
                        )}
                      >
                        <div className="w-8 shrink-0 text-slate-400">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </div>
                        <div className="grid flex-1 grid-cols-12 items-center gap-2 text-slate-700 dark:text-slate-300">
                          <div className="col-span-2">{COLUMNS[0].render!(r)}</div>
                          <div className="col-span-2">{COLUMNS[1].render!(r)}</div>
                          <div className="col-span-2">{COLUMNS[2].render!(r)}</div>
                          <div className="col-span-2">{COLUMNS[4].render!(r)}</div>
                          <div className="col-span-2 text-right">{COLUMNS[5].render!(r)}</div>
                          <div className="col-span-2 text-right">{COLUMNS[8].render!(r)}</div>
                        </div>
                        <div className="ml-3 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLoad(r);
                            }}
                            className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400"
                          >
                            <FlaskConical className="h-3 w-3" /> Replay
                          </Button>
                        </div>
                      </div>

                      {/* Expandable Accordion Detail Panel */}
                      {isExpanded && (
                        <div className="border-t border-brand-100/60 bg-brand-50/20 px-6 py-4 dark:border-brand-500/20 dark:bg-[#0c1322]">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Velocities Before / After */}
                            <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-[#0f172a]/70">
                              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                <Gauge className="h-3 w-3 text-brand-500" /> Velocity Exchange
                              </div>
                              <div className="mt-2 space-y-1 font-mono text-xs">
                                <p className="flex justify-between">
                                  <span className="text-slate-500">Drone A (u₁ → v₁):</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {fmt(r.uA, 2)} → {fmt(r.vA, 2)} m/s
                                  </span>
                                </p>
                                <p className="flex justify-between">
                                  <span className="text-slate-500">Drone B (u₂ → v₂):</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {fmt(r.uB, 2)} → {fmt(r.vB, 2)} m/s
                                  </span>
                                </p>
                                <p className="flex justify-between border-t border-slate-100 pt-1 text-[11px] dark:border-slate-800">
                                  <span className="text-slate-400">Separation Speed:</span>
                                  <span className="text-brand-600 dark:text-brand-400">
                                    {fmt(r.separationSpeed, 2)} m/s
                                  </span>
                                </p>
                              </div>
                            </div>

                            {/* Momentum Balance */}
                            <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-[#0f172a]/70">
                              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                <Activity className="h-3 w-3 text-violet-500" /> Momentum Conservation
                              </div>
                              <div className="mt-2 space-y-1 font-mono text-xs">
                                <p className="flex justify-between">
                                  <span className="text-slate-500">System p Before:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {fmt(r.pBefore, 3)} kg·m/s
                                  </span>
                                </p>
                                <p className="flex justify-between">
                                  <span className="text-slate-500">System p After:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {fmt(r.pAfter, 3)} kg·m/s
                                  </span>
                                </p>
                                <p className="flex justify-between border-t border-slate-100 pt-1 text-[11px] dark:border-slate-800">
                                  <span className="text-slate-400">Measurement Δp:</span>
                                  <span
                                    className={cn(
                                      "font-semibold",
                                      Math.abs(r.pError) > 3 ? "text-rose-500" : "text-emerald-500",
                                    )}
                                  >
                                    {fmt(r.pError, 2)}%
                                  </span>
                                </p>
                              </div>
                            </div>

                            {/* Energy Dissipation */}
                            <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-[#0f172a]/70">
                              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                <Zap className="h-3 w-3 text-amber-500" /> Energy Budget
                              </div>
                              <div className="mt-2 space-y-1 font-mono text-xs">
                                <p className="flex justify-between">
                                  <span className="text-slate-500">KE Before:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {fmt(r.keBefore, 1)} J
                                  </span>
                                </p>
                                <p className="flex justify-between">
                                  <span className="text-slate-500">KE After:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {fmt(r.keAfter, 1)} J
                                  </span>
                                </p>
                                <p className="flex justify-between border-t border-slate-100 pt-1 text-[11px] dark:border-slate-800">
                                  <span className="text-slate-400">Dissipated Loss:</span>
                                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                                    {fmt(r.keLoss, 1)} J ({fmt(r.keLossPct, 1)}%)
                                  </span>
                                </p>
                              </div>
                            </div>

                            {/* Impact Loads & Facility */}
                            <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-[#0f172a]/70">
                              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                <Calendar className="h-3 w-3 text-cyan-500" /> Test Meta & Loads
                              </div>
                              <div className="mt-2 space-y-1 font-mono text-xs">
                                <p className="flex justify-between">
                                  <span className="text-slate-500">Peak Contact Load:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {fmt(r.peakForce, 0)} N
                                  </span>
                                </p>
                                <p className="flex justify-between">
                                  <span className="text-slate-500">Contact Duration:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {r.contactMs} ms
                                  </span>
                                </p>
                                <p className="flex justify-between border-t border-slate-100 pt-1 text-[11px] text-slate-400 dark:border-slate-800">
                                  <span>Operator:</span>
                                  <span className="text-slate-700 dark:text-slate-300">{r.operator}</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2 text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
                            <span>Facility: {r.arena} · Restitution e = {fmt(r.e, 3)}</span>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => onLoad(r)}
                              className="text-xs"
                            >
                              <FlaskConical className="h-3.5 w-3.5" /> Open Full Physics Replay
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
        <div>
          Showing <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{filtered.length ? page * pageSize + 1 : 0}</span> to{" "}
          <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
            {Math.min((page + 1) * pageSize, filtered.length)}
          </span>{" "}
          of <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{filtered.length}</span> tests
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </Button>
          <span className="font-mono">
            {page + 1} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
