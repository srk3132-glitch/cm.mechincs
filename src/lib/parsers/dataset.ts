import { matToColumns, parseMatFile } from "./mat";

export type SignalGroup = "time" | "velocity" | "momentum" | "energy" | "force" | "position" | "other";

export interface Dataset {
  name: string;
  source: string;
  columns: string[];
  numericColumns: string[];
  rows: Record<string, number>[];
  groups: Record<SignalGroup, string[]>;
  xColumn: string;
  xUnit: string;
  notes: string[];
  stats: { column: string; min: number; max: number; mean: number; unit: string }[];
}

export class DatasetError extends Error {}

/* ---------------- unit + group detection ---------------- */

const UNIT_RULES: { test: RegExp; unit: string }[] = [
  { test: /(veloc|speed|^u\d*$|^v\d*$|^u_|^v_)/i, unit: "m/s" },
  { test: /(moment|^p\d*$|^p_|impulse)/i, unit: "kg·m/s" },
  { test: /(energy|kinetic|^ke|_ke$|^e\d*$)/i, unit: "J" },
  { test: /(force|^f\d*$|^f_|load|accel)/i, unit: "N" },
  { test: /(position|displac|^x\d*$|^x_|height|altitude)/i, unit: "m" },
  { test: /(^t$|^t_|time|elapsed|timestamp|^s$|seconds|ms$)/i, unit: "s" },
  { test: /(mass|^m\d*$|^m_)/i, unit: "kg" },
  { test: /%|percent|ratio|loss|restitution/i, unit: "%" },
];

export function unitFor(column: string) {
  for (const r of UNIT_RULES) if (r.test.test(column)) return r.unit;
  return "";
}

export function groupFor(column: string): SignalGroup {
  if (/(^t$|^t_|time|elapsed|timestamp|^s$|seconds|^ms$|sample|index)/i.test(column)) return "time";
  if (/(veloc|speed|^u\d*$|^v\d*$|^u_|^v_)/i.test(column)) return "velocity";
  if (/(moment|^p\d*$|^p_|impulse)/i.test(column)) return "momentum";
  if (/(energy|kinetic|^ke|_ke$|^e\d*$|power)/i.test(column)) return "energy";
  if (/(force|^f\d*$|^f_|load|accel)/i.test(column)) return "force";
  if (/(position|displac|^x\d*$|^x_|height|altitude|angle)/i.test(column)) return "position";
  return "other";
}

const isNumericish = (v: string) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim()) || /^(nan|inf|-inf)$/i.test(v.trim());

function splitLine(line: string, delim: string | RegExp) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function guessDelimiter(line: string): string | RegExp {
  const counts: [string, number][] = [
    [",", (line.match(/,/g) || []).length],
    [";", (line.match(/;/g) || []).length],
    ["\t", (line.match(/\t/g) || []).length],
    ["|", (line.match(/\|/g) || []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  if (counts[0][1] > 0) return counts[0][0];
  // whitespace-delimited tables are common when MATLAB exports are copy-pasted
  const cols = line.trim().split(/\s+/).length;
  return cols > 2 ? /\s+/ : ",";
}

/** Parses CSV / TSV / whitespace-delimited text exported from MATLAB. */
export function parseDelimited(text: string, name: string): Dataset {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trim().startsWith("%") && !l.trim().startsWith("#"));
  if (lines.length < 2) throw new DatasetError("The file needs a header row plus at least one data row.");

  const delimiter = guessDelimiter(lines[0]);
  const header = splitLine(lines[0], delimiter).map((h, i) => (h || `col_${i + 1}`).replace(/^"|"$/g, ""));
  const rows: Record<string, number>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const row: Record<string, number> = {};
    header.forEach((h, j) => {
      const raw = cells[j] ?? "";
      row[h] = isNumericish(raw) ? parseFloat(raw) : NaN;
    });
    rows.push(row);
  }

  return finalise(name, "delimited text", header, rows, []);
}

/** Parses JSON exported from MATLAB via jsonencode (array of records or column map). */
export function parseJson(text: string, name: string): Dataset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DatasetError("That JSON file could not be parsed.");
  }
  let records: Record<string, unknown>[];
  if (Array.isArray(parsed)) records = parsed as Record<string, unknown>[];
  else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const keys = Object.keys(obj);
    const allArrays = keys.length > 0 && keys.every((k) => Array.isArray(obj[k]));
    if (allArrays) {
      const len = Math.max(...keys.map((k) => (obj[k] as unknown[]).length));
      records = Array.from({ length: len }, (_, i) => {
        const r: Record<string, unknown> = {};
        for (const k of keys) r[k] = (obj[k] as unknown[])[i];
        return r;
      });
    } else {
      records = [obj];
    }
  } else throw new DatasetError("Unsupported JSON structure – expected an array of records or a column map.");

  if (!records.length) throw new DatasetError("The JSON file contained no records.");
  const header = [...new Set(records.flatMap((r) => Object.keys(r)))];
  const rows = records.map((r) => {
    const row: Record<string, number> = {};
    for (const h of header) {
      const v = r[h];
      const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
      row[h] = Number.isFinite(n) ? n : NaN;
    }
    return row;
  });
  return finalise(name, "JSON", header, rows, []);
}

