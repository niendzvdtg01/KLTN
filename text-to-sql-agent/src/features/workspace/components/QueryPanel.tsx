"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@/src/presentation/components/Icon";
import type { ConversationMessage } from "@/src/data/conversationApi";
import type { QueryResult } from "@/src/core/domain/textToSql";
import type { ResultTab } from "../constants";
import type { WorkspaceModel } from "../hooks/useWorkspace";
import { suggestions } from "../constants";
import { buildChartModel } from "../chartData";
import { AgentTimeline } from "./AgentTimeline";
import { ChartCard } from "./ChartView";
import { DataEvaluation } from "./DataEvaluation";
import { FeedbackBar } from "./FeedbackBar";

export function QueryPanel({ model }: { model: WorkspaceModel }) {
  const { state, selectedSource, conversationMessages, loaded } = model;
  const endRef = useRef<HTMLDivElement>(null);
  const messages = conversationMessages.filter((message) => message.role === "USER" || message.role === "ASSISTANT");
  const canAsk = selectedSource?.status === "ACTIVE";
  const isEmpty = !messages.length && !state.pending && !state.result;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, state.pending, state.progress?.steps.length, state.result]);

  return <section className="chat">
    <div className="thread">
      <div className="thread-inner">
        {loaded && !selectedSource && <Onboarding onAdd={model.openCreateSource} />}
        {selectedSource && isEmpty && <Welcome sourceName={selectedSource.name} hasSchema={model.schema.length > 0} onPick={model.setQuestion} onSync={() => model.runSourceAction("sync")} />}
        {messages.map((message) => message.role === "USER"
          ? <UserBubble key={message.id} text={message.content} />
          : message.id === state.result?.messageId ? null : <AssistantSummary key={message.id} message={message} />)}
        {state.pending && <UserBubble text={state.pending} />}
        {state.progress && <AgentTimeline key={state.result?.queryId ?? "running"} progress={state.progress} isLoading={state.isLoading} />}
        {state.result && !state.isLoading && <ResultCard activeTab={model.activeTab} onTabChange={model.setActiveTab} result={state.result} conversationId={model.selectedConversationId} />}
        <div ref={endRef} />
      </div>
    </div>
    <Composer
      value={state.question}
      onChange={model.setQuestion}
      onSubmit={model.runQuery}
      disabled={!canAsk}
      busy={state.isLoading}
      placeholder={canAsk ? `Hỏi về dữ liệu trong ${selectedSource?.name}…` : "Thêm hoặc chọn một kết nối để bắt đầu"}
    />
  </section>;
}

function Composer({ value, onChange, onSubmit, disabled, busy, placeholder }: { value: string; onChange: (value: string) => void; onSubmit: () => void; disabled: boolean; busy: boolean; placeholder: string }) {
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!disabled && !busy && value.trim()) onSubmit();
    }
  }
  return <div className="composer-wrap">
    <div className={disabled ? "composer disabled" : "composer"}>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} rows={1} disabled={disabled} aria-label="Câu hỏi" />
      <button className="send-button" onClick={onSubmit} disabled={disabled || busy || !value.trim()} aria-label="Gửi câu hỏi">
        {busy ? <span className="spinner" /> : <Icon name="arrow-up" size={17} />}
      </button>
    </div>
    <p className="composer-hint"><kbd>Enter</kbd> để gửi · <kbd>Shift</kbd>+<kbd>Enter</kbd> xuống dòng · Agent chỉ chạy truy vấn đọc dữ liệu</p>
  </div>;
}

function Onboarding({ onAdd }: { onAdd: () => void }) {
  const steps: { icon: IconName; title: string; text: string }[] = [
    { icon: "database", title: "Kết nối database", text: "MySQL, MariaDB, PostgreSQL, SQL Server hoặc Oracle." },
    { icon: "layers", title: "Đồng bộ schema", text: "Agent đọc tên bảng và cột, không đọc dữ liệu." },
    { icon: "message", title: "Đặt câu hỏi", text: "Nhận SQL, bảng kết quả, biểu đồ và phân tích." },
  ];
  return <div className="onboarding">
    <span className="hero-icon"><Icon name="sparkle" size={26} /></span>
    <h2>Bắt đầu bằng một kết nối</h2>
    <p>Queryly biến câu hỏi tiếng Việt thành SQL an toàn, chỉ đọc, trên chính database của bạn.</p>
    <ol className="onboarding-steps">
      {steps.map((step, index) => <li key={step.title}><span className="step-icon"><Icon name={step.icon} size={18} /></span><div><small>Bước {index + 1}</small><strong>{step.title}</strong><p>{step.text}</p></div></li>)}
    </ol>
    <button className="primary-button large" onClick={onAdd}><Icon name="plus" size={16} /> Thêm kết nối</button>
  </div>;
}

function Welcome({ sourceName, hasSchema, onPick, onSync }: { sourceName: string; hasSchema: boolean; onPick: (value: string) => void; onSync: () => void }) {
  return <div className="welcome">
    <span className="hero-icon"><Icon name="sparkle" size={26} /></span>
    <h2>Bạn muốn biết gì về {sourceName}?</h2>
    {hasSchema
      ? <p>Hỏi bằng ngôn ngữ tự nhiên. Agent sẽ khám phá schema, viết SQL, chạy và giải thích kết quả.</p>
      : <p className="welcome-warn"><Icon name="alert" size={15} /> Kết nối chưa có schema. <button className="link-button" onClick={onSync}>Đồng bộ schema</button> để agent hiểu cấu trúc dữ liệu.</p>}
    <div className="suggestion-grid">
      {suggestions.map((suggestion) => <button key={suggestion} onClick={() => onPick(suggestion)}><Icon name="lightbulb" size={15} /><span>{suggestion}</span></button>)}
    </div>
  </div>;
}

