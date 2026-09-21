import { useCallback, useMemo, useState } from "react";
import { ThemeProvider } from "./hooks/useTheme";
import { useHashRoute } from "./hooks/useHashRoute";
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
import { DataTable } from "./components/DataTable";
import { UploadPage } from "./components/upload/UploadPage";
import { Card, CardHeader, SectionHeading, Badge, Button } from "./components/ui";
import { TelemetryBackdrop } from "./components/TelemetryBackdrop";
import { ChevronDown, ChevronUp, Database, Radar } from "lucide-react";

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

function OverviewPage({
  records,
  filters,
  onLoad,
}: {
  records: CollisionRecord[];
  filters: Filters;
  onLoad: (r: CollisionRecord) => void;
}) {
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
    <div className="space-y-6 pt-6">
      {/* Top Header & Visual Hierarchy Description */}
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

      {/* 1. TOP SUMMARY BAR (Live KPI Grid) */}
      <KpiGrid current={kpis} previous={prevKpis} points={points} rangeDays={rangeDays} />

      {/* 2. MAIN CHARTS AREA (12-Column Responsive Grid) */}
      {current.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Radar className="h-10 w-10 text-brand-500 animate-pulse" />
          <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">
            No Collision Data in Current Filter Window
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            Run a collision test in the Collision Lab or adjust your date range and segment filters to see telemetry signals appear here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Row 1: Momentum/Energy Area & Regime Donut */}
          <div className="col-span-12 xl:col-span-8">
            <MomentumEnergyTrend points={points} granularity={granularity} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <TypeDonut records={current} />
          </div>

          {/* Row 2: Collisions by Period & Energy Budget Donut */}
          <div className="col-span-12 xl:col-span-8">
            <CollisionsByPeriod records={current} from={filters.from} to={filters.to} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <EnergyDonut records={current} />
          </div>

          {/* Row 3: Velocity, Force Trend, and Conservation Status */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <VelocityChart points={points} granularity={granularity} />
          </div>
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <ForceTrend points={points} granularity={granularity} />
          </div>
          <div className="col-span-12 md:col-span-12 xl:col-span-4">
            <StatusDonut records={current} />
          </div>

          {/* Row 4: Fleet Phase Space with Motion Trails & Arena Load */}
          <div className="col-span-12 xl:col-span-8">
            <FleetPhaseSpace records={current} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <ArenaBars records={current} />
          </div>

          {/* Row 5: Drone Model Comparison */}
          <div className="col-span-12">
            <DroneModelBars records={current} />
          </div>
        </div>
      )}

      {/* 3. COLLAPSIBLE TEST LOG BELOW */}
      <Card className="overflow-hidden transition-all duration-300">
        <div
          onClick={() => setLogExpanded((prev) => !prev)}
          className="flex cursor-pointer items-center justify-between p-5 transition-colors hover:bg-slate-50/70 dark:hover:bg-[#0f172a]/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Collision Incident Test Log
                </h3>
                <Badge tone="slate" className="font-mono text-[10px]">
                  {current.length} runs
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {logExpanded
                  ? "Click to collapse the test log preview"
                  : "Click to expand full incident telemetry details, measurements & replay triggers"}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1 text-xs">
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

function TestLogPage({
  records,
  filters,
  onLoad,
}: {
  records: CollisionRecord[];
  filters: Filters;
  onLoad: (r: CollisionRecord) => void;
}) {
  const current = useMemo(() => applyFilters(records, filters), [records, filters]);
  return (
    <div className="space-y-6 pt-6">
      <SectionHeading
        eyebrow="Telemetry Log"
        title="Full test incident archive"
        description="Raw per-test measurements. Sorting, searching, and expandable row accordions compose. Click any row to replay that exact collision in the Collision Lab."
      />
      <DataTable records={current} onLoad={onLoad} />
    </div>
  );
}

function Dashboard() {
  const records = useMemo(() => generateRecords(), []);
  const minDate = records[0]?.date ?? toISODate(new Date());
  const maxDate = toISODate(new Date());
  const [route, navigate] = useHashRoute();
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(minDate));
  const [lab, setLab] = useState<LabConfig>(DEFAULT_LAB);
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Latest event timestamp formatted
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

  const showFilters = route !== "upload";

  return (
    <div className="relative app-bg min-h-screen">
      {/* Subtle ambient flight motion trails in background */}
      <TelemetryBackdrop />

      <Header
        route={route}
        navigate={navigate}
        isLive={isLive}
        onToggleLive={() => setIsLive((p) => !p)}
        lastEventTime={lastEventTime}
      />

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

        <div key={route} className="animate-fade-up">
          {route === "overview" && <OverviewPage records={records} filters={filters} onLoad={loadIntoLab} />}
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
