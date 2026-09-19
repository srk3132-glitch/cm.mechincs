export const fmt = (n: number, digits = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : "–";

export const fmtInt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "–");

export const fmtCompact = (n: number) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
    : "–";

export const fmtPct = (n: number, digits = 1) => (Number.isFinite(n) ? `${fmt(n, digits)}%` : "–");

export const fmtSigned = (n: number, digits = 1) =>
  Number.isFinite(n) ? `${n > 0 ? "+" : ""}${fmt(n, digits)}` : "–";

export const fmtDate = (ts: number | string | Date) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const fmtDateLong = (ts: number | string | Date) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const fmtDateTime = (ts: number | string | Date) =>
  new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Local YYYY-MM-DD */
export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Parse YYYY-MM-DD as local midnight */
export const fromISODate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const dayDiff = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
