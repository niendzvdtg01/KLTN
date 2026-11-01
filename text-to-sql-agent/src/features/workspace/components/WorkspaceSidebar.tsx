"use client";

import { Icon } from "@/src/presentation/components/Icon";
import { ConversationSidebar } from "@/src/presentation/components/ConversationSidebar";
import type { WorkspaceModel } from "../hooks/useWorkspace";
import { statusTone } from "../constants";
import { EngineBadge } from "./EngineBadge";

export function WorkspaceSidebar({ model }: { model: WorkspaceModel }) {
  const { user, selectedSource, conversationBusy, activeSources } = model;
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Icon name="sparkle" size={16} /></span><span>queryly</span></div>
      <button className="new-chat" onClick={model.createNewConversation} disabled={conversationBusy || !selectedSource}>
        <Icon name="plus" size={16} /> Hội thoại mới
      </button>

      <ConversationSidebar
        conversations={model.conversations}
        selectedId={model.selectedConversationId}
        busy={conversationBusy}
        onSelect={model.selectConversation}
        onRename={model.renameConversation}
        onArchive={model.archiveSelectedConversation}
      />

      <section className="sidebar-section sources-section">
        <div className="sidebar-heading"><span>Kết nối</span><button className="sidebar-icon" onClick={model.openCreateSource} title="Thêm kết nối"><Icon name="plus" size={14} /></button></div>
        {activeSources.length ? <div className="source-list">
          {activeSources.map((source) => (
            <button key={source.id} className={source.id === selectedSource?.id ? "source-item selected" : "source-item"} onClick={() => model.selectSource(source.id)}>
              <EngineBadge code={source.dbType} size="sm" />
              <span className="source-copy"><strong>{source.name}</strong><small>{source.databaseName}</small></span>
              <span className={`dot ${statusTone(source.status, source.lastConnectionStatus)}`} />
            </button>
          ))}
        </div> : <button className="sidebar-empty" onClick={model.openCreateSource}><Icon name="database" size={15} /> Thêm kết nối đầu tiên</button>}
      </section>

      <div className="user-menu">
        <span className="avatar">{initials(user?.fullName)}</span>
        <div><strong>{user?.fullName ?? "Đang tải…"}</strong><small>{user?.email ?? ""}</small></div>
        <button className="sidebar-icon" onClick={model.signOut} title="Đăng xuất"><Icon name="logout" size={16} /></button>
      </div>
    </aside>
  );
}

function initials(name?: string) {
  return name?.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "··";
}
