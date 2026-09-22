import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "./hooks/useTheme";
import { useHashRoute, type Route } from "./hooks/useHashRoute";
import { generateRecords, type CollisionRecord } from "./data/generateData";
import {
  applyDateRange,
  applyFilters,
  applySegmentFilters,
  computeKpis,
  defaultFilters,
  previousRange,
  timeSeries,
  type Filters,
} from "./lib/analytics";
import type { LabConfig } from "./lib/physics";
import { dayDiff, fromISODate, toISODate, fmtDateTime } from "./lib/format";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { KpiGrid } from "./components/KpiGrid";
import {
  ArenaBars,
  CollisionsByPeriod,
  DroneModelBars,
  EnergyDonut,
  FleetPhaseSpace,
  ForceTrend,
  MomentumEnergyTrend,
  StatusDonut,
  TypeDonut,
  VelocityChart,
} from "./components/charts/OverviewCharts";
import { Simulator } from "./components/lab/Simulator";
import { CollisionPhysicsModule } from "./components/sim/CollisionPhysicsModule";
import { MissionControlView } from "./components/mission/MissionControlView";
import { DataTable } from "./components/DataTable";
import { UploadPage } from "./components/upload/UploadPage";
import { Card, CardHeader, SectionHeading, Badge, Button } from "./components/ui";
import { TelemetryBackdrop } from "./components/TelemetryBackdrop";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FileJson,
  Radar,
  RefreshCw,
  Settings2,
  Share2,
  ShieldCheck,
  SunMedium,
  MoonStar,
} from "lucide-react";

const DEFAULT_LAB: LabConfig = {
  m1: 1.6,
  u1: 9,
  m2: 2.2,
  u2: -5,
  e: 0.6,
  e1: 0.77,
  e2: 0.78,
  r1: 0.28,
  r2: 0.32,
  i1: 0.056,
  i2: 0.101,
  w1: 20,
  w2: -15,
  contactMs: 60,
  tTotal: 1.6,
  impactOffset: 0,
  mode: "e",
  target: 0,
};

const routeMeta: Record<Route, { label: string; description: string }> = {
  overview: { label: "Live Test", description: "Fleet collision analytics and live event stream" },
  "test-log": { label: "Test Log / History", description: "Search, sort, and inspect every recorded impact" },
  "compare-runs": { label: "Compare Runs", description: "Overlay multiple test runs side-by-side" },
  settings: { label: "Settings", description: "Theme, telemetry preferences, and app controls" },
  "collision-physics": { label: "Collision Physics", description: "Model preview and impact analysis" },
  "collision-lab": { label: "Collision Lab", description: "Replay and adjust test conditions in the simulator" },
  upload: { label: "MATLAB Import", description: "Import campaign data from external sources" },
};

function PageHeader({ route }: { route: Route }) {
  const meta = routeMeta[route];
  return (
    <div className="flex flex-col gap-2 pb-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
          Dashboard
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{meta.label}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meta.description}</p>
      </div>
      <Badge tone="slate" className="w-fit px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide">
        {route}
      </Badge>
    </div>
  );
}

function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
        <Radar className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5 min-h-[44px] px-4">
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}

function ErrorState({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="primary" className="mt-5 min-h-[44px] px-4">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      )}
    </Card>
  );
}

function exportFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsvRecord(record: CollisionRecord) {
  const values = [
    record.id,
    new Date(record.timestamp).toISOString(),
    record.droneA,
    record.droneB,
    record.arena,
    record.type,
    record.status,
    record.closingSpeed,
    record.e,
    record.pBefore,
    record.keLossPct,
    record.peakForce,
  ];
  return values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
}

