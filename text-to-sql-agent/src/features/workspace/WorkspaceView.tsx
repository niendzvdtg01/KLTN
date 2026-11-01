"use client";

import { useState } from "react";
import { Icon } from "@/src/presentation/components/Icon";
import { useWorkspace } from "./hooks/useWorkspace";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { QueryPanel } from "./components/QueryPanel";
import { InsightSidebar } from "./components/InsightSidebar";
import { SourceModal } from "./components/SourceModal";
import { EngineBadge } from "./components/EngineBadge";
import { statusLabel, statusTone } from "./constants";

export default function WorkspaceView() {
  const model = useWorkspace();
  const [showSchema, setShowSchema] = useState(true);
  const { selectedSource, selectedConversation, notice } = model;
  const engine = model.engineOf(selectedSource?.dbType);

  return <main className="app-shell">
    <WorkspaceSidebar model={model} />
    <section className="main" id="workspace">
      <header className="topbar">
        <div className="topbar-title">
          <span className="eyebrow">{selectedConversation ? "Hội thoại" : "Workspace"}</span>
          <h1>{selectedConversation?.title ?? "Hỏi dữ liệu của bạn"}</h1>
        </div>
        {selectedSource && <div className="source-chip" title={`${selectedSource.host}:${selectedSource.port}/${selectedSource.databaseName}`}>
          <EngineBadge code={selectedSource.dbType} size="sm" />
          <span><strong>{selectedSource.name}</strong><small>{engine?.displayName ?? selectedSource.dbType} · {selectedSource.databaseName}{selectedSource.schemaName ? `.${selectedSource.schemaName}` : ""}</small></span>
          <span className={`status-pill ${statusTone(selectedSource.status, selectedSource.lastConnectionStatus)}`}>{statusLabel(selectedSource.status, selectedSource.lastConnectionStatus)}</span>
        </div>}
        <div className="top-actions">
          <button className={showSchema ? "ghost-button active" : "ghost-button"} onClick={() => setShowSchema((value) => !value)} title="Ẩn/hiện bảng schema"><Icon name="panel" size={16} /> Schema</button>
          <button className="primary-button" onClick={model.openCreateSource}><Icon name="plus" size={15} /> Thêm kết nối</button>
        </div>
      </header>
      {notice && <div className={`notice ${notice.tone}`} role="status">
        <Icon name={notice.tone === "error" ? "alert" : notice.tone === "success" ? "check" : "help"} size={16} />
        <span>{notice.text}</span>
        <button onClick={() => model.setNotice("")} aria-label="Đóng thông báo"><Icon name="x" size={14} /></button>
      </div>}
      <div className={showSchema ? "main-body with-panel" : "main-body"}>
        <QueryPanel model={model} />
        {showSchema && <InsightSidebar model={model} />}
      </div>
    </section>
    {model.sourceModal && <SourceModal model={model} />}
  </main>;
}
