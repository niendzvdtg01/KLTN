import { useState } from "react";
import type { TextToSqlState } from "../../core/domain/textToSql";
import { sendConversationMessage } from "../../data/conversationApi";

export function useTextToSql() {
  const [state, setState] = useState<TextToSqlState>({ question: "", isLoading: false, result: null });
  const setQuestion = (question: string) => setState((current) => ({ ...current, question }));
  const runQuery = async (conversationId: number | null) => {
    if (!conversationId || !state.question.trim()) return;
    setState((current) => ({ ...current, isLoading: true }));
    try {
      const response = await sendConversationMessage(conversationId, state.question.trim());
      const parsed = response.query.resultJson
        ? (JSON.parse(response.query.resultJson) as { rows?: Record<string, unknown>[] })
        : {};
      setState((current) => ({
        ...current,
        isLoading: false,
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
      setState((current) => ({ ...current, isLoading: false }));
      throw error;
    }
  };
  return { state, setQuestion, runQuery };
}
