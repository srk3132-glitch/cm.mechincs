import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileUp,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { DatasetError, parseAnyFile, parseDelimited, SAMPLE_CSV, unitFor, type Dataset, type SignalGroup } from "../../lib/parsers/dataset";
import { fmt, fmtInt } from "../../lib/format";
import { Badge, Button, Card, CardHeader, SectionHeading, Segmented, Select } from "../ui";
import { DatasetCharts, DatasetEnergyDonut, DatasetHistogram } from "./DatasetCharts";
import { cn } from "../../utils/cn";

const GROUP_ORDER: SignalGroup[] = ["time", "velocity", "momentum", "energy", "force", "position", "other"];
const GROUP_LABEL: Record<SignalGroup, string> = {
  time: "Time / index",
  velocity: "Velocity",
  momentum: "Momentum",
  energy: "Energy",
  force: "Force",
  position: "Position",
  other: "Other",
};

const MATLAB_SNIPPET = `% Export a collision run from MATLAB
T = timetable(t, v1, v2, p1, p2, ke1, ke2, F);
writetimetable(T, 'run.csv');        % CSV (recommended)

% or keep the .mat format
save('run.mat', 't', 'v1', 'v2', 'p1', 'p2', 'ke1', 'ke2', 'F', '-v7');`;

