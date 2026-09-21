import { Card } from "./ui";

export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4 animate-pulse">
      {/* KPI Skeletons */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="col-span-12 sm:col-span-6 xl:col-span-4 2xl:col-span-2 h-28 rounded-2xl border border-slate-200/60 bg-slate-100/60 p-4 dark:border-slate-800/60 dark:bg-[#0e1628]/60"
        >
          <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 h-8 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}

      {/* Chart Skeletons */}
      <Card className="col-span-12 xl:col-span-8 h-80 p-5">
        <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-60 w-full rounded-xl bg-slate-100 dark:bg-slate-800/40" />
      </Card>
      <Card className="col-span-12 xl:col-span-4 h-80 p-5">
        <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-60 w-full rounded-xl bg-slate-100 dark:bg-slate-800/40" />
      </Card>
    </div>
  );
}
