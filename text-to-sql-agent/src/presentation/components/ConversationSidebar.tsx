"use client";

import { useState } from "react";

import { Icon } from "./Icon";
import type { Conversation } from "@/src/data/conversationApi";

type Props = {
  conversations: Conversation[];
  selectedId: number | null;
  busy: boolean;
  onSelect: (conversation: Conversation) => void;
  onRename: (conversation: Conversation, title: string) => void;
  onArchive: (conversation: Conversation) => void;
};

export function ConversationSidebar({ conversations, selectedId, busy, onSelect, onRename, onArchive }: Props) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const matches = (item: Conversation) => !term || `${item.title} ${item.dataSourceName}`.toLowerCase().includes(term);
  const active = conversations.filter((item) => item.status === "ACTIVE" && matches(item));
  const archived = conversations.filter((item) => item.status === "ARCHIVED" && matches(item));
  const itemProps = { selectedId, busy, onSelect, onRename, onArchive };

  return (
    <section className="sidebar-section conversation-panel" aria-label="Hội thoại">
      <label className="sidebar-search">
        <Icon name="search" size={14} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm hội thoại…" />
      </label>
      <div className="sidebar-heading"><span>Gần đây</span><b>{active.length}</b></div>
      {active.length ? (
        <div className="conversation-list">
          {active.map((conversation) => <ConversationItem key={conversation.id} conversation={conversation} {...itemProps} />)}
        </div>
      ) : (
        <p className="conversation-empty">{term ? "Không tìm thấy hội thoại phù hợp." : "Chưa có hội thoại nào. Hãy đặt câu hỏi đầu tiên."}</p>
      )}

      {archived.length > 0 && (
        <details className="archived-conversations">
          <summary><Icon name="archive" size={13} /> Đã lưu trữ · {archived.length}</summary>
          <div className="conversation-list">
            {archived.map((conversation) => <ConversationItem key={conversation.id} conversation={conversation} {...itemProps} />)}
          </div>
        </details>
      )}
    </section>
  );
}

function ConversationItem({ conversation, selectedId, busy, onSelect, onRename, onArchive }: Omit<Props, "conversations"> & { conversation: Conversation }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);

  function commit() {
    const next = title.trim();
    if (next && next !== conversation.title) onRename(conversation, next);
    else setTitle(conversation.title);
    setEditing(false);
  }

  if (editing) {
    return (
      <form className="conversation-item editing" onSubmit={(event) => { event.preventDefault(); commit(); }}>
        <input autoFocus value={title} maxLength={255} onChange={(event) => setTitle(event.target.value)} onBlur={commit}
          onKeyDown={(event) => { if (event.key === "Escape") { setTitle(conversation.title); setEditing(false); } }} />
      </form>
    );
  }

  return (
    <div className={conversation.id === selectedId ? "conversation-item selected" : "conversation-item"}>
      <button className="conversation-select" onClick={() => onSelect(conversation)}>
        <Icon name="message" size={14} />
        <span className="conversation-copy">
          <strong>{conversation.title}</strong>
          <small>{conversation.dataSourceName} · {formatDate(conversation.lastMessageAt ?? conversation.updatedAt)}</small>
        </span>
      </button>
      <span className="conversation-actions">
        <button onClick={() => setEditing(true)} disabled={busy} title="Đổi tên"><Icon name="edit" size={13} /></button>
        {conversation.status === "ACTIVE" && (
          <button onClick={() => { if (window.confirm(`Lưu trữ “${conversation.title}”?`)) onArchive(conversation); }} disabled={busy} title="Lưu trữ">
            <Icon name="archive" size={13} />
          </button>
        )}
      </span>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}
