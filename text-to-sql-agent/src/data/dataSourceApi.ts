import { request } from "./http";

export type DataSource = {
  id: number;
  name: string;
  dbType: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
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
  dbType: "MYSQL";
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password?: string;
};

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

export type SchemaTable = { name: string; columns?: { name: string; type?: string; nullable?: boolean }[] };
