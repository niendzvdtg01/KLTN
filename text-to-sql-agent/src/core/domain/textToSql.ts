export type ChartType = "table" | "bar" | "line" | "pie" | "number";
export type ChartSpec = { type: ChartType; x?: string | null; y?: string | null; title?: string | null };
export type QueryRow = Record<string, unknown>;

export type QueryResult = {
  title: string;
  sql: string;
  rows: QueryRow[];
  chart?: ChartSpec;
  evaluation?: string | null;
  highlights?: string[];
  messageId?: number | null;
  queryId?: number | null;
  rowCount?: number | null;
  executionTimeMs?: number | null;
  attempts?: number;
};

export type AgentStepStatus = "running" | "ok" | "error";
export type AgentStepItem = { step: number; tool: string; thought: string | null; detail: string | null; status: AgentStepStatus };
export type AgentRetryNotice = { attempt: number; maxAttempts: number; message: string; action: string };
export type AgentProgress = { steps: AgentStepItem[]; retry: AgentRetryNotice | null; failure: string | null };

export type TextToSqlState = { question: string; isLoading: boolean; result: QueryResult | null; progress: AgentProgress | null };
