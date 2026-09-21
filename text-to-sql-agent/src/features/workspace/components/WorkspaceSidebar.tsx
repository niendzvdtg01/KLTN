"use client";

import { Icon } from "@/src/presentation/components/Icon";
import { ConversationSidebar } from "@/src/presentation/components/ConversationSidebar";
import type { DataSource } from "@/src/data/dataSourceApi";
import type { WorkspaceModel } from "../hooks/useWorkspace";

export function WorkspaceSidebar({ model }: { model: WorkspaceModel }) {
  const { user, selectedSource, conversationBusy } = model;
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Icon name="sparkle" size={18} /></span><span>queryly</span></div>
      <button className="new-query" onClick={model.createNewConversation} disabled={conversationBusy}>
        <Icon name="plus" size={17} /> New query <span>⌘ K</span>
      </button>
      <nav className="nav-list">
        <a className="nav-item active" href="#workspace"><Icon name="terminal" size={18} /> Query workspace</a>
        <a className="nav-item" href="#history"><Icon name="clock" size={18} /> History <b>—</b></a>
        <a className="nav-item" href="#saved"><Icon name="bookmark" size={18} /> Saved queries</a>
      </nav>
      <ConversationSidebar
        conversations={model.conversations}
        selectedId={model.selectedConversationId}
        busy={conversationBusy}
        onNew={model.createNewConversation}
        onSelect={model.selectConversation}
        onRename={model.renameConversation}
        onArchive={model.archiveSelectedConversation}
      />
      <div className="sidebar-spacer" />
      <ConnectionCard source={selectedSource} onAdd={() => model.setShowSourceForm(true)} />
      <button className="user-menu" onClick={model.signOut}>
        <span className="avatar">{initials(user?.fullName)}</span>
        <div><strong>{user?.fullName ?? "Loading…"}</strong><small>{user?.email ?? ""}</small></div>
        <Icon name="logout" size={17} />
      </button>
    </aside>
  );
}

function ConnectionCard({ source, onAdd }: { source?: DataSource; onAdd: () => void }) {
  const connected = source?.status === "ACTIVE";
  return (
    <div className="connection-card">
      <div className="connection-heading"><span className={connected ? "status-dot" : "status-dot muted-dot"} />{connected ? "Connected" : "No connection"}<Icon name="chevron" size={15} /></div>
      {source ? <>
        <div className="connection-meta"><span className="db-icon">MY</span><div><strong>{source.name}</strong><small>{source.databaseName} · {source.status}</small></div></div>
        <button className="manage-btn" onClick={onAdd}><Icon name="settings" size={15} /> Manage connection</button>
      </> : <button className="manage-btn" onClick={onAdd}><Icon name="plus" size={15} /> Add data source</button>}
    </div>
  );
}

function initials(name?: string) {
  return name?.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "??";
}
