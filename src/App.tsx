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
import { dayDiff, fromISODate, toISODate } from "./lib/format";
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
import { Card, CardHeader, SectionHeading } from "./components/ui";

const DEFAULT_LAB: LabConfig = { m1: 1.6, u1: 9, m2: 2.2, u2: -5, e: 0.6, contactMs: 60, mode: "e", target: 0 };

function OverviewPage({
  records,
  filters,
}: {
  records: CollisionRecord[];
  filters: Filters;
}) {
  const segmented = useMemo(() => applySegmentFilters(records, filters), [records, filters]);
  const current = useMemo(() => applyDateRange(segmented, filters.from, filters.to), [segmented, filters.from, filters.to]);
  const prevRange = useMemo(() => previousRange(filters.from, filters.to), [filters.from, filters.to]);
  const previous = useMemo(() => applyDateRange(segmented, prevRange.from, prevRange.to), [segmented, prevRange]);
  const { granularity, points } = useMemo(() => timeSeries(current, filters.from, filters.to), [current, filters.from, filters.to]);
  const kpis = useMemo(() => computeKpis(current), [current]);
  const prevKpis = useMemo(() => computeKpis(previous), [previous]);
  const rangeDays = dayDiff(fromISODate(filters.from), fromISODate(filters.to)) + 1;

  return (
    <div className="space-y-6 pt-8">
      <SectionHeading
        eyebrow="Overview"
        title="Fleet collision analytics"
        description="Momentum conservation, energy dissipation and impact loads across every logged drone-to-drone collision test. All views react to the filters above."
      />

      <KpiGrid current={kpis} previous={prevKpis} points={points} rangeDays={rangeDays} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MomentumEnergyTrend points={points} granularity={granularity} />
        </div>
        <TypeDonut records={current} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CollisionsByPeriod records={current} from={filters.from} to={filters.to} />
        </div>
        <EnergyDonut records={current} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <VelocityChart points={points} granularity={granularity} />
        <ForceTrend points={points} granularity={granularity} />
        <StatusDonut records={current} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FleetPhaseSpace records={current} />
        </div>
        <ArenaBars records={current} />
      </div>

      <DroneModelBars records={current} />
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
    <div className="space-y-6 pt-8">
      <SectionHeading
        eyebrow="Test log"
        title="Every collision, one row"
        description="Raw per-test measurements. Sorting, searching and the global filters all compose. Click any row to replay that exact collision in the Collision Lab."
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

  const segmented = useMemo(() => applySegmentFilters(records, filters), [records, filters]);
  const shownCount = useMemo(
    () => applyDateRange(segmented, filters.from, filters.to).length,
    [segmented, filters.from, filters.to],
  );

  const loadIntoLab = useCallback((r: CollisionRecord) => {
    setLab({ m1: r.massA, u1: r.uA, m2: r.massB, u2: r.uB, e: r.e, contactMs: r.contactMs, mode: "e", target: 0 });
    setLoadedFrom(r.id);
    navigate("collision-lab");
  }, [navigate]);

  const setLabInput = useCallback((v: LabConfig) => {
    setLab(v);
    setLoadedFrom(null);
  }, []);

  const showFilters = route !== "upload";

  return (
    <div className="app-bg min-h-screen">
      <Header route={route} navigate={navigate} />
      <main className="mx-auto max-w-[1600px] px-4 pb-20 sm:px-6 lg:px-8">
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
          {route === "overview" && <OverviewPage records={records} filters={filters} />}
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
      <footer className="border-t border-slate-200/70 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Collision Drones &amp; Momentum Tracking · sample telemetry generated locally · physics: 1-D restitution model
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
