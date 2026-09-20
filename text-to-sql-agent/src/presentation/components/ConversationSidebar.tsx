"use client";

import { useState } from "react";

import { Icon } from "./Icon";
import type { Conversation } from "@/src/data/conversationApi";

type Props = {
  conversations: Conversation[];
  selectedId: number | null;
  busy: boolean;
  onNew: () => void;
  onSelect: (conversation: Conversation) => void;
  onRename: (conversation: Conversation, title: string) => void;
  onArchive: (conversation: Conversation) => void;
};

export function ConversationSidebar({
  conversations,
  selectedId,
  busy,
  onNew,
  onSelect,
  onRename,
  onArchive,
}: Props) {
  const active = conversations.filter((item) => item.status === "ACTIVE");
  const archived = conversations.filter((item) => item.status === "ARCHIVED");

  return (
    <section className="conversation-panel" aria-label="Conversations">
      <div className="conversation-heading">
        <div>
          <span className="eyebrow">YOUR WORK</span>
          <h2>Conversations</h2>
        </div>
        <button className="icon-action" onClick={onNew} disabled={busy} title="New conversation">
          <Icon name="plus" size={16} />
        </button>
      </div>

      {active.length ? (
        <div className="conversation-list">
          {active.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === selectedId}
              busy={busy}
              onSelect={onSelect}
              onRename={onRename}
              onArchive={onArchive}
            />
          ))}
        </div>
      ) : (
        <p className="conversation-empty">Chưa có conversation nào.</p>
      )}

      {archived.length > 0 && (
        <details className="archived-conversations">
          <summary>Archived · {archived.length}</summary>
          <div className="conversation-list">
            {archived.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedId}
                busy={busy}
                onSelect={onSelect}
                onRename={onRename}
                onArchive={onArchive}
              />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function ConversationItem({
  conversation,
  selected,
  busy,
  onSelect,
  onRename,
  onArchive,
}: {
  conversation: Conversation;
  selected: boolean;
  busy: boolean;
  onSelect: (conversation: Conversation) => void;
  onRename: (conversation: Conversation, title: string) => void;
  onArchive: (conversation: Conversation) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function rename() {
    const title = window.prompt("Tên conversation", conversation.title)?.trim();
    if (title && title !== conversation.title) onRename(conversation, title);
    setMenuOpen(false);
  }

  function archive() {
    if (window.confirm(`Archive “${conversation.title}”?`)) onArchive(conversation);
    setMenuOpen(false);
  }

  return (
    <div className={selected ? "conversation-item selected" : "conversation-item"}>
      <button className="conversation-select" onClick={() => onSelect(conversation)}>
        <span className="history-icon"><Icon name="clock" size={14} /></span>
        <span className="conversation-copy">
          <strong>{conversation.title}</strong>
          <small>{conversation.dataSourceName} · {formatDate(conversation.updatedAt)}</small>
        </span>
      </button>
      <button className="conversation-menu-button" onClick={() => setMenuOpen((open) => !open)} disabled={busy} aria-label="Conversation actions">
        ···
      </button>
      {menuOpen && (
        <div className="conversation-menu">
          <button onClick={rename}>Rename</button>
          {conversation.status === "ACTIVE" && <button onClick={archive}>Archive</button>}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("vi-VN");
}
