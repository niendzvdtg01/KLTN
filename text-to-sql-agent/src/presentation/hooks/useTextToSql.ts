import { useState } from "react";
import { generateQuery } from "../../core/usecases/generateQuery";
import { initialResult, type TextToSqlState } from "../../core/domain/textToSql";
import { textToSqlRepository } from "../../data/textToSqlRepository";
export function useTextToSql() {
  const [state, setState] = useState<TextToSqlState>({ question: "", isLoading: false, result: initialResult });
  const setQuestion = (question: string) => setState((current) => ({ ...current, question }));
  const runQuery = async () => { setState((current) => ({ ...current, isLoading: true })); const result = await generateQuery(textToSqlRepository, state.question); setState((current) => ({ ...current, isLoading: false, result })); };
  return { state, setQuestion, runQuery };
}
