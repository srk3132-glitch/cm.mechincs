/**
 * Minimal reader for MATLAB level-5 MAT-files (the classic `save('x.mat')`
 * format, version 5 / 6 / 7).  Supports the pieces a test log usually needs:
 *
 *   • numeric arrays (double, single, 8/16/32/64-bit ints, uint)
 *   • character arrays used as headers
 *   • structs whose fields are vectors  (e.g. save('run.mat','t','v1','p','ke'))
 *   • miCOMPRESSED elements (zlib / raw deflate, transparently inflated)
 *   • little/big endian files
 *
 * MATLAB v7.3+ files are HDF5 containers – they carry a readable marker and are
 * rejected with an actionable message.
 */

const mxClassNames: Record<number, string> = {
  1: "cell",
  2: "struct",
  3: "object",
  4: "char",
  5: "sparse",
  6: "double",
  7: "single",
  8: "int8",
  9: "uint8",
  10: "int16",
  11: "uint16",
  12: "int32",
  13: "uint32",
  14: "int64",
  15: "uint64",
};

export interface MatNumeric {
  kind: "numeric";
  name: string;
  rows: number;
  cols: number;
  values: number[];
}

export interface MatText {
  kind: "text";
  name: string;
  value: string;
}

export interface MatStruct {
  kind: "struct";
  name: string;
  fields: Record<string, MatVariable>;
}

export interface MatVariable {
  kind: "numeric" | "text" | "struct" | "other";
  name: string;
  class?: string;
  rows?: number;
  cols?: number;
  values?: number[];
  value?: string;
  fields?: Record<string, MatVariable>;
}

export class MatParseError extends Error {}

class Reader {
  view: DataView;
  bytes: Uint8Array;
  little: boolean;
  pos = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.little = true;
  }

  get length() {
    return this.bytes.length;
  }

  u32() {
    const v = this.view.getUint32(this.pos, this.little);
    this.pos += 4;
    return v;
  }

  u16() {
    const v = this.view.getUint16(this.pos, this.little);
    this.pos += 2;
    return v;
  }

  i32() {
    const v = this.view.getInt32(this.pos, this.little);
    this.pos += 4;
    return v;
  }

  f64() {
    const v = this.view.getFloat64(this.pos, this.little);
    this.pos += 8;
    return v;
  }

  f32() {
    const v = this.view.getFloat32(this.pos, this.little);
    this.pos += 4;
    return v;
  }

  i64() {
    const v = this.view.getBigInt64(this.pos, this.little);
    this.pos += 8;
    return Number(v);
  }

  bytesInto(start: number, n: number) {
    return this.bytes.subarray(start, start + n);
  }

  slice(start: number, end: number) {
    return this.bytes.slice(start, end);
  }

  skip(n: number) {
    this.pos += n;
  }

  setPos(p: number) {
    this.pos = p;
  }

  getPos() {
    return this.pos;
  }

  decode(start: number, n: number) {
    return new TextDecoder("utf-8").decode(this.bytes.subarray(start, start + n));
  }
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) throw new MatParseError("This browser cannot decompress MATLAB data (DecompressionStream unavailable).");
  const formats = ["deflate-raw", "deflate"] as const;
  let lastErr: unknown;
  for (const format of formats) {
    try {
      const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DS(format));
      const buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    } catch (err) {
      lastErr = err;
    }
  }
  throw new MatParseError(`Could not decompress the MAT-file payload (${String(lastErr)})`);
}

const pad8 = (n: number) => (n + 7) & ~7;

interface Element {
  type: number;
  start: number;
  size: number;
  small: boolean;
}

/** Heuristic: does `pos` look like the start of a valid data element? */
function looksLikeTag(r: Reader, pos: number, end: number): boolean {
  if (pos + 4 > end) return false;
  const word = r.view.getUint32(pos, r.little);
  const type = word & 0xffff;
  const upper = word >>> 16;
  if (type < 1 || type > 18) return false;
  if (upper !== 0) return upper <= 4; // small element: ≤ 4 payload bytes
  if (pos + 8 > end) return false;
  const nbytes = r.view.getUint32(pos + 4, r.little);
  return nbytes <= end - pos;
}

