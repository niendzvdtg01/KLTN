"use client";

import { Icon } from "@/src/presentation/components/Icon";
import type { ConversationMessage } from "@/src/data/conversationApi";
import type { QueryResult } from "@/src/core/domain/textToSql";
import type { ResultTab } from "../constants";
import type { WorkspaceModel } from "../hooks/useWorkspace";
import { suggestions } from "../constants";
import { AgentTimeline } from "./AgentTimeline";
import { ChartCard } from "./ChartView";
import { DataEvaluation } from "./DataEvaluation";
import { FeedbackBar } from "./FeedbackBar";

export function QueryPanel({ model }: { model: WorkspaceModel }) {
  const { state, selectedSource, conversationMessages } = model;
  return <section className="query-column">
    <div className="question-card">
      <div className="card-label"><span className="label-icon"><Icon name="sparkle" size={14} /></span>Hỏi bằng ngôn ngữ tự nhiên<span className="shortcut">⌘ ↵ để chạy</span></div>
      <textarea value={state.question} onChange={(event) => model.setQuestion(event.target.value)} placeholder="vd. Doanh thu theo tháng trong năm nay?" rows={4} />
      <div className="question-footer"><div className="context-pill"><Icon name="database" size={14} />{selectedSource ? `Đang dùng ${selectedSource.name}` : "Chưa chọn data source"}</div>
        <button className="run-button" onClick={model.runQuery} disabled={state.isLoading || !selectedSource}>{state.isLoading ? "Đang suy nghĩ..." : "Chạy truy vấn"}<Icon name="play" size={14} /></button>
      </div>
    </div>
    <div className="suggestions"><span>Gợi ý</span>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => model.setQuestion(suggestion)}>{suggestion}<Icon name="arrow-up-right" size={14} /></button>)}</div>
    {conversationMessages.length > 0 && <MessageHistory messages={conversationMessages} />}
    {state.progress && <AgentTimeline key={state.result?.queryId ?? "running"} progress={state.progress} isLoading={state.isLoading} />}
    {state.result && !state.isLoading
      ? <>
        <ResultCard activeTab={model.activeTab} onTabChange={model.setActiveTab} result={state.result} conversationId={model.selectedConversationId} />
        <ChartCard key={state.result.queryId ?? state.result.sql} result={state.result} />
      </>
      : <EmptyResult />}
  </section>;
}

function EmptyResult() {
  return <div className="result-card empty-result"><Icon name="chart" size={30} /><h2>Chưa có kết quả</h2><p>Đặt một câu hỏi để agent sinh SQL, chạy và đánh giá dữ liệu cho bạn.</p></div>;
}

function MessageHistory({ messages }: { messages: ConversationMessage[] }) {
  return <section className="message-history"><div className="panel-title"><span><Icon name="clock" size={16} /> Lịch sử hội thoại</span><span className="message-count">{messages.filter((message) => message.role !== "TOOL").length} tin nhắn</span></div><div className="message-list">{messages.filter((message) => message.role !== "TOOL").map((message) => <article key={message.id} className={`message-bubble ${message.role.toLowerCase()}`}><span>{message.role}</span><p>{message.content}</p></article>)}</div></section>;
}

const TABS: { key: ResultTab; label: string; icon: "table" | "code" | "trend" }[] = [
  { key: "table", label: "Bảng", icon: "table" },
  { key: "sql", label: "SQL", icon: "code" },
  { key: "insight", label: "Đánh giá", icon: "trend" },
];

function ResultCard({ activeTab, onTabChange, result, conversationId }: { activeTab: ResultTab; onTabChange: (tab: ResultTab) => void; result: QueryResult; conversationId: number | null }) {
  return <div className="result-card"><div className="result-header"><div><span className="eyebrow">KẾT QUẢ</span><h2>{result.title}</h2></div>
      <div className="meta-chips">
        <span className="chip"><span className="success-dot" /> {result.rowCount ?? result.rows.length} dòng</span>
        {typeof result.executionTimeMs === "number" && <span className="chip">{result.executionTimeMs} ms</span>}
        {typeof result.attempts === "number" && result.attempts > 1 && <span className="chip warn">tự sửa {result.attempts}×</span>}
      </div>
    </div>
    <div className="tabs">{TABS.map((tab) => <button key={tab.key} className={activeTab === tab.key ? "tab active" : "tab"} onClick={() => onTabChange(tab.key)}><Icon name={tab.icon} size={14} /> {tab.label}</button>)}</div>
    <div className="tab-body">
      {activeTab === "table" && <ResultTable rows={result.rows} />}
      {activeTab === "sql" && <pre className="sql-view">{result.sql}</pre>}
      {activeTab === "insight" && <DataEvaluation evaluation={result.evaluation} highlights={result.highlights} />}
    </div>
    {conversationId && result.messageId && <FeedbackBar conversationId={conversationId} messageId={result.messageId} />}
    <div className="result-footer"><span>{result.chart?.title ?? "Kết quả chỉ đọc"}</span><button className="copy-button" onClick={() => navigator.clipboard?.writeText(result.sql)}><Icon name="copy" size={14} /> Sao chép SQL</button></div>
  </div>;
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="empty-state"><Icon name="table" size={22} /><span>Truy vấn không trả về dòng nào.</span></div>;
  const columns = Object.keys(rows[0] ?? {});
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div>;
}
