import type { QueryResult } from "../domain/textToSql";
export interface TextToSqlRepository { generate(question: string): Promise<QueryResult>; }
export async function generateQuery(repository: TextToSqlRepository, question: string) { return repository.generate(question); }