/** Reads one data element header (small or normal format). */
function readElement(r: Reader, end: number): Element {
  const word = r.u32();
  const small = (word >>> 16) !== 0;
  if (small) {
    const nbytes = word >>> 16;
    const type = word & 0xffff;
    const start = r.getPos();
    const after = start + nbytes;
    // Small elements are not consistently padded by every writer, so pick the
    // interpretation whose following bytes still parse as a tag.
    let next = pad8(after);
    if (nbytes % 8 !== 0) {
      if (looksLikeTag(r, after, end)) next = after;
      else if (!looksLikeTag(r, next, end) && looksLikeTag(r, pad4(after), end)) next = pad4(after);
    }
    r.setPos(next);
    return { type, start, size: nbytes, small: true };
  }
  const type = word;
  const nbytes = r.u32();
  const start = r.getPos();
  r.skip(pad8(nbytes));
  return { type, start, size: nbytes, small: false };
}

const pad4 = (n: number) => (n + 3) & ~3;

function readNumericData(r: Reader, el: Element, cls: number, count: number, complex: boolean): number[] {
  const out: number[] = [];
  const parts = complex ? 2 : 1;
  const total = count * parts;
  for (let i = 0; i < total; i++) {
    switch (cls) {
      case 6:
        out.push(r.f64());
        break;
      case 7:
        out.push(r.f32());
        break;
      case 8:
        out.push(r.view.getInt8(el.start + i));
        break;
      case 9:
        out.push(r.bytes[el.start + i]);
        break;
      case 10:
        out.push(r.view.getInt16(el.start + i * 2, r.little));
        break;
      case 11:
        out.push(r.view.getUint16(el.start + i * 2, r.little));
        break;
      case 12:
        out.push(r.view.getInt32(el.start + i * 4, r.little));
        break;
      case 13:
        out.push(r.view.getUint32(el.start + i * 4, r.little));
        break;
      case 14:
        out.push(r.view.getBigInt64(el.start + i * 8, r.little) as unknown as number);
        break;
      case 15:
        out.push(Number(r.view.getBigUint64(el.start + i * 8, r.little)));
        break;
      default:
        throw new MatParseError(`Unsupported numeric class ${cls}`);
    }
  }
  return out;
}

function parseMatrix(r: Reader, name: string, end: number): MatVariable {
  const flagsEl = readElement(r, end);
  const flags = r.bytesInto(flagsEl.start, 4);
  const cls = (flags[0] & 0xff) | ((flags[1] & 0xff) << 8);
  const flagWord = r.view.getUint32(flagsEl.start, r.little);
  const complex = (flagWord & 0x0800) !== 0;

  const dimEl = readElement(r, end);
  const ndims = dimEl.size / 4;
  const dims: number[] = [];
  for (let i = 0; i < ndims; i++) dims.push(r.view.getInt32(dimEl.start + i * 4, r.little));

  const nameEl = readElement(r, end);
  const varName = nameEl.size > 0 ? r.decode(nameEl.start, Math.min(nameEl.size, 256)).replace(/\0+$/, "") : name;

  const rows = dims[0] ?? 1;
  const cols = dims.length > 1 ? dims[1] : 1;
  const count = Math.max(1, rows * cols);

  if (cls === 2) {
    // struct: field name length, field names, then each field's matrix
    const flEl = readElement(r, end);
    const fieldNameLen = r.view.getInt32(flEl.start, r.little);
    const fnEl = readElement(r, end);
    const nfields = Math.floor(fnEl.size / fieldNameLen);
    const fieldNames: string[] = [];
    for (let i = 0; i < nfields; i++) {
      fieldNames.push(r.decode(fnEl.start + i * fieldNameLen, fieldNameLen).replace(/\0+$/, ""));
    }
    const fields: Record<string, MatVariable> = {};
    for (const fn of fieldNames) {
      const el = readElement(r, end);
      if (el.type !== 14) {
        fields[fn] = { kind: "other", name: fn };
        continue;
      }
      fields[fn] = parseMatrix(r, fn, end);
    }
    return { kind: "struct", name: varName, fields };
  }

  if (cls === 4) {
    const el = readElement(r, end);
    return {
      kind: "text",
      name: varName,
      value: r.decode(el.start, el.size).replace(/\0+$/, ""),
    };
  }

  if (cls >= 6 && cls <= 15) {
    const el = readElement(r, end);
    const values = readNumericData(r, el, cls, count, complex);
    return { kind: "numeric", name: varName, class: mxClassNames[cls], rows, cols, values };
  }

  return { kind: "other", name: varName, class: mxClassNames[cls] };
}

