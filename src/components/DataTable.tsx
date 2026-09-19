import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, FlaskConical, Search } from "lucide-react";
import type { CollisionRecord } from "../data/generateData";
import { fmt, fmtDateTime } from "../lib/format";
import { Badge, Button, Card, CardHeader, Select, type Tone } from "./ui";
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
const statusTone: Record<CollisionRecord["status"], Tone> = { Nominal: "emerald", Warning: "amber", Anomaly: "rose" };

const COLUMNS: Column[] = [
  { key: "id", label: "Test", value: (r) => r.id, render: (r) => <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{r.id}</span> },
  { key: "timestamp", label: "Date", value: (r) => r.timestamp, render: (r) => <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">{fmtDateTime(r.timestamp)}</span> },
  {
    key: "drones",
    label: "Drones (A → B)",
    value: (r) => `${r.droneA} ${r.droneB}`,
    render: (r) => (
      <span className="whitespace-nowrap">
        <span className="font-medium text-slate-800 dark:text-slate-100">{r.droneA}</span>
        <span className="mx-1 text-slate-400">→</span>
        <span className="font-medium text-slate-800 dark:text-slate-100">{r.droneB}</span>
      </span>
    ),
  },
  { key: "arena", label: "Arena", hideBelow: "xl", value: (r) => r.arena, render: (r) => <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">{r.arena}</span> },
  { key: "type", label: "Regime", value: (r) => r.type, render: (r) => <Badge tone={typeTone[r.type]}>{r.type}</Badge> },
  { key: "massA", label: "m₁ / m₂ (kg)", numeric: true, hideBelow: "lg", value: (r) => r.massA + r.massB, render: (r) => <span className="font-mono tabular-nums">{fmt(r.massA, 2)} / {fmt(r.massB, 2)}</span> },
  { key: "uA", label: "u₁ / u₂ (m/s)", numeric: true, hideBelow: "lg", value: (r) => r.uA, render: (r) => <span className="font-mono tabular-nums">{fmt(r.uA, 1)} / {fmt(r.uB, 1)}</span> },
  { key: "closingSpeed", label: "Closing (m/s)", numeric: true, value: (r) => r.closingSpeed, render: (r) => <span className="font-mono tabular-nums">{fmt(r.closingSpeed, 2)}</span> },
  { key: "e", label: "e", numeric: true, hideBelow: "md", value: (r) => r.e, render: (r) => <span className="font-mono tabular-nums">{fmt(r.e, 2)}</span> },
  { key: "pBefore", label: "Σp (kg·m/s)", numeric: true, hideBelow: "md", value: (r) => r.pBefore, render: (r) => <span className="font-mono tabular-nums">{fmt(r.pBefore, 2)}</span> },
  {
    key: "keLossPct",
    label: "KE lost",
    numeric: true,
    value: (r) => r.keLossPct,
    render: (r) => (
      <span className="flex items-center justify-end gap-2">
        <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-slate-200 sm:block dark:bg-slate-700">
          <span className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-rose-500 transition-all duration-500" style={{ width: `${Math.min(100, r.keLossPct)}%` }} />
        </span>
        <span className="font-mono tabular-nums">{fmt(r.keLossPct, 1)}%</span>
      </span>
    ),
  },
  { key: "peakForce", label: "Peak F (N)", numeric: true, hideBelow: "sm", value: (r) => r.peakForce, render: (r) => <span className="font-mono tabular-nums">{fmt(r.peakForce, 0)}</span> },
  {
    key: "pError",
    label: "Δp meas.",
    numeric: true,
    value: (r) => Math.abs(r.pError),
    render: (r) => <span className={cn("font-mono tabular-nums", Math.abs(r.pError) >= 3 ? "text-rose-600 dark:text-rose-400" : Math.abs(r.pError) >= 1.5 ? "text-amber-600 dark:text-amber-400" : "")}>{r.pError > 0 ? "+" : ""}{fmt(r.pError, 2)}%</span>,
  },
  { key: "status", label: "Status", value: (r) => r.status, render: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge> },
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? records.filter((r) =>
          [r.id, r.droneA, r.droneB, r.arena, r.type, r.status, r.operator].some((s) => s.toLowerCase().includes(q)),
        )
      : records;
    const col = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[1];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [records, query, sortKey, sortDir]);

  useEffect(() => setPage(0), [query, sortKey, sortDir, records, pageSize]);

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
        title="Collision test log"
        subtitle={`${filtered.length.toLocaleString()} record${filtered.length === 1 ? "" : "s"} · click a column to sort · click a row to load it in the lab`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search id, drone, arena…"
                className="h-9 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 sm:w-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <Button variant="outline" size="md" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
            </Button>
          </div>
        }
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              {COLUMNS.map((c) => {
                const active = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn("whitespace-nowrap px-3 py-2.5 font-medium", c.numeric ? "text-right" : "text-left", c.hideBelow && hideCls[c.hideBelow])}
                  >
                    <button
                      onClick={() => toggleSort(c.key, c.numeric)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded transition-colors hover:text-slate-900 dark:hover:text-white",
                        c.numeric && "flex-row-reverse",
                        active && "text-brand-600 dark:text-brand-400",
                      )}
                    >
                      {c.label}
                      {active ? (
                        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </th>
                );
              })}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-3 py-12 text-center text-sm text-slate-500">
                  No tests match the current filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onLoad(r)}
                className="group cursor-pointer border-b border-slate-100 transition-colors hover:bg-brand-50/60 dark:border-slate-800/80 dark:hover:bg-brand-500/10"
              >
                {COLUMNS.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2.5 text-slate-700 dark:text-slate-300", c.numeric ? "text-right" : "text-left", c.hideBelow && hideCls[c.hideBelow])}>
                    {c.render ? c.render(r) : c.value(r)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-400">
                    <FlaskConical className="h-3 w-3" /> Load
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            Page <span className="font-semibold text-slate-800 dark:text-slate-200">{page + 1}</span> of {pageCount}
          </span>
          <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="w-28">
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
