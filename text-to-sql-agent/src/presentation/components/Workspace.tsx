"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/src/presentation/components/Icon";
import { getCurrentUser, logout, type AuthUser } from "@/src/data/authApi";
import {
  archiveDataSource,
  createDataSource,
  listDataSources,
  parseSchema,
  syncDataSource,
  testDataSource,
  type DataSource,
  type DataSourceInput,
  type SchemaTable,
} from "@/src/data/dataSourceApi";
import { useTextToSql } from "@/src/presentation/hooks/useTextToSql";

const suggestions = [
  "Show me the top 10 customers by revenue",
  "Which products are running low on stock?",
  "Compare monthly sales for this year",
];

const emptyForm: DataSourceInput = {
  name: "",
  dbType: "MYSQL",
  host: "localhost",
  port: 3306,
  databaseName: "",
  username: "",
  password: "",
};

export default function Workspace() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState<DataSourceInput>(emptyForm);
  const [notice, setNotice] = useState("");
  const [sourceBusy, setSourceBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "sql">("table");

  const { state, runQuery, setQuestion } = useTextToSql();
  const selectedSource =
    sources.find((source) => source.id === selectedId) ?? sources[0];
  const schema = useMemo(
    () => parseSchema(selectedSource?.schemaJson),
    [selectedSource],
  );

  useEffect(() => {
    Promise.all([getCurrentUser(), listDataSources()])
      .then(([currentUser, data]) => {
        setUser(currentUser);
        setSources(data);
        setSelectedId(data[0]?.id ?? null);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  function updateSourceField<K extends keyof DataSourceInput>(
    field: K,
    value: DataSourceInput[K],
  ) {
    setSourceForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSourceSubmit(event: FormEvent) {
    event.preventDefault();
    setSourceBusy(true);
    setNotice("");

    try {
      const created = await createDataSource({
        ...sourceForm,
        port: Number(sourceForm.port),
      });

      setSources((current) => [created, ...current]);
      setSelectedId(created.id);
      setShowSourceForm(false);
      setSourceForm(emptyForm);
      setNotice("Đã thêm data source. Hãy test connection hoặc đồng bộ schema.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể thêm data source.",
      );
    } finally {
      setSourceBusy(false);
    }
  }

  async function handleSourceAction(action: "test" | "sync") {
    if (!selectedSource) return;

    setSourceBusy(true);
    setNotice("");

    try {
      const updated =
        action === "test"
          ? await testDataSource(selectedSource.id)
          : await syncDataSource(selectedSource.id);

      setSources((current) =>
        current.map((source) =>
          source.id === updated.id ? updated : source,
        ),
      );
      setNotice(
        action === "test" ? "Kết nối thành công." : "Đã đồng bộ schema.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Thao tác thất bại.");
    } finally {
      setSourceBusy(false);
    }
  }

  async function handleArchive() {
    if (
      !selectedSource ||
      !window.confirm(`Archive data source “${selectedSource.name}”?`)
    ) {
      return;
    }

    setSourceBusy(true);

    try {
      await archiveDataSource(selectedSource.id);
      const remaining = sources.filter(
        (source) => source.id !== selectedSource.id,
      );
      setSources(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setNotice("Đã archive data source.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể archive data source.",
      );
    } finally {
      setSourceBusy(false);
    }
  }

  async function handleLogout() {
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="sparkle" size={18} />
          </span>
          <span>queryly</span>
        </div>

        <button className="new-query" onClick={() => setQuestion("")}>
          <Icon name="plus" size={17} />
          New query
          <span>⌘ K</span>
        </button>

        <nav className="nav-list">
          <a className="nav-item active" href="#workspace">
            <Icon name="terminal" size={18} />
            Query workspace
          </a>
          <a className="nav-item" href="#history">
            <Icon name="clock" size={18} />
            History <b>—</b>
          </a>
          <a className="nav-item" href="#saved">
            <Icon name="bookmark" size={18} />
            Saved queries
          </a>
        </nav>

        <div className="sidebar-spacer" />

        <ConnectionCard
          source={selectedSource}
          onAdd={() => setShowSourceForm(true)}
        />

        <button className="user-menu" onClick={handleLogout}>
          <span className="avatar">{initials(user?.fullName)}</span>
          <div>
            <strong>{user?.fullName ?? "Loading…"}</strong>
            <small>{user?.email ?? ""}</small>
          </div>
          <Icon name="logout" size={17} />
        </button>
      </aside>

      <section className="workspace" id="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">QUERY WORKSPACE</span>
            <h1>Ask your data</h1>
          </div>

          <div className="top-actions">
            <button className="icon-button" title="Help">
              <Icon name="help" size={18} />
            </button>
            <button
              className="upgrade-button"
              onClick={() => setShowSourceForm(true)}
            >
              Add data source <Icon name="plus" size={15} />
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}

        <div className="content-grid">
          <section className="query-column">
            <div className="question-card">
              <div className="card-label">
                <span className="label-icon">
                  <Icon name="sparkle" size={14} />
                </span>
                Ask in plain English
                <span className="shortcut">⌘ ↵ to run</span>
              </div>

              <textarea
                value={state.question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="e.g. What were our best-selling products last month?"
                rows={4}
              />

              <div className="question-footer">
                <div className="context-pill">
                  <Icon name="database" size={14} />
                  {selectedSource
                    ? `Using ${selectedSource.name}`
                    : "No data source selected"}
                </div>

                <button
                  className="run-button"
                  onClick={runQuery}
                  disabled={state.isLoading || !selectedSource}
                >
                  {state.isLoading ? "Thinking..." : "Run query"}
                  <Icon name="play" size={14} />
                </button>
              </div>
            </div>

            <div className="suggestions">
              <span>Try asking</span>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setQuestion(suggestion)}
                >
                  {suggestion}
                  <Icon name="arrow-up-right" size={14} />
                </button>
              ))}
            </div>

            <ResultCard
              activeTab={activeTab}
              onTabChange={setActiveTab}
              result={state.result}
            />
          </section>

          <aside className="insight-column">
            <SchemaCard
              schema={schema}
              source={selectedSource}
              busy={sourceBusy}
              onSync={() => handleSourceAction("sync")}
            />

            <div className="insight-card">
              <div className="panel-title">
                <span>
                  <Icon name="settings" size={16} /> Data source
                </span>
              </div>

              <p className="panel-subtitle">
                {selectedSource
                  ? `${selectedSource.host}:${selectedSource.port}/${selectedSource.databaseName}`
                  : "Connect a MySQL database"}
              </p>

              <div className="source-actions">
                <button
                  onClick={() => handleSourceAction("test")}
                  disabled={!selectedSource || sourceBusy}
                >
                  Test connection
                </button>
                <button
                  onClick={handleArchive}
                  disabled={!selectedSource || sourceBusy}
                >
                  Archive
                </button>
              </div>
            </div>

            <div className="tip-card">
              <div className="tip-icon">
                <Icon name="lightbulb" size={18} />
              </div>

              <div>
                <strong>Backend-ready workspace</strong>
                <p>
                  Auth, ownership và data source đều đang dùng API thật của
                  Spring Boot.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {showSourceForm && (
        <SourceModal
          form={sourceForm}
          busy={sourceBusy}
          onChange={updateSourceField}
          onSubmit={handleSourceSubmit}
          onClose={() => setShowSourceForm(false)}
        />
      )}
    </main>
  );
}

function ConnectionCard({
  source,
  onAdd,
}: {
  source?: DataSource;
  onAdd: () => void;
}) {
  return (
    <div className="connection-card">
      <div className="connection-heading">
        <span
          className={
            source?.status === "ACTIVE"
              ? "status-dot"
              : "status-dot muted-dot"
          }
        />
        {source?.status === "ACTIVE" ? "Connected" : "No connection"}
        <Icon name="chevron" size={15} />
      </div>

      {source ? (
        <>
          <div className="connection-meta">
            <span className="db-icon">MY</span>
            <div>
              <strong>{source.name}</strong>
              <small>
                {source.databaseName} · {source.status}
              </small>
            </div>
          </div>

          <button className="manage-btn" onClick={onAdd}>
            <Icon name="settings" size={15} /> Manage connection
          </button>
        </>
      ) : (
        <button className="manage-btn" onClick={onAdd}>
          <Icon name="plus" size={15} /> Add data source
        </button>
      )}
    </div>
  );
}

function SchemaCard({
  schema,
  source,
  busy,
  onSync,
}: {
  schema: SchemaTable[];
  source?: DataSource;
  busy: boolean;
  onSync: () => void;
}) {
  return (
    <div className="insight-card">
      <div className="panel-title">
        <span>
          <Icon name="layers" size={16} /> Schema explorer
        </span>
        <button className="icon-action" onClick={onSync} disabled={!source || busy}>
          <Icon name="refresh" size={16} />
        </button>
      </div>

      <p className="panel-subtitle">
        {schema.length
          ? `${schema.length} tables from ${source?.databaseName}`
          : "Sync a data source to browse tables"}
      </p>

      {schema.length ? (
        schema.slice(0, 8).map((table) => (
          <SchemaTable key={table.name} table={table} />
        ))
      ) : (
        <div className="empty-state">
          <Icon name="database" size={22} />
          <span>No schema snapshot yet.</span>
          <button onClick={onSync} disabled={!source || busy}>
            Sync schema
          </button>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  activeTab,
  onTabChange,
  result,
}: {
  activeTab: "table" | "sql";
  onTabChange: (tab: "table" | "sql") => void;
  result: { title: string; sql: string; rows: Record<string, string>[] };
}) {
  return (
    <div className="result-card">
      <div className="result-header">
        <div>
          <span className="eyebrow">DEMO RESULT</span>
          <h2>{result.title}</h2>
        </div>
        <span className="rows-count">
          <span className="success-dot" /> {result.rows.length} rows
        </span>
      </div>

      <div className="tabs">
        <button
          className={activeTab === "table" ? "tab active" : "tab"}
          onClick={() => onTabChange("table")}
        >
          Table
        </button>
        <button
          className={activeTab === "sql" ? "tab active" : "tab"}
          onClick={() => onTabChange("sql")}
        >
          SQL
        </button>
      </div>

      {activeTab === "table" ? (
        <ResultTable rows={result.rows} />
      ) : (
        <pre className="sql-view">{result.sql}</pre>
      )}

      <div className="result-footer">
        <span>Text-to-SQL endpoint chưa có trong backend</span>
        <button
          className="copy-button"
          onClick={() => navigator.clipboard?.writeText(result.sql)}
        >
          <Icon name="copy" size={14} /> Copy SQL
        </button>
      </div>
    </div>
  );
}

function SourceModal({
  form,
  busy,
  onChange,
  onSubmit,
  onClose,
}: {
  form: DataSourceInput;
  busy: boolean;
  onChange: <K extends keyof DataSourceInput>(
    field: K,
    value: DataSourceInput[K],
  ) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="source-modal" onSubmit={onSubmit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">CONNECTION</span>
            <h2>Add data source</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="modal-copy">
          Kết nối MySQL để lưu schema snapshot cho workspace.
        </p>

        <div className="form-grid">
          <SourceField
            label="Name"
            required
            value={form.name}
            onChange={(value) => onChange("name", value)}
            placeholder="Analytics database"
          />
          <SourceField
            label="Database"
            required
            value={form.databaseName}
            onChange={(value) => onChange("databaseName", value)}
            placeholder="ai_agent"
          />
          <SourceField
            label="Host"
            required
            value={form.host}
            onChange={(value) => onChange("host", value)}
          />
          <SourceField
            label="Port"
            required
            type="number"
            value={form.port}
            onChange={(value) => onChange("port", Number(value))}
          />
          <SourceField
            label="Username"
            required
            value={form.username}
            onChange={(value) => onChange("username", value)}
          />
          <SourceField
            label="Password"
            required
            type="password"
            value={form.password}
            onChange={(value) => onChange("password", value)}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="run-button" disabled={busy}>
            {busy ? "Saving..." : "Add connection"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SourceField({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input {...props} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function initials(name?: string) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "??"
  );
}

function ResultTable({ rows }: { rows: Record<string, string>[] }) {
  const columns = Object.keys(rows[0] ?? {});

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{row[column]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchemaTable({ table }: { table: SchemaTable }) {
  return (
    <details className="schema-details">
      <summary className="schema-item">
        <span className="table-icon">
          <Icon name="table" size={15} />
        </span>
        <span>
          <strong>{table.name}</strong>
          <small>
            {table.columns?.map((column) => column.name).join(" · ") ||
              "No columns"}
          </small>
        </span>
        <Icon name="chevron-right" size={15} />
      </summary>

      <div className="column-list">
        {table.columns?.map((column) => (
          <span key={column.name}>
            <b>{column.name}</b>
            <small>{column.type ?? "column"}</small>
          </span>
        ))}
      </div>
    </details>
  );
}
