"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/src/presentation/components/Icon";
import { getCurrentUser } from "@/src/data/authApi";
import { useTextToSql } from "@/src/presentation/hooks/useTextToSql";

const suggestions = ["Show me the top 10 customers by revenue", "Which products are running low on stock?", "Compare monthly sales for this year"];

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    getCurrentUser().catch(() => router.replace("/login"));
  }, [router]);
  const { state, runQuery, setQuestion } = useTextToSql();
  const [activeTab, setActiveTab] = useState<"table" | "sql">("table");
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><Icon name="sparkle" size={18} /></span><span>queryly</span></div>
      <button className="new-query" onClick={() => setQuestion("")}><Icon name="plus" size={17} /> New query <span>⌘ K</span></button>
      <nav className="nav-list"><a className="nav-item active" href="#workspace"><Icon name="terminal" size={18} /> Query workspace</a><a className="nav-item" href="#history"><Icon name="clock" size={18} /> History <b>8</b></a><a className="nav-item" href="#saved"><Icon name="bookmark" size={18} /> Saved queries</a></nav>
      <div className="sidebar-spacer" /><div className="connection-card"><div className="connection-heading"><span className="status-dot" /> Production DB <Icon name="chevron" size={15} /></div><div className="connection-meta"><span className="db-icon">PG</span><div><strong>analytics_prod</strong><small>PostgreSQL · Connected</small></div></div><button className="manage-btn"><Icon name="settings" size={15} /> Manage connection</button></div>
      <div className="user-menu"><span className="avatar">NL</span><div><strong>Nguyen Linh</strong><small>linh.nguyen@company.com</small></div><Icon name="more" size={17} /></div>
    </aside>
    <section className="workspace" id="workspace"><header className="topbar"><div><span className="eyebrow">QUERY WORKSPACE</span><h1>Ask your data</h1></div><div className="top-actions"><button className="icon-button"><Icon name="help" size={18} /></button><button className="upgrade-button">Upgrade <Icon name="arrow-up" size={15} /></button></div></header>
      <div className="content-grid"><section className="query-column"><div className="question-card"><div className="card-label"><span className="label-icon"><Icon name="sparkle" size={14} /></span> Ask in plain English <span className="shortcut">⌘ ↵ to run</span></div><textarea value={state.question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. What were our best-selling products last month?" rows={4} /><div className="question-footer"><div className="context-pill"><Icon name="database" size={14} /> Using analytics_prod <Icon name="chevron" size={13} /></div><button className="run-button" onClick={runQuery} disabled={state.isLoading}>{state.isLoading ? "Thinking..." : "Run query"} <Icon name="play" size={14} /></button></div></div>
        <div className="suggestions"><span>Try asking</span>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion} <Icon name="arrow-up-right" size={14} /></button>)}</div>
        <div className="result-card"><div className="result-header"><div><span className="eyebrow">RESULT</span><h2>{state.result.title}</h2></div><div className="result-actions"><span className="rows-count"><span className="success-dot" /> {state.result.rows.length} rows</span><button className="icon-button"><Icon name="download" size={16} /></button><button className="icon-button"><Icon name="more" size={17} /></button></div></div><div className="tabs"><button className={activeTab === "table" ? "tab active" : "tab"} onClick={() => setActiveTab("table")}>Table</button><button className={activeTab === "sql" ? "tab active" : "tab"} onClick={() => setActiveTab("sql")}>SQL</button></div>{activeTab === "table" ? <ResultTable /> : <pre className="sql-view">{state.result.sql}</pre>}<div className="result-footer"><span>Generated in 1.24s</span><button className="copy-button"><Icon name="copy" size={14} /> Copy results</button></div></div>
      </section><aside className="insight-column"><div className="insight-card"><div className="panel-title"><span><Icon name="layers" size={16} /> Schema explorer</span><Icon name="search" size={16} /></div><p className="panel-subtitle">Browse your connected tables</p><SchemaTable name="customers" columns="id · name · email · created_at" /><SchemaTable name="orders" columns="id · customer_id · total · status" /><SchemaTable name="products" columns="id · name · price · inventory" /></div><div className="insight-card recent-card"><div className="panel-title"><span><Icon name="clock" size={16} /> Recent queries</span><button className="text-button">View all</button></div><RecentQuery text="Top customers by revenue" time="2 min ago" /><RecentQuery text="Monthly order volume" time="Yesterday" /><RecentQuery text="Low inventory products" time="Aug 18" /></div><div className="tip-card"><div className="tip-icon"><Icon name="lightbulb" size={18} /></div><div><strong>Make your questions precise</strong><p>Add a timeframe, metric, or limit to get more accurate results.</p></div><button>×</button></div></aside></div>
    </section></main>;
}

function ResultTable() { const rows = [["1", "Acme Corporation", "$48,290.00", "142"], ["2", "Northstar Labs", "$36,840.50", "98"], ["3", "Brightside Co.", "$29,115.00", "76"], ["4", "Morrow & Sons", "$21,904.25", "64"]]; return <div className="table-wrap"><table><thead><tr><th>#</th><th>customer_name</th><th>total_revenue <Icon name="sort" size={12} /></th><th>orders <Icon name="sort" size={12} /></th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={cell} className={index === 2 ? "money" : ""}>{cell}</td>)}</tr>)}</tbody></table></div>; }
function SchemaTable({ name, columns }: { name: string; columns: string }) { return <button className="schema-item"><span className="table-icon"><Icon name="table" size={15} /></span><span><strong>{name}</strong><small>{columns}</small></span><Icon name="chevron-right" size={15} /></button>; }
function RecentQuery({ text, time }: { text: string; time: string }) { return <button className="recent-item"><span className="history-icon"><Icon name="message" size={14} /></span><span><strong>{text}</strong><small>{time}</small></span><Icon name="arrow-up-right" size={14} /></button>; }