function tryShareLink(recordId: string) {
  const url = `${window.location.origin}${window.location.pathname}#/test-log?run=${encodeURIComponent(recordId)}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).catch(() => {});
  }
  return url;
}

function OverviewPage({ records, filters, onLoad }: { records: CollisionRecord[]; filters: Filters; onLoad: (r: CollisionRecord) => void }) {
  const [logExpanded, setLogExpanded] = useState(false);
  const segmented = useMemo(() => applySegmentFilters(records, filters), [records, filters]);
  const current = useMemo(() => applyDateRange(segmented, filters.from, filters.to), [segmented, filters.from, filters.to]);
  const prevRange = useMemo(() => previousRange(filters.from, filters.to), [filters.from, filters.to]);
  const previous = useMemo(() => applyDateRange(segmented, prevRange.from, prevRange.to), [segmented, prevRange]);
  const { granularity, points } = useMemo(() => timeSeries(current, filters.from, filters.to), [current, filters.from, filters.to]);
  const kpis = useMemo(() => computeKpis(current), [current]);
  const prevKpis = useMemo(() => computeKpis(previous), [previous]);
  const rangeDays = dayDiff(fromISODate(filters.from), fromISODate(filters.to)) + 1;

  return (
    <div className="space-y-6 pt-2">
      <SectionHeading
        eyebrow="Mission Telemetry"
        title="Fleet collision analytics"
        description="Linear & angular momentum conservation, energy dissipation, and impact loads across every recorded drone collision test."
        action={
          <Badge tone="cyan" className="px-3 py-1 font-mono text-xs">
            <Radar className="h-3.5 w-3.5 animate-pulse" /> {current.length} Incident Telemetries
          </Badge>
        }
      />

      <KpiGrid current={kpis} previous={prevKpis} points={points} rangeDays={rangeDays} />

      {current.length === 0 ? (
        <EmptyState
          title="No Collision Data in Current Filter Window"
          description="Run a collision test in the Collision Lab or adjust your date range and segment filters to see telemetry signals appear here."
          actionLabel="Run your first test"
          onAction={() => window.location.hash = "/collision-lab"}
        />
      ) : (
        <div className="grid grid-cols-12 gap-4 mobile-chart-grid">
          <div className="col-span-12 xl:col-span-8">
            <MomentumEnergyTrend points={points} granularity={granularity} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <TypeDonut records={current} />
          </div>

          <div className="col-span-12 xl:col-span-8">
            <CollisionsByPeriod records={current} from={filters.from} to={filters.to} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <EnergyDonut records={current} />
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <VelocityChart points={points} granularity={granularity} />
          </div>
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <ForceTrend points={points} granularity={granularity} />
          </div>
          <div className="col-span-12 md:col-span-12 xl:col-span-4">
            <StatusDonut records={current} />
          </div>

          <div className="col-span-12 xl:col-span-8">
            <FleetPhaseSpace records={current} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <ArenaBars records={current} />
          </div>

          <div className="col-span-12">
            <DroneModelBars records={current} />
          </div>
        </div>
      )}

      <Card className="overflow-hidden transition-all duration-300">
        <div
          onClick={() => setLogExpanded((prev) => !prev)}
          className="flex cursor-pointer items-center justify-between gap-3 p-5 transition-colors hover:bg-slate-50/70 dark:hover:bg-[#0f172a]/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Collision Incident Test Log</h3>
                <Badge tone="slate" className="font-mono text-[10px]">{current.length} runs</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {logExpanded ? "Click to collapse the test log preview" : "Click to expand full incident telemetry details, measurements & replay triggers"}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1 text-xs min-h-[44px]">
            {logExpanded ? (
              <>
                Collapse <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Expand Log <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>

        {logExpanded && (
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <DataTable records={current} onLoad={onLoad} />
          </div>
        )}
      </Card>
    </div>
  );
}

function TestLogPage({ records, filters, onLoad }: { records: CollisionRecord[]; filters: Filters; onLoad: (r: CollisionRecord) => void }) {
  const current = useMemo(() => applyFilters(records, filters), [records, filters]);
  return (
    <div className="space-y-6 pt-2">
      <SectionHeading
        eyebrow="Telemetry Log"
        title="Full test incident archive"
        description="Raw per-test measurements. Sorting, searching, and expandable row accordions compose. Click any row to replay that exact collision in the Collision Lab."
      />
      <DataTable records={current} onLoad={onLoad} />
    </div>
  );
}

function CompareRunsPage({ records }: { records: CollisionRecord[] }) {
  const recent = useMemo(() => [...records].sort((a, b) => b.timestamp - a.timestamp), [records]);
  const [metric, setMetric] = useState<"momentum" | "keLoss" | "closingSpeed">("momentum");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (selectedIds.length === 0 && recent.length > 0) {
      setSelectedIds(recent.slice(0, 3).map((r) => r.id));
    }
  }, [recent, selectedIds]);

  const selected = recent.filter((r) => selectedIds.includes(r.id)).slice(0, 3);
  const colors = ["#3b82f6", "#f59e0b", "#22c55e"];

  const chartData = selected.length
    ? selected[0]
      ? recent
          .filter((r) => selectedIds.includes(r.id))
          .map((r) => ({
            id: r.id,
            label: r.id,
            momentum: Math.abs(r.pBefore),
            keLoss: r.keLossPct,
            closingSpeed: r.closingSpeed,
          }))
      : []
    : [];

  const updateSelected = (id: string, slot: number) => {
    const next = [...selectedIds];
    next[slot] = id;
    setSelectedIds(next.filter(Boolean));
  };

  return (
    <div className="space-y-6 pt-2">
      <SectionHeading
        eyebrow="Run comparison"
        title="Overlay impact outcomes across selected runs"
        description="Compare momentum, energy loss, and impact severity side by side with distinct colors and a shared axis."
      />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2" aria-label="Compare metrics">
            {[
              { value: "momentum", label: "Momentum" },
              { value: "keLoss", label: "KE loss" },
              { value: "closingSpeed", label: "Closing speed" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-label={`Show ${opt.label} comparison`}
                onClick={() => setMetric(opt.value as typeof metric)}
                className={cn(
                  "min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  metric === opt.value ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 3 }).map((_, slot) => (
              <label key={slot} className="flex min-w-[160px] flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                Run {slot + 1}
                <select
                  aria-label={`Select comparison run ${slot + 1}`}
                  value={selectedIds[slot] ?? ""}
                  onChange={(e) => updateSelected(e.target.value, slot)}
                  className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-[#0d1424] dark:text-slate-100"
                >
                  <option value="">Choose a run</option>
                  {recent.slice(0, 12).map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.id} · {run.type}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Select at least two runs to compare"
              description="Choose up to three recent test runs and overlay their impact signatures on a shared axis."
            />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-[#0c1220]/70">
            <div className="h-[260px] w-full" aria-label="Comparison chart for selected runs">
              <svg viewBox="0 0 700 260" className="h-full w-full" role="img" aria-label={`Selected run comparison by ${metric}`}>
                <g>
                  {[0, 1, 2, 3].map((line) => (
                    <line key={line} x1="40" x2="660" y1={30 + line * 50} y2={30 + line * 50} stroke="rgba(148,163,184,0.25)" strokeDasharray="4 4" />
                  ))}
                </g>
                {chartData.map((point, idx) => {
                  const value = point[metric];
                  const x = 40 + idx * (620 / Math.max(1, chartData.length - 1));
                  const y = 220 - (value / Math.max(1, ...chartData.map((p) => p[metric]))) * 160;
                  return (
                    <g key={point.id}>
                      <circle cx={x} cy={y} r={5} fill={colors[idx % colors.length]} />
                      <text x={x} y={245} textAnchor="middle" fill="currentColor" fontSize="10" className="fill-slate-500 dark:fill-slate-400">
                        {point.id}
                      </text>
                    </g>
                  );
                })}
                {chartData.length > 1 && (
                  <polyline
                    points={chartData
                      .map((point, idx) => {
                        const value = point[metric];
                        const x = 40 + idx * (620 / Math.max(1, chartData.length - 1));
                        const y = 220 - (value / Math.max(1, ...chartData.map((p) => p[metric]))) * 160;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="rgba(59,130,246,0.9)"
                    strokeWidth="2.5"
                  />
                )}
              </svg>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {selected.map((run, idx) => (
            <div key={run.id} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{run.id}</p>
                  <h4 className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{run.droneA} vs {run.droneB}</h4>
                </div>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
              </div>

              <dl className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between"><dt>Type</dt><dd>{run.type}</dd></div>
                <div className="flex justify-between"><dt>KE loss</dt><dd>{run.keLossPct}%</dd></div>
                <div className="flex justify-between"><dt>Momentum</dt><dd>{Math.abs(run.pBefore).toFixed(2)}</dd></div>
                <div className="flex justify-between"><dt>Closing speed</dt><dd>{run.closingSpeed.toFixed(2)} m/s</dd></div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => exportFile(`${run.id}.csv`, `id,timestamp,droneA,droneB,type,keLossPct,pBefore,closingSpeed\n${toCsvRecord(run)}`, "text/csv;charset=utf-8")}>
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => exportFile(`${run.id}.json`, JSON.stringify(run, null, 2), "application/json;charset=utf-8")}>
                  <FileJson className="h-3.5 w-3.5" /> JSON
                </Button>
                <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => { tryShareLink(run.id); }}>
                  <Share2 className="h-3.5 w-3.5" /> Share
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SettingsPage() {
  const { dark, toggle, setDark } = useTheme();
  return (
    <div className="space-y-6 pt-2">
      <SectionHeading
        eyebrow="System settings"
        title="Telemetry workspace preferences"
        description="Keep the dashboard tuned for your workspace and preserve your chosen appearance between sessions."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              {dark ? <MoonStar className="h-5 w-5" /> : <SunMedium className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Theme</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Light and dark mode keep the same accent palette and persist automatically.</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Appearance</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Current: {dark ? "Dark" : "Light"}</p>
            </div>
            <Button onClick={toggle} variant="outline" className="min-h-[44px] px-3">
              {dark ? "Switch to light" : "Switch to dark"}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Workspace</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Keyboard-friendly, readable, and touch-enabled controls for mobile analysis.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
              <span>Focus rings</span>
              <Badge tone="emerald">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
              <span>Touch targets</span>
              <Badge tone="blue">44px+</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
              <span>Saved preference</span>
              <button onClick={() => setDark(!dark)} className="text-brand-600 underline-offset-4 hover:underline dark:text-brand-400">{dark ? "Dark saved" : "Light saved"}</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Dashboard() {
  const [records, setRecords] = useState<CollisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [route, navigate] = useHashRoute();
  const [lab, setLab] = useState<LabConfig>(DEFAULT_LAB);
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    preset: "30d",
    from: toISODate(new Date()),
    to: toISODate(new Date()),
    type: "All",
    drone: "All",
    arena: "All",
    status: "All",
  });

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    window.setTimeout(() => {
      try {
        const next = generateRecords();
        const minDate = next[0]?.date ?? toISODate(new Date());
        const base = { ...defaultFilters(minDate), preset: "30d", from: minDate, to: toISODate(new Date()) };
        setRecords(next);
        setFilters(base);
      } catch {
        setError("Unable to load telemetry data right now.");
      } finally {
        setLoading(false);
      }
    }, 480);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const minDate = records[0]?.date ?? toISODate(new Date());
  const maxDate = toISODate(new Date());
  const lastEventTime = useMemo(() => {
    const latest = records[records.length - 1];
    return latest ? fmtDateTime(latest.timestamp) : "2026-09-21 21:38 UTC";
  }, [records]);

  const segmented = useMemo(() => applySegmentFilters(records, filters), [records, filters]);
  const shownCount = useMemo(
    () => applyDateRange(segmented, filters.from, filters.to).length,
    [segmented, filters.from, filters.to],
  );

  const loadIntoLab = useCallback((r: CollisionRecord) => {
    const sq = Math.sqrt(Math.max(0, Math.min(1, r.e)));
    setLab({
      m1: r.massA,
      u1: r.uA,
      m2: r.massB,
      u2: r.uB,
      e: r.e,
      e1: sq,
      e2: sq,
      contactMs: r.contactMs,
      w1: 0,
      w2: 0,
      impactOffset: 0,
      mode: "e",
      target: 0,
    });
    setLoadedFrom(r.id);
    navigate("collision-lab");
  }, [navigate]);

  const setLabInput = useCallback((v: LabConfig) => {
    setLab(v);
    setLoadedFrom(null);
  }, []);

<<<<<<< HEAD
  const showFilters = route !== "upload" && route !== "collision-physics" && route !== "mission-control";
=======
  const showFilters = route !== "upload" && route !== "settings" && route !== "compare-runs";
>>>>>>> 8cab9acc23ecb6d4c7cc57c74fb1e3d817365e2f

  return (
    <div className="relative app-bg min-h-screen">
      <TelemetryBackdrop />
      <Header route={route} navigate={navigate} isLive={isLive} onToggleLive={() => setIsLive((p) => !p)} lastEventTime={lastEventTime} />
      <main className="relative z-10 mx-auto max-w-[1600px] px-4 pb-20 sm:px-6 lg:px-8">
        {showFilters && (
          <FilterBar
            filters={filters}
            onChange={setFilters}
            minDate={minDate}
            maxDate={maxDate}
            shown={shownCount}
            total={records.length}
            onReset={() => setFilters(defaultFilters(minDate))}
          />
        )}

<<<<<<< HEAD
        <div key={route} className="animate-fade-up">
          {route === "mission-control" && <MissionControlView />}
          {route === "overview" && <OverviewPage records={records} filters={filters} onLoad={loadIntoLab} />}
          {route === "collision-physics" && <CollisionPhysicsModule />}
          {route === "test-log" && <TestLogPage records={records} filters={filters} onLoad={loadIntoLab} />}
          {route === "collision-lab" && <Simulator value={lab} onChange={setLabInput} loadedFrom={loadedFrom} />}
          {route === "upload" && (
            <>
              <UploadPage />
              <Card className="mt-6">
                <CardHeader
                  title="Coming from the Collision Lab?"
                  subtitle="Uploaded runs are charted exactly as uploaded – use the column chips to focus on the signals you care about."
                />
              </Card>
            </>
          )}
        </div>
=======
        <PageHeader route={route} />

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState title="Telemetry feed unavailable" description={error} onRetry={loadData} />
        ) : (
          <div key={route} className="animate-fade-up">
            {route === "overview" && <OverviewPage records={records} filters={filters} onLoad={loadIntoLab} />}
            {route === "test-log" && <TestLogPage records={records} filters={filters} onLoad={loadIntoLab} />}
            {route === "compare-runs" && <CompareRunsPage records={records} />}
            {route === "settings" && <SettingsPage />}
            {route === "collision-lab" && <Simulator value={lab} onChange={setLabInput} loadedFrom={loadedFrom} />}
            {route === "upload" && (
              <>
                <UploadPage />
                <Card className="mt-6">
                  <CardHeader
                    title="Coming from the Collision Lab?"
                    subtitle="Uploaded runs are charted exactly as uploaded – use the column chips to focus on the signals you care about."
                  />
                </Card>
              </>
            )}
          </div>
        )}
>>>>>>> 8cab9acc23ecb6d4c7cc57c74fb1e3d817365e2f
      </main>

      <footer className="relative z-10 border-t border-slate-200/70 py-6 text-center text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
        Collision Drones &amp; Momentum Tracking · sample telemetry generated locally · physics: 1-D restitution &amp; rotational spin model
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Dashboard />
    </ThemeProvider>
  );
}
