import type { ChartSpec, QueryRow } from "@/src/core/domain/textToSql";

export type PlotType = "bar" | "line" | "pie";
export type ColumnKind = "number" | "date" | "text";

export type ChartModel =
  | { kind: "empty"; reason: string }
  | { kind: "kpi"; items: { label: string; value: number }[] }
  | {
      kind: "plot";
      x: string;
      xKind: ColumnKind;
      series: string[];
      data: Record<string, string | number>[];
      defaultType: PlotType;
      allowedTypes: PlotType[];
      caption: string;
      note: string | null;
      dualAxis: boolean;
    };

const OTHER_LABEL = "Khác";
const COUNT_SERIES = "Số lượng";
const MAX_BAR_GROUPS = 15;
const MAX_PIE_SLICES = 7;
const MAX_LINE_POINTS = 200;
const MAX_PIVOT_SERIES = 6;

const NUMBER_PATTERN = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?([eE][-+]?\d+)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}(-\d{2})?([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?/;
// Numeric columns that identify or order rows rather than measure something.
const DIMENSION_NAME = /(^id$|_id$|^id_|(^|_)(year|month|quarter|week|day|hour|nam|thang|quy|tuan|ngay|gio)$|^(rank|stt|no)$)/i;

function isBlank(value: unknown) {
  return value === null || value === undefined || value === "";
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || !NUMBER_PATTERN.test(text) || !/\d/.test(text)) return null;
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function columnKind(rows: QueryRow[], column: string): ColumnKind {
  const values = rows.map((row) => row[column]).filter((value) => !isBlank(value));
  if (!values.length) return "text";
  if (values.every((value) => parseNumber(value) !== null)) return "number";
  if (values.every((value) => value instanceof Date || (typeof value === "string" && DATE_PATTERN.test(value)))) return "date";
  return "text";
}

function distinctCount(rows: QueryRow[], column: string) {
  return new Set(rows.map((row) => String(row[column] ?? ""))).size;
}

function labelOf(value: unknown): string {
  if (isBlank(value)) return "(trống)";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && DATE_PATTERN.test(value)) return value.replace(/T00:00(:00(\.0+)?)?Z?$/, "").replace("T", " ");
  return String(value);
}

function compareLabels(kind: ColumnKind) {
  return (a: string, b: string) => {
    if (kind === "number") return (parseNumber(a) ?? 0) - (parseNumber(b) ?? 0);
    return a.localeCompare(b, "vi", { numeric: true });
  };
}

export function buildChartModel(sourceRows: QueryRow[], spec: ChartSpec | undefined, sql: string): ChartModel {
  let rows = sourceRows;
  if (!rows.length) return { kind: "empty", reason: "Truy vấn không trả về dòng nào." };

  const columns = Object.keys(rows[0] ?? {});
  const kinds = Object.fromEntries(columns.map((column) => [column, columnKind(rows, column)])) as Record<string, ColumnKind>;
  const isMeasure = (column: string) => kinds[column] === "number" && !DIMENSION_NAME.test(column);

  // Pick the category axis: AI hint first, then dates, then text, then numeric dimensions like year/month.
  const specX = spec?.x && columns.includes(spec.x) ? spec.x : null;
  const x =
    specX ??
    columns.find((column) => kinds[column] === "date") ??
    columns.find((column) => kinds[column] === "text") ??
    columns.find((column) => kinds[column] === "number" && DIMENSION_NAME.test(column)) ??
    null;

  let measures = columns.filter((column) => column !== x && isMeasure(column));
  if (spec?.y && measures.includes(spec.y)) measures = [spec.y, ...measures.filter((column) => column !== spec.y)];

  if (!x) {
    if (!measures.length) return { kind: "empty", reason: "Kết quả không có cột số để vẽ biểu đồ." };
    if (rows.length === 1) return { kind: "kpi", items: measures.map((column) => ({ label: column, value: parseNumber(rows[0][column]) ?? 0 })) };
  }
  if (spec?.type === "number" || (rows.length === 1 && measures.length > 0 && (!x || measures.length > 1))) {
    return { kind: "kpi", items: measures.map((column) => ({ label: column, value: parseNumber(rows[0][column]) ?? 0 })) };
  }

  // Only measures and many rows: plot them in row order.
  const xColumn = x ?? "#";
  const xKind: ColumnKind = x ? kinds[x] : "number";
  if (!x) rows = rows.map((row, index) => ({ ...row, "#": index + 1 }));
  const hasDuplicateX = distinctCount(rows, xColumn) < rows.length;

  // Long format (e.g. month, category, revenue): pivot the second category into separate series.
  const pivot =
    hasDuplicateX && measures.length >= 1
      ? columns.find((column) => column !== xColumn && !isMeasure(column) && kinds[column] !== "number" && distinctCount(rows, column) <= MAX_PIVOT_SERIES)
      : undefined;

  const groups = new Map<string, Record<string, number>>();
  let series: string[];
  let aggregation: string;

  if (pivot) {
    const measure = measures[0];
    series = Array.from(new Set(rows.map((row) => labelOf(row[pivot]))));
    for (const row of rows) {
      const key = labelOf(row[xColumn]);
      const bucket = groups.get(key) ?? {};
      const name = labelOf(row[pivot]);
      bucket[name] = (bucket[name] ?? 0) + (parseNumber(row[measure]) ?? 0);
      groups.set(key, bucket);
    }
    aggregation = `${measure} theo ${xColumn}, tách theo ${pivot}`;
  } else if (measures.length) {
    series = measures.slice(0, 4);
    for (const row of rows) {
      const key = labelOf(row[xColumn]);
      const bucket = groups.get(key) ?? {};
      for (const measure of series) bucket[measure] = (bucket[measure] ?? 0) + (parseNumber(row[measure]) ?? 0);
      groups.set(key, bucket);
    }
    aggregation = `${series.join(", ")} theo ${xColumn}${hasDuplicateX ? " (cộng dồn các dòng trùng)" : ""}`;
  } else {
    // No numeric column: count rows per category instead of plotting nothing.
    series = [COUNT_SERIES];
    for (const row of rows) {
      const key = labelOf(row[xColumn]);
      const bucket = groups.get(key) ?? {};
      bucket[COUNT_SERIES] = (bucket[COUNT_SERIES] ?? 0) + 1;
      groups.set(key, bucket);
    }
    aggregation = `Số dòng theo ${xColumn}`;
  }

  let data = Array.from(groups, ([label, values]) => ({ [xColumn]: label, ...Object.fromEntries(series.map((name) => [name, values[name] ?? 0])) })) as Record<string, string | number>[];

  const ordered = /\border\s+by\b/i.test(sql);
  const sequential = xKind === "date" || (xKind === "number" && (!x || DIMENSION_NAME.test(xColumn)));
  const total = (item: Record<string, string | number>) => series.reduce((sum, name) => sum + Number(item[name] ?? 0), 0);
  if (sequential) {
    const compare = compareLabels(xKind);
    data.sort((a, b) => compare(String(a[xColumn]), String(b[xColumn])));
  } else if (!ordered) {
    data.sort((a, b) => total(b) - total(a));
  }

  const defaultType: PlotType = spec?.type === "line" || spec?.type === "pie" || spec?.type === "bar" ? spec.type : sequential ? "line" : "bar";
  const nonNegative = data.every((item) => series.every((name) => Number(item[name]) >= 0));
  const allowedTypes: PlotType[] = ["bar", "line", ...(series.length === 1 && nonNegative && data.length > 1 ? (["pie"] as PlotType[]) : [])];

  let note: string | null = null;
  const limit = sequential ? MAX_LINE_POINTS : MAX_BAR_GROUPS;
  if (data.length > limit) {
    const rest = data.slice(limit - 1);
    note = sequential
      ? `Chỉ hiển thị ${limit} điểm đầu tiên trên tổng ${data.length}.`
      : `Hiển thị ${limit - 1} nhóm lớn nhất, gộp ${rest.length} nhóm còn lại vào "${OTHER_LABEL}".`;
    if (sequential) data = data.slice(0, limit);
    else data = [...data.slice(0, limit - 1), { [xColumn]: OTHER_LABEL, ...Object.fromEntries(series.map((name) => [name, rest.reduce((sum, item) => sum + Number(item[name] ?? 0), 0)])) }];
  }

  const maxes = series.map((name) => Math.max(...data.map((item) => Math.abs(Number(item[name] ?? 0)))));
  const dualAxis = series.length === 2 && Math.min(...maxes) > 0 && Math.max(...maxes) / Math.min(...maxes) > 20;

  return {
    kind: "plot",
    x: xColumn,
    xKind,
    series,
    data,
    defaultType: allowedTypes.includes(defaultType) ? defaultType : "bar",
    allowedTypes,
    caption: `${aggregation} · ${data.length} nhóm`,
    note,
    dualAxis,
  };
}

export function pieData(model: Extract<ChartModel, { kind: "plot" }>) {
  const name = model.series[0];
  const sorted = [...model.data].sort((a, b) => Number(b[name]) - Number(a[name]));
  if (sorted.length <= MAX_PIE_SLICES) return sorted;
  const rest = sorted.slice(MAX_PIE_SLICES - 1);
  return [...sorted.slice(0, MAX_PIE_SLICES - 1), { [model.x]: OTHER_LABEL, [name]: rest.reduce((sum, item) => sum + Number(item[name]), 0) }];
}
