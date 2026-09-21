import type { DataSourceInput } from "@/src/data/dataSourceApi";

export const suggestions = [
  "Show me the top 10 customers by revenue",
  "Which products are running low on stock?",
  "Compare monthly sales for this year",
];

export const emptyDataSourceForm: DataSourceInput = {
  name: "",
  dbType: "MYSQL",
  host: "localhost",
  port: 3306,
  databaseName: "",
  username: "",
  password: "",
};

export type ResultTab = "table" | "sql";