async function parseElementList(r: Reader, end: number): Promise<MatVariable[]> {
  const vars: MatVariable[] = [];
  let guard = 0;
  while (r.getPos() + 8 <= end && guard++ < 5000) {
    const el = readElement(r, end);
    if (el.type === 14) {
      r.setPos(el.start);
      vars.push(parseMatrix(r, "", end));
    } else if (el.type === 15) {
      const compressed = r.slice(el.start, el.start + el.size);
      const raw = await inflate(compressed);
      const inner = new Reader(raw.slice().buffer as ArrayBuffer);
      inner.little = r.little;
      vars.push(...(await parseElementList(inner, raw.length)));
    } else if (el.type === 0) {
      break;
    }
  }
  return vars;
}

async function parseFile(buffer: ArrayBuffer): Promise<MatVariable[]> {
  const r = new Reader(buffer);
  if (buffer.byteLength < 132) throw new MatParseError("File is too small to be a MAT-file.");

  const header = r.decode(0, 116);
  if (header.trimStart().startsWith("MATLAB 7.3")) {
    throw new MatParseError(
      "This is an HDF5-based MAT-file (saved with -v7.3). Re-save it with save('run.mat','t','v1',...,'-v7') or export to CSV.",
    );
  }

  const endian = r.decode(126, 2);
  // MATLAB writes the characters "IM" for little-endian files and "MI" for big-endian ones
  if (endian === "IM") r.little = true;
  else if (endian === "MI") r.little = false;
  else r.little = r.bytes[124] === 0x00 && r.bytes[125] === 0x01;
  r.setPos(128);
  return parseElementList(r, buffer.byteLength);
}

export function parseMatFile(buffer: ArrayBuffer): Promise<MatVariable[]> {
  return parseFile(buffer);
}

/** Flattens struct-of-vectors (and plain matrices) into column arrays. */
export function matToColumns(vars: MatVariable[]): { columns: string[]; data: Record<string, number[]>; notes: string[] } {
  const data: Record<string, number[]> = {};
  const notes: string[] = [];
  let length = 0;

  const addVector = (name: string, values: number[]) => {
    if (!name) return;
    length = Math.max(length, values.length);
    data[name] = values;
  };

  for (const v of vars) {
    if (v.kind === "numeric" && v.values) {
      const cols = v.cols ?? 1;
      const rows = v.rows ?? 1;
      if (cols === 1) {
        addVector(v.name || "signal_1", v.values);
      } else if (rows === 1) {
        v.values.forEach((val, i) => addVector(`${v.name || "signal"}_${i + 1}`, [val]));
      } else {
        // matrix: one column per matrix column
        for (let c = 0; c < cols; c++) {
          const col: number[] = [];
          for (let rIdx = 0; rIdx < rows; rIdx++) col.push(v.values[c * rows + rIdx]);
          addVector(`${v.name || "signal"}_${c + 1}`, col);
        }
      }
    } else if (v.kind === "struct" && v.fields) {
      for (const [fn, fv] of Object.entries(v.fields)) {
        if (fv.kind === "numeric" && fv.values) addVector(fn, fv.values);
        else if (fv.kind === "text") notes.push(`${fn}: ${fv.value}`);
      }
    } else if (v.kind === "text") {
      notes.push(`${v.name || "note"}: ${v.value}`);
    }
  }

  // normalise every column to the longest length
  const columns = Object.keys(data);
  const normalised: Record<string, number[]> = {};
  for (const c of columns) {
    const col = data[c];
    normalised[c] = Array.from({ length }, (_, i) => (i < col.length ? col[i] : NaN));
  }
  return { columns, data: normalised, notes };
}
