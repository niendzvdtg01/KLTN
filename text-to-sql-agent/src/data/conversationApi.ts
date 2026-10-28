import { API_URL, request } from "./http";

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
  steps: { tool: string; thought?: string; ok: boolean; error?: string }[];
};

export type AgentStreamEvent =
  | { type: "thought"; data: { step: number; tool: string; message: string | null; args: Record<string, string> } }
  | { type: "observation"; data: { step: number; tool: string; status: "ok" | "error"; message: string } }
  | { type: "retry"; data: { attempt: number; maxAttempts: number; message: string; action: string } }
  | { type: "result"; data: ChatResponse }
  | { type: "error"; data: { message: string } };

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

/**
 * Sends a question and streams the agent's progress (Server-Sent Events over a POST, so it can carry
 * the auth cookie). Resolves with the final answer; rejects when the agent gives up.
 */
export async function streamConversationMessage(id: number, content: string, onEvent: (event: AgentStreamEvent) => void) {
  const response = await fetch(`${API_URL}/v1/conversations/${id}/messages/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Không thể kết nối tới server.");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let result: ChatResponse | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, "\n");
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const event = parseSseEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (!event) continue;
      if (event.type === "error") throw new Error(event.data.message);
      if (event.type === "result") result = event.data;
      onEvent(event);
    }
  }
  if (!result) throw new Error("Kết nối bị ngắt trước khi agent trả lời.");
  return result;
}

function parseSseEvent(block: string): AgentStreamEvent | null {
  let type = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (!data.length) return null;
  try {
    return { type, data: JSON.parse(data.join("\n")) } as AgentStreamEvent;
  } catch {
    return null;
  }
}

export function sendMessageFeedback(conversationId: number, messageId: number, rating: FeedbackRating, correction?: string) {
  return request<void>(`/v1/conversations/${conversationId}/messages/${messageId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating, correction: correction ?? null }),
  });
}
