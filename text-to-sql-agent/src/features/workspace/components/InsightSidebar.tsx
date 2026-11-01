"use client";

import { useState } from "react";
import { Icon } from "@/src/presentation/components/Icon";
import type { DataSource, SchemaTable } from "@/src/data/dataSourceApi";
import type { WorkspaceModel } from "../hooks/useWorkspace";
import { statusLabel, statusTone } from "../constants";
import { EngineBadge } from "./EngineBadge";

export function InsightSidebar({ model }: { model: WorkspaceModel }) {
  const { selectedSource, schema, sourceBusy } = model;
  return <aside className="side-panel">
    {selectedSource ? <ConnectionCard source={selectedSource} engineName={model.engineOf(selectedSource.dbType)?.displayName} busy={sourceBusy}
      onTest={() => model.runSourceAction("test")} onEdit={() => model.openEditSource(selectedSource)} onArchive={model.archiveSelectedSource} />
      : <div className="panel-card muted-card"><Icon name="database" size={20} /><p>Chưa có kết nối nào được chọn.</p></div>}
    <SchemaCard schema={schema} source={selectedSource} busy={sourceBusy} onSync={() => model.runSourceAction("sync")} onPick={(text) => model.setQuestion(text)} />
  </aside>;
}

function ConnectionCard({ source, engineName, busy, onTest, onEdit, onArchive }: { source: DataSource; engineName?: string; busy: boolean; onTest: () => void; onEdit: () => void; onArchive: () => void }) {
  const tone = statusTone(source.status, source.lastConnectionStatus);
  const rows: [string, string][] = [
    ["Máy chủ", `${source.host}:${source.port}`],
    ["Database", source.databaseName],
    ...(source.schemaName ? [["Schema", source.schemaName] as [string, string]] : []),
    ["Người dùng", source.username],
    ["Giới hạn", `${source.maxRows.toLocaleString("vi-VN")} dòng · ${source.queryTimeoutSeconds}s`],
    ["Bảo mật", source.sslEnabled ? "SSL/TLS bật" : "Không SSL"],
  ];
  return <div className="panel-card">
    <div className="connection-head">
      <EngineBadge code={source.dbType} size="lg" />
      <div><strong>{source.name}</strong><small>{engineName ?? source.dbType}</small></div>
      <span className={`status-pill ${tone}`}>{statusLabel(source.status, source.lastConnectionStatus)}</span>
    </div>
    <dl className="connection-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd title={value}>{value}</dd></div>)}</dl>
    {Object.keys(source.properties ?? {}).length > 0 && <div className="prop-tags">{Object.entries(source.properties).map(([key, value]) => <span key={key} title={`${key}=${value}`}>{key}</span>)}</div>}
    {source.lastConnectionStatus === "FAILED" && source.lastConnectionError && <p className="inline-error"><Icon name="alert" size={13} /> {source.lastConnectionError}</p>}
    <div className="button-row">
      <button className="ghost-button small" onClick={onTest} disabled={busy}><Icon name="shield" size={14} /> Kiểm tra</button>
      <button className="ghost-button small" onClick={onEdit} disabled={busy}><Icon name="settings" size={14} /> Cấu hình</button>
      <button className="ghost-button small danger" onClick={onArchive} disabled={busy || source.status === "ARCHIVED"} title="Lưu trữ kết nối"><Icon name="archive" size={14} /></button>
    </div>
  </div>;
}

function SchemaCard({ schema, source, busy, onSync, onPick }: { schema: SchemaTable[]; source?: DataSource; busy: boolean; onSync: () => void; onPick: (text: string) => void }) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const tables = term
    ? schema.filter((table) => table.name.toLowerCase().includes(term) || table.columns?.some((column) => column.name.toLowerCase().includes(term)))
    : schema;
  const columnCount = schema.reduce((total, table) => total + (table.columns?.length ?? 0), 0);

  return <div className="panel-card schema-card">
    <div className="panel-title">
      <span><Icon name="layers" size={15} /> Schema</span>
      <button className="icon-action" onClick={onSync} disabled={!source || busy || source.status === "ARCHIVED"} title="Đồng bộ lại schema">
        <span className={busy ? "spin" : ""}><Icon name="refresh" size={15} /></span>
      </button>
    </div>
    {schema.length ? <>
      <p className="panel-subtitle">{schema.length} bảng · {columnCount} cột{source?.lastSyncedAt ? ` · đồng bộ ${new Date(source.lastSyncedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}` : ""}</p>
      <label className="panel-search"><Icon name="search" size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm bảng hoặc cột…" /></label>
      <div className="schema-list">
        {tables.map((table) => <SchemaTableItem key={table.name} table={table} open={Boolean(term)} onPick={onPick} />)}
        {!tables.length && <p className="conversation-empty">Không có bảng nào khớp.</p>}
      </div>
    </> : <div className="empty-state"><Icon name="database" size={22} /><span>Chưa có schema snapshot.</span><button className="primary-button small" onClick={onSync} disabled={!source || busy}>Đồng bộ schema</button></div>}
  </div>;
}

function SchemaTableItem({ table, open, onPick }: { table: SchemaTable; open: boolean; onPick: (text: string) => void }) {
  return <details className="schema-details" open={open || undefined}>
    <summary className="schema-item">
      <Icon name={table.type === "VIEW" ? "layers" : "table"} size={14} />
      <strong>{table.name}</strong>
      {table.type === "VIEW" && <em>view</em>}
      <small>{table.columns?.length ?? 0}</small>
    </summary>
    <div className="column-list">
      {table.columns?.map((column) => <span key={column.name}><b>{column.name}</b><small>{column.type?.toLowerCase() ?? ""}{column.nullable === false ? " · not null" : ""}</small></span>)}
      <button className="link-button" onClick={() => onPick(`Cho tôi xem 10 dòng đầu của bảng ${table.name}`)}>Hỏi về bảng này →</button>
    </div>
  </details>;
}
