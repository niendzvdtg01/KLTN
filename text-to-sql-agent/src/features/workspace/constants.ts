import type { DataSource, DataSourceInput } from "@/src/data/dataSourceApi";

export const suggestions = [
  "Top 10 khách hàng có doanh thu cao nhất",
  "Sản phẩm nào sắp hết hàng?",
  "So sánh doanh số theo tháng trong năm nay",
  "Có bao nhiêu đơn hàng mỗi trạng thái?",
];

export type PropertyRow = { id: number; key: string; value: string };

/** Connection form state; JDBC properties are rows so they can be edited in place. */
export type SourceForm = Omit<DataSourceInput, "properties"> & { properties: PropertyRow[] };

export const emptySourceForm: SourceForm = {
  name: "",
  dbType: "MYSQL",
  host: "localhost",
  port: 3306,
  databaseName: "",
  username: "",
  password: "",
  schemaName: "",
  sslEnabled: false,
  connectTimeoutSeconds: 10,
  queryTimeoutSeconds: 30,
  maxRows: 1000,
  properties: [],
};

export function formFromSource(source: DataSource): SourceForm {
  return {
    name: source.name,
    dbType: source.dbType,
    host: source.host,
    port: source.port,
    databaseName: source.databaseName,
    username: source.username,
    password: "",
    schemaName: source.schemaName ?? "",
    sslEnabled: source.sslEnabled,
    connectTimeoutSeconds: source.connectTimeoutSeconds,
    queryTimeoutSeconds: source.queryTimeoutSeconds,
    maxRows: source.maxRows,
    properties: Object.entries(source.properties ?? {}).map(([key, value], index) => ({ id: index + 1, key, value })),
  };
}

export function inputFromForm(form: SourceForm): DataSourceInput {
  const properties: Record<string, string> = {};
  for (const row of form.properties) {
    if (row.key.trim()) properties[row.key.trim()] = row.value;
  }
  return {
    ...form,
    port: Number(form.port),
    connectTimeoutSeconds: Number(form.connectTimeoutSeconds),
    queryTimeoutSeconds: Number(form.queryTimeoutSeconds),
    maxRows: Number(form.maxRows),
    schemaName: form.schemaName?.trim() || null,
    properties,
  };
}

/** Visual identity of known engines; engines added later through db_engines fall back to a neutral badge. */
export const ENGINE_STYLES: Record<string, { short: string; color: string }> = {
  MYSQL: { short: "My", color: "#00758f" },
  MARIADB: { short: "Ma", color: "#a3683f" },
  POSTGRESQL: { short: "Pg", color: "#336791" },
  SQLSERVER: { short: "Ms", color: "#c4262e" },
  ORACLE: { short: "Or", color: "#c74634" },
};

export function engineStyle(code?: string) {
  if (code && ENGINE_STYLES[code]) return ENGINE_STYLES[code];
  const short = (code ?? "DB").slice(0, 2);
  return { short: short.charAt(0) + short.charAt(1).toLowerCase(), color: "#667085" };
}

/** Badge tone/label for a data source from its lifecycle status and last connection check. */
export function statusTone(status?: string, lastConnection?: string | null) {
  if (status === "ARCHIVED") return "muted";
  if (status === "CONNECTION_ERROR" || lastConnection === "FAILED") return "danger";
  if (lastConnection === "SUCCESS") return "success";
  return "neutral";
}

export function statusLabel(status?: string, lastConnection?: string | null) {
  if (status === "ARCHIVED") return "Đã lưu trữ";
  if (status === "CONNECTION_ERROR" || lastConnection === "FAILED") return "Lỗi kết nối";
  if (lastConnection === "SUCCESS") return "Đã kết nối";
  return "Chưa kiểm tra";
}

export type ResultTab = "chart" | "table" | "sql" | "insight";
