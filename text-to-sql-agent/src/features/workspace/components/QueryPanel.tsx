"use client";

import { Icon } from "@/src/presentation/components/Icon";
import type { ConversationMessage } from "@/src/data/conversationApi";
import type { QueryResult } from "@/src/core/domain/textToSql";
import type { ResultTab } from "../constants";
import type { WorkspaceModel } from "../hooks/useWorkspace";
import { suggestions } from "../constants";

export function QueryPanel({ model }: { model: WorkspaceModel }) {
  const { state, selectedSource, conversationMessages } = model;
  return <section className="query-column">
    <div className="question-card">
      <div className="card-label"><span className="label-icon"><Icon name="sparkle" size={14} /></span>Ask in plain English<span className="shortcut">⌘ ↵ to run</span></div>
      <textarea value={state.question} onChange={(event) => model.setQuestion(event.target.value)} placeholder="e.g. What were our best-selling products last month?" rows={4} />
      <div className="question-footer"><div className="context-pill"><Icon name="database" size={14} />{selectedSource ? `Using ${selectedSource.name}` : "No data source selected"}</div>
        <button className="run-button" onClick={model.runQuery} disabled={state.isLoading || !selectedSource}>{state.isLoading ? "Thinking..." : "Run query"}<Icon name="play" size={14} /></button>
      </div>
    </div>
    <div className="suggestions"><span>Try asking</span>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => model.setQuestion(suggestion)}>{suggestion}<Icon name="arrow-up-right" size={14} /></button>)}</div>
    {conversationMessages.length > 0 && <MessageHistory messages={conversationMessages} />}
    <ResultCard activeTab={model.activeTab} onTabChange={model.setActiveTab} result={state.result} />
  </section>;
}

function MessageHistory({ messages }: { messages: ConversationMessage[] }) {
  return <section className="message-history"><div className="panel-title"><span><Icon name="clock" size={16} /> Conversation history</span><span className="message-count">{messages.length} messages</span></div><div className="message-list">{messages.map((message) => <article key={message.id} className={`message-bubble ${message.role.toLowerCase()}`}><span>{message.role}</span><p>{message.content}</p></article>)}</div></section>;
}

function ResultCard({ activeTab, onTabChange, result }: { activeTab: ResultTab; onTabChange: (tab: ResultTab) => void; result: QueryResult }) {
  return <div className="result-card"><div className="result-header"><div><span className="eyebrow">DEMO RESULT</span><h2>{result.title}</h2></div><span className="rows-count"><span className="success-dot" /> {result.rows.length} rows</span></div>
    <div className="tabs"><button className={activeTab === "table" ? "tab active" : "tab"} onClick={() => onTabChange("table")}>Table</button><button className={activeTab === "sql" ? "tab active" : "tab"} onClick={() => onTabChange("sql")}>SQL</button></div>
    {activeTab === "table" ? <ResultTable rows={result.rows} /> : <pre className="sql-view">{result.sql}</pre>}
    <div className="result-footer"><span>Text-to-SQL endpoint chưa có trong backend</span><button className="copy-button" onClick={() => navigator.clipboard?.writeText(result.sql)}><Icon name="copy" size={14} /> Copy SQL</button></div>
  </div>;
}

function ResultTable({ rows }: { rows: Record<string, string>[] }) {
  const columns = Object.keys(rows[0] ?? {});
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{row[column]}</td>)}</tr>)}</tbody></table></div>;
}
