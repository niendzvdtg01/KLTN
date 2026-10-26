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
  metadata: string | null;
  createdAt: string;
};

export type ChatResponse = {
  message: ConversationMessage;
  query: { id: number; question: string; generatedSql: string; status: string; resultJson: string | null; rowCount: number | null; executionTimeMs: number | null; errorMessage: string | null; createdAt: string };
  chartType: "table" | "bar" | "line" | "pie" | "number";
  chartX: string | null;
  chartY: string | null;
  chartTitle: string | null;
  evaluation: string | null;
  highlights: string[];
  attempts: number;
  cacheHit: boolean;
};

export type FeedbackRating = "UP" | "DOWN";

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

export function sendConversationMessage(id: number, content: string) {
  return request<ChatResponse>(`/v1/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function sendMessageFeedback(conversationId: number, messageId: number, rating: FeedbackRating, correction?: string) {
  return request<void>(`/v1/conversations/${conversationId}/messages/${messageId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating, correction: correction ?? null }),
  });
}