function UserBubble({ text }: { text: string }) {
  return <div className="msg user"><div className="bubble">{text}</div></div>;
}

type AssistantMeta = { title?: string; sql?: string; evaluation?: string; highlights?: string[]; attempts?: number };

function AssistantSummary({ message }: { message: ConversationMessage }) {
  const meta = useMemo(() => {
    try { return message.metadata ? JSON.parse(message.metadata) as AssistantMeta : null; } catch { return null; }
  }, [message.metadata]);
  return <div className="msg assistant">
    <span className="assistant-avatar"><Icon name="sparkle" size={14} /></span>
    <div className="assistant-card">
      {meta ? <>
        <strong className="assistant-title">{meta.title}</strong>
        {meta.evaluation && <p className="assistant-text">{meta.evaluation}</p>}
        {meta.sql && <details className="assistant-sql"><summary><Icon name="code" size={13} /> Xem SQL</summary><pre className="sql-view compact">{meta.sql}</pre></details>}
      </> : <p className="assistant-text pre">{message.content}</p>}
    </div>
  </div>;
}

const TABS: { key: ResultTab; label: string; icon: IconName }[] = [
  { key: "chart", label: "Biểu đồ", icon: "chart" },
  { key: "table", label: "Bảng", icon: "table" },
  { key: "sql", label: "SQL", icon: "code" },
  { key: "insight", label: "Phân tích", icon: "trend" },
];

function ResultCard({ activeTab, onTabChange, result, conversationId }: { activeTab: ResultTab; onTabChange: (tab: ResultTab) => void; result: QueryResult; conversationId: number | null }) {
  const chartable = useMemo(() => buildChartModel(result.rows ?? [], result.chart, result.sql).kind !== "empty", [result]);
  const tabs = TABS.filter((tab) => tab.key !== "chart" || chartable);
  const tab = activeTab === "chart" && !chartable ? "table" : activeTab;
  const rowCount = result.rowCount ?? result.rows.length;

  return <div className="msg assistant">
    <span className="assistant-avatar"><Icon name="sparkle" size={14} /></span>
    <div className="result-card">
      <div className="result-header">
        <div className="result-title">
          <h2>{result.title}</h2>
          <div className="meta-chips">
            <span className="chip success"><Icon name="check" size={12} /> {rowCount} dòng</span>
            {typeof result.executionTimeMs === "number" && <span className="chip"><Icon name="clock" size={12} /> {result.executionTimeMs} ms</span>}
            {typeof result.attempts === "number" && result.attempts > 1 && <span className="chip warn"><Icon name="refresh" size={12} /> tự sửa {result.attempts}×</span>}
          </div>
        </div>
        <div className="result-actions">
          <button className="ghost-button small" onClick={() => navigator.clipboard?.writeText(result.sql)} title="Sao chép SQL"><Icon name="copy" size={14} /> SQL</button>
          <button className="ghost-button small" onClick={() => downloadCsv(result)} disabled={!result.rows.length} title="Tải CSV"><Icon name="download" size={14} /> CSV</button>
        </div>
      </div>
      {result.evaluation && tab !== "insight" && <p className="result-summary">{result.evaluation}</p>}
      <div className="tabs" role="tablist">{tabs.map((item) => <button key={item.key} role="tab" aria-selected={tab === item.key} className={tab === item.key ? "tab active" : "tab"} onClick={() => onTabChange(item.key)}><Icon name={item.icon} size={14} /> {item.label}</button>)}</div>
      <div className="tab-body">
        {tab === "chart" && <ChartCard key={result.queryId ?? result.sql} result={result} />}
        {tab === "table" && <ResultTable rows={result.rows} />}
        {tab === "sql" && <pre className="sql-view">{result.sql}</pre>}
        {tab === "insight" && <DataEvaluation evaluation={result.evaluation} highlights={result.highlights} />}
      </div>
      {conversationId && result.messageId && <FeedbackBar conversationId={conversationId} messageId={result.messageId} />}
    </div>
  </div>;
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="empty-state"><Icon name="table" size={22} /><span>Truy vấn không trả về dòng nào.</span></div>;
  const columns = Object.keys(rows[0] ?? {});
  return <div className="table-wrap"><table>
    <thead><tr><th className="row-index">#</th>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}><td className="row-index">{index + 1}</td>{columns.map((column) => <Cell key={column} value={row[column]} />)}</tr>)}</tbody>
  </table></div>;
}

function Cell({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <td className="null-cell">NULL</td>;
  if (typeof value === "number") return <td className="num">{value.toLocaleString("vi-VN")}</td>;
  return <td>{String(value)}</td>;
}

function downloadCsv(result: QueryResult) {
  const columns = Object.keys(result.rows[0] ?? {});
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [columns.map(escape).join(","), ...result.rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${result.title.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 60) || "ket_qua"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
