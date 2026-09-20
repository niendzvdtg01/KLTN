import { request } from "./http";

export type Conversation = {
  id: number;
  title: string;
  status: "ACTIVE" | "ARCHIVED" | string;
  dataSourceId: number;
  dataSourceName: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: number;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL" | string;
  content: string;
  createdAt: string;
};

export function listConversations() {
  return request<Conversation[]>("/v1/conversations");
}

export function createConversation(title: string, dataSourceId: number) {
  return request<Conversation>("/v1/conversations", {
    method: "POST",
    body: JSON.stringify({ title, dataSourceId }),
  });
}

export function updateConversation(id: number, title: string) {
  return request<Conversation>(`/v1/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function archiveConversation(id: number) {
  return request<void>(`/v1/conversations/${id}`, { method: "DELETE" });
}

export function listConversationMessages(id: number) {
  return request<ConversationMessage[]>(`/v1/conversations/${id}/messages`);
}
