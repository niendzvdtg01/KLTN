import { request } from "./http";

export type DbEngine = {
  code: string;
  displayName: string;
  sqlDialect: string;
  defaultPort: number;
  defaultSchema: string | null;
  supportsSchema: boolean;
  supportsSsl: boolean;
};

export type DataSource = {
  id: number;
  name: string;
  dbType: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  schemaName: string | null;
  sslEnabled: boolean;
  connectTimeoutSeconds: number;
  queryTimeoutSeconds: number;
  maxRows: number;
  properties: Record<string, string>;
  status: "ACTIVE" | "ARCHIVED" | "CONNECTION_ERROR" | "SYNCING" | string;
  lastConnectionStatus?: string | null;
  lastConnectionError?: string | null;
  schemaJson?: string | null;
  lastSyncedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DataSourceInput = {
  name: string;
  dbType: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password?: string;
  schemaName?: string | null;
  sslEnabled: boolean;
  connectTimeoutSeconds: number;
  queryTimeoutSeconds: number;
  maxRows: number;
  properties: Record<string, string>;
};

export type ConnectionTestResult = {
  success: boolean;
  message: string;
  databaseProduct: string | null;
  databaseVersion: string | null;
  latencyMs: number;
};

export async function listDbEngines() {
  return request<DbEngine[]>("/v1/db-engines");
}

export async function listDataSources() {
  return request<DataSource[]>("/v1/data-sources");
}

export async function createDataSource(input: DataSourceInput) {
  return request<DataSource>("/v1/data-sources", { method: "POST", body: JSON.stringify(input) });
}

export async function updateDataSource(id: number, input: DataSourceInput) {
  return request<DataSource>(`/v1/data-sources/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function archiveDataSource(id: number) {
  return request<void>(`/v1/data-sources/${id}`, { method: "DELETE" });
}

export async function testDataSource(id: number) {
  return request<DataSource>(`/v1/data-sources/${id}/test-connection`, { method: "POST" });
}

/** Tests unsaved settings; with `sourceId`, a blank password reuses the stored one. */
export async function testDataSourceDraft(input: DataSourceInput, sourceId?: number | null) {
  const query = sourceId ? `?sourceId=${sourceId}` : "";
  return request<ConnectionTestResult>(`/v1/data-sources/test-connection${query}`, { method: "POST", body: JSON.stringify(input) });
}

export async function syncDataSource(id: number) {
  return request<DataSource>(`/v1/data-sources/${id}/sync-schema`, { method: "POST" });
}

export function parseSchema(schemaJson?: string | null): SchemaTable[] {
  if (!schemaJson) return [];
  try {
    const parsed = JSON.parse(schemaJson) as { tables?: SchemaTable[] };
    return Array.isArray(parsed.tables) ? parsed.tables : [];
  } catch {
    return [];
  }
}

export type SchemaTable = { name: string; type?: string; columns?: { name: string; type?: string; nullable?: boolean }[] };
