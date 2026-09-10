import { initialResult, type QueryResult } from "../core/domain/textToSql";
import type { TextToSqlRepository } from "../core/usecases/generateQuery";
export class MockTextToSqlRepository implements TextToSqlRepository {
  async generate(question: string): Promise<QueryResult> {
    await new Promise((resolve) => setTimeout(resolve, 650));
    return { ...initialResult, title: question ? question.replace(/^./, (letter) => letter.toUpperCase()) : initialResult.title };
  }
}
// Replace this adapter with fetch('/api/text-to-sql') when the backend endpoint is ready.
export const textToSqlRepository = new MockTextToSqlRepository();
