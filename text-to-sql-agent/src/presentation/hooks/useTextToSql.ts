import { useState } from "react";
import type { AgentProgress, TextToSqlState } from "../../core/domain/textToSql";
import { streamConversationMessage, type AgentStreamEvent } from "../../data/conversationApi";

const emptyProgress: AgentProgress = { steps: [], retry: null, failure: null };

function applyEvent(progress: AgentProgress, event: AgentStreamEvent): AgentProgress {
  switch (event.type) {
    case "thought": {
      const { step, tool, message } = event.data;
      const args = event.data.args ?? {};
      const detail = (args.sql ?? [args.table, args.column].filter(Boolean).join(".")) || null;
      return { ...progress, steps: [...progress.steps.filter((item) => item.step !== step), { step, tool, thought: message, detail, status: "running" }] };
    }
    case "observation": {
      const { step, status, message } = event.data;
      const steps = progress.steps.map((item) => item.step === step ? { ...item, status, detail: status === "error" ? message : `${item.detail ? `${item.detail} → ` : ""}${message}` } : item);
      // A successful step means the previous problem was recovered from.
      return { ...progress, steps, retry: status === "ok" ? null : progress.retry };
    }
    case "retry":
      return { ...progress, retry: event.data };
    default:
      return progress;
  }
}

export function useTextToSql() {
  const [state, setState] = useState<TextToSqlState>({ question: "", pending: null, isLoading: false, result: null, progress: null });
  const setQuestion = (question: string) => setState((current) => ({ ...current, question }));
  const reset = () => setState({ question: "", pending: null, isLoading: false, result: null, progress: null });
  const runQuery = async (conversationId: number | null) => {
    const question = state.question.trim();
    if (!conversationId || !question || state.isLoading) return;
    setState((current) => ({ ...current, question: "", pending: question, isLoading: true, result: null, progress: emptyProgress }));
    try {
      const response = await streamConversationMessage(conversationId, question, (event) =>
        setState((current) => ({ ...current, progress: applyEvent(current.progress ?? emptyProgress, event) })));
      const parsed = response.query.resultJson
        ? (JSON.parse(response.query.resultJson) as { rows?: Record<string, unknown>[] })
        : {};
      setState((current) => ({
        ...current,
        pending: null,
        isLoading: false,
        progress: current.progress ? { ...current.progress, retry: null } : null,
        result: {
          title: response.chartTitle ?? response.message.content.split("\n")[0],
          sql: response.query.generatedSql,
          rows: parsed.rows ?? [],
          chart: { type: response.chartType, x: response.chartX, y: response.chartY, title: response.chartTitle },
          evaluation: response.evaluation,
          highlights: response.highlights ?? [],
          messageId: response.message.id,
          queryId: response.query.id,
          rowCount: response.query.rowCount,
          executionTimeMs: response.query.executionTimeMs,
          attempts: response.attempts,
        },
      }));
      return response;
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Agent không thể hoàn thành câu hỏi.";
      // Give the question back to the composer so it can be rephrased.
      setState((current) => ({ ...current, question: current.question || question, isLoading: false, progress: { ...(current.progress ?? emptyProgress), retry: null, failure } }));
      throw error;
    }
  };
  return { state, setQuestion, runQuery, reset };
}
