export type QueryRow = Record<string, string>;
export type QueryResult = { title: string; sql: string; rows: QueryRow[] };
export type TextToSqlState = { question: string; isLoading: boolean; result: QueryResult };

export const initialResult: QueryResult = {
  title: "Top customers by revenue",
  sql: "SELECT customer_name, SUM(total) AS total_revenue, COUNT(*) AS orders\nFROM orders\nGROUP BY customer_name\nORDER BY total_revenue DESC\nLIMIT 10;",
  rows: [
    { rank: "1", customer_name: "Acme Corporation", total_revenue: "$48,290.00", orders: "142" },
    { rank: "2", customer_name: "Northstar Labs", total_revenue: "$36,840.50", orders: "98" },
    { rank: "3", customer_name: "Brightside Co.", total_revenue: "$29,115.00", orders: "76" },
    { rank: "4", customer_name: "Morrow & Sons", total_revenue: "$21,904.25", orders: "64" },
  ],
};
