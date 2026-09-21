"use client";

import { Icon } from "@/src/presentation/components/Icon";
import type { DataSource, SchemaTable } from "@/src/data/dataSourceApi";
import type { WorkspaceModel } from "../hooks/useWorkspace";

export function InsightSidebar({ model }: { model: WorkspaceModel }) {
  const { selectedSource, schema, sourceBusy } = model;
  return <aside className="insight-column">
    <SchemaCard schema={schema} source={selectedSource} busy={sourceBusy} onSync={() => model.runSourceAction("sync")} />
    <div className="insight-card"><div className="panel-title"><span><Icon name="settings" size={16} /> Data source</span></div>
      <p className="panel-subtitle">{selectedSource ? `${selectedSource.host}:${selectedSource.port}/${selectedSource.databaseName}` : "Connect a MySQL database"}</p>
      <div className="source-actions"><button onClick={() => model.runSourceAction("test")} disabled={!selectedSource || sourceBusy}>Test connection</button><button onClick={model.archiveSelectedSource} disabled={!selectedSource || sourceBusy}>Archive</button></div>
    </div>
    <div className="tip-card"><div className="tip-icon"><Icon name="lightbulb" size={18} /></div><div><strong>Backend-ready workspace</strong><p>Auth, ownership và data source đều đang dùng API thật của Spring Boot.</p></div></div>
  </aside>;
}

function SchemaCard({ schema, source, busy, onSync }: { schema: SchemaTable[]; source?: DataSource; busy: boolean; onSync: () => void }) {
  return <div className="insight-card"><div className="panel-title"><span><Icon name="layers" size={16} /> Schema explorer</span><button className="icon-action" onClick={onSync} disabled={!source || busy}><Icon name="refresh" size={16} /></button></div>
    <p className="panel-subtitle">{schema.length ? `${schema.length} tables from ${source?.databaseName}` : "Sync a data source to browse tables"}</p>
    {schema.length ? schema.slice(0, 8).map((table) => <SchemaTable key={table.name} table={table} />) : <div className="empty-state"><Icon name="database" size={22} /><span>No schema snapshot yet.</span><button onClick={onSync} disabled={!source || busy}>Sync schema</button></div>}
  </div>;
}

function SchemaTable({ table }: { table: SchemaTable }) {
  return <details className="schema-details"><summary className="schema-item"><span className="table-icon"><Icon name="table" size={15} /></span><span><strong>{table.name}</strong><small>{table.columns?.map(({ name }) => name).join(" · ") || "No columns"}</small></span><Icon name="chevron-right" size={15} /></summary><div className="column-list">{table.columns?.map((column) => <span key={column.name}><b>{column.name}</b><small>{column.type ?? "column"}</small></span>)}</div></details>;
}