export function UploadPage() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [xColumn, setXColumn] = useState<string>("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [histColumn, setHistColumn] = useState<string>("");
  const [view, setView] = useState<"charts" | "table">("charts");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const ds = await parseAnyFile(file);
      setDataset(ds);
      setXColumn(ds.xColumn);
      setHidden(new Set([ds.xColumn]));
      setHistColumn(ds.numericColumns.find((c) => c !== ds.xColumn) ?? ds.xColumn);
    } catch (err) {
      setDataset(null);
      setError(err instanceof DatasetError || err instanceof Error ? err.message : "That file could not be read.");
    } finally {
      setBusy(false);
    }
  };

  const loadSample = () => {
    try {
      const ds = parseDelimited(SAMPLE_CSV, "sample_collision_run");
      setError(null);
      setDataset(ds);
      setXColumn(ds.xColumn);
      setHidden(new Set([ds.xColumn]));
      setHistColumn(ds.numericColumns.find((c) => c !== ds.xColumn) ?? ds.xColumn);
    } catch {
      setError("Sample data could not be loaded.");
    }
  };

  const selected = dataset ? dataset.numericColumns.filter((c) => !hidden.has(c)) : [];

  const grouped = useMemo(() => {
    if (!dataset) return [];
    return GROUP_ORDER.map((g) => ({ group: g, cols: dataset.numericColumns.filter((c) => dataset.groups[g].includes(c)) })).filter(
      (g) => g.cols.length > 0,
    );
  }, [dataset]);

  const toggleColumn = (c: string) => {
    if (c === xColumn) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="space-y-6 pt-8">
      <SectionHeading
        eyebrow="MATLAB import"
        title="Upload your run, get graphs that match it"
        description="Drop a MATLAB .mat file (v5–v7), a CSV exported with writematrix / writetimetable, a TSV or a JSON file. Signals are detected automatically – velocity, momentum, kinetic energy, force and position each get their own chart."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadSample}>
              <FileSpreadsheet className="h-4 w-4" /> Load sample CSV
            </Button>
            <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload className="h-4 w-4" /> {busy ? "Reading…" : "Choose file"}
            </Button>
          </div>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept=".mat,.csv,.tsv,.txt,.dat,.log,.json,text/csv,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) load(f);
          e.target.value = "";
        }}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* ---- dropzone ---- */}
        <div className="space-y-4 lg:col-span-7">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) load(f);
            }}
            className={cn(
              "flex min-h-[210px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-all",
              dragging
                ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                : "border-slate-300 bg-white/60 dark:border-slate-700 dark:bg-slate-900/60",
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <FileUp className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Drag &amp; drop your MATLAB file here</p>
            <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
              Supports <span className="font-mono">.mat</span> (v5–v7, incl. compressed),{" "}
              <span className="font-mono">.csv / .tsv / .txt</span> and <span className="font-mono">.json</span>. Files are parsed
              entirely in your browser – nothing is uploaded anywhere.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {["velocity", "momentum", "kinetic_energy", "contact_force", "position", "time"].map((h) => (
                <span key={h} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {h}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <Card className="border-rose-300 bg-rose-50/70 p-4 dark:border-rose-500/40 dark:bg-rose-500/10">
              <p className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </p>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Exporting from MATLAB"
              subtitle="Copy-paste ready snippets"
              action={<Database className="h-4 w-4 text-slate-400" />}
            />
            <pre className="mx-5 mb-5 overflow-x-auto rounded-xl bg-slate-900 p-4 text-[11px] leading-relaxed text-slate-100 dark:bg-slate-950">
              <code>{MATLAB_SNIPPET}</code>
            </pre>
            <p className="mx-5 mb-5 -mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Tip: <span className="font-mono">-v7</span> (not <span className="font-mono">-v7.3</span>) keeps the classic format that
              this reader understands. Struct fields, matrix columns and timetables all work.
            </p>
          </Card>
        </div>

        {/* ---- detected columns ---- */}
        <Card className="lg:col-span-5">
          <CardHeader
            title="Detected signals"
            subtitle={dataset ? `${dataset.numericColumns.length} numeric columns · ${fmtInt(dataset.rows.length)} rows` : "No file loaded yet"}
            action={dataset ? <Badge tone="emerald"><CheckCircle2 className="h-3 w-3" /> {dataset.name}</Badge> : undefined}
          />
          <div className="px-5 pb-5">
            {!dataset ? (
              <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Load a file (or the sample) to see its columns here.
              </p>
            ) : (
              <div className="space-y-4">
                <Select
                  label="X axis (time / index)"
                  value={xColumn}
                  onChange={(e) => {
                    setHidden((prev) => {
                      const next = new Set(prev);
                      next.delete(e.target.value);
                      return next;
                    });
                    setXColumn(e.target.value);
                  }}
                >
                  {dataset.numericColumns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <div className="space-y-3">
                  {grouped.map(({ group, cols }) => (
                    <div key={group}>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {GROUP_LABEL[group]}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {cols.map((c) => {
                          const on = !hidden.has(c) && c !== xColumn;
                          return (
                            <button
                              key={c}
                              onClick={() => toggleColumn(c)}
                              className={cn(
                                "rounded-lg border px-2 py-1 font-mono text-[11px] transition-colors",
                                on
                                  ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300"
                                  : "border-slate-200 text-slate-400 line-through dark:border-slate-700 dark:text-slate-500",
                              )}
                              title={c === xColumn ? "Used as the X axis" : on ? "Hide" : "Show"}
                            >
                              {c}
                              {unitFor(c) && <span className="ml-1 opacity-60">{unitFor(c)}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {dataset.notes.length > 0 && (
                  <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                    {dataset.notes.map((n) => (
                      <p key={n} className="truncate">
                        {n}
                      </p>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDataset(null)} className="text-rose-600 dark:text-rose-400">
                  <Trash2 className="h-3.5 w-3.5" /> Clear dataset
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ---- results ---- */}
      {dataset && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">{dataset.source}</Badge>
              <Badge tone="slate">{fmtInt(dataset.rows.length)} samples</Badge>
              <Badge tone="slate">{dataset.numericColumns.length} signals</Badge>
              {dataset.xUnit && <Badge tone="cyan">X: {dataset.xColumn} [{dataset.xUnit}]</Badge>}
            </div>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "charts", label: "Charts" },
                { value: "table", label: "Data table" },
              ]}
            />
          </div>

          {view === "charts" ? (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <DatasetCharts dataset={dataset} selected={selected} xColumn={xColumn} />
              <DatasetEnergyDonut dataset={dataset} />
              <DatasetHistogram dataset={dataset} column={histColumn} />
            </div>
          ) : (
            <Card>
              <CardHeader
                title="Uploaded data"
                subtitle={`${dataset.name} · ${fmtInt(dataset.rows.length)} rows`}
                action={<Table2 className="h-4 w-4 text-slate-400" />}
              />
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2 font-medium">#</th>
                      {dataset.numericColumns.map((c) => (
                        <th key={c} className="px-3 py-2 text-right font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {dataset.rows.slice(0, 300).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                        {dataset.numericColumns.map((c) => (
                          <td key={c} className="px-3 py-1.5 text-right text-slate-700 dark:text-slate-300">
                            {Number.isFinite(r[c]) ? fmt(r[c], 3) : "–"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-3 text-[11px] text-slate-500 dark:text-slate-400">
                Showing the first 300 rows. Signal statistics are listed in the detected-signals panel.
              </p>
            </Card>
          )}

          <Card>
            <CardHeader title="Signal statistics" subtitle="Range and mean of every numeric column" />
            <div className="overflow-x-auto px-5 pb-5 pt-2">
              <table className="w-full min-w-[520px] text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="pb-2 font-medium">Signal</th>
                    <th className="pb-2 text-right font-medium">Min</th>
                    <th className="pb-2 text-right font-medium">Mean</th>
                    <th className="pb-2 text-right font-medium">Max</th>
                    <th className="pb-2 text-right font-medium">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.stats.map((s) => (
                    <tr key={s.column} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 font-mono text-slate-800 dark:text-slate-200">{s.column}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{fmt(s.min, 3)}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{fmt(s.mean, 3)}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{fmt(s.max, 3)}</td>
                      <td className="py-1.5 text-right text-slate-500">{s.unit || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