export async function parseMat(buffer: ArrayBuffer, name: string): Promise<Dataset> {
  const vars = await parseMatFile(buffer);
  const { columns, data, notes } = matToColumns(vars);
  if (!columns.length) throw new DatasetError("No numeric signals found in that MAT-file.");
  const rows = Array.from({ length: data[columns[0]].length }, (_, i) => {
    const row: Record<string, number> = {};
    for (const c of columns) row[c] = data[c][i];
    return row;
  });
  return finalise(name, "MAT-file", columns, rows, notes);
}

function finalise(
  name: string,
  source: string,
  columns: string[],
  rows: Record<string, number>[],
  notes: string[],
): Dataset {
  const numericColumns = columns.filter((c) => rows.some((r) => Number.isFinite(r[c])));
  if (!numericColumns.length) throw new DatasetError("None of the columns contain numeric samples.");

  const groups: Record<SignalGroup, string[]> = { time: [], velocity: [], momentum: [], energy: [], force: [], position: [], other: [] };
  for (const c of numericColumns) groups[groupFor(c)].push(c);

  const xCandidates = groups.time.length ? groups.time : [];
  const monotonic = (c: string) => {
    const vals = rows.map((r) => r[c]).filter(Number.isFinite);
    let up = 0;
    for (let i = 1; i < vals.length; i++) if (vals[i] > vals[i - 1]) up++;
    return up / Math.max(1, vals.length - 1);
  };
  const xColumn = (xCandidates.length ? [...xCandidates].sort((a, b) => monotonic(b) - monotonic(a))[0] : numericColumns[0]);
  const xUnit = xColumn === numericColumns[0] && !groups.time.length ? "" : unitFor(xColumn);

  const stats = numericColumns.map((c) => {
    const vals = rows.map((r) => r[c]).filter((v) => Number.isFinite(v));
    return {
      column: c,
      min: vals.length ? Math.min(...vals) : NaN,
      max: vals.length ? Math.max(...vals) : NaN,
      mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN,
      unit: unitFor(c),
    };
  });

  return { name, source, columns, numericColumns, rows, groups, xColumn, xUnit, notes, stats };
}

export async function parseAnyFile(file: File): Promise<Dataset> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const base = file.name.replace(/\.[^.]+$/, "");
  if (ext === "mat") {
    return parseMat(await file.arrayBuffer(), base);
  }
  const text = await file.text();
  if (ext === "json") return parseJson(text, base);
  if (ext === "csv" || ext === "tsv" || ext === "txt" || ext === "dat" || ext === "log") {
    return parseDelimited(text, base);
  }
  // sniff the content
  const head = text.trimStart().slice(0, 1);
  if (head === "{" || head === "[") return parseJson(text, base);
  return parseDelimited(text, base);
}

export { MatParseError } from "./mat";

/** A ready-to-load CSV template so the upload flow can be tried immediately. */
export const SAMPLE_CSV = `time,velocity_A,velocity_B,momentum_A,momentum_B,kinetic_energy_A,kinetic_energy_B,contact_force
0,9.00,-5.00,14.40,-11.00,64.80,27.50,0
0.02,8.71,-4.66,13.94,-10.25,60.15,25.95,742
0.04,8.02,-3.88,12.83,-8.54,51.84,22.47,1428
0.06,6.84,-2.51,10.94,-5.52,37.65,7.55,1811
0.08,5.11,-0.52,8.18,-1.14,20.86,0.33,1811
0.10,3.02,1.20,4.83,2.64,7.31,1.58,1428
0.12,2.66,1.44,4.26,3.17,5.66,2.28,742
0.14,2.47,1.51,3.95,3.32,4.87,2.51,0
0.16,2.40,1.54,3.84,3.39,4.61,2.61,0
`;
