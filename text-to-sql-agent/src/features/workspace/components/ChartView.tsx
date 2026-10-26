"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QueryResult } from "@/src/core/domain/textToSql";

const PALETTE = ["#F5A623", "#D98E12", "#F7C45A", "#B8740A", "#FFD98A", "#8A5A06"];

function toNumber(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ChartView({ result }: { result: QueryResult }) {
  const rows = result.rows ?? [];
  const chart = result.chart;
  if (!chart || !rows.length) {
    return <div className="chart-empty">Không có dữ liệu để vẽ biểu đồ.</div>;
  }

  const columns = Object.keys(rows[0] ?? {});
  const x = chart.x && columns.includes(chart.x) ? chart.x : columns[0];
  const y =
    chart.y && columns.includes(chart.y)
      ? chart.y
      : columns.find((column) => column !== x && rows.some((row) => toNumber(row[column]) !== 0)) ??
        columns[1] ??
        columns[0];

  if (chart.type === "number") {
    const value = toNumber(rows[0]?.[y]);
    return (
      <div className="kpi-card">
        <span className="kpi-label">{chart.title ?? y}</span>
        <strong className="kpi-value">{value.toLocaleString()}</strong>
        <small className="kpi-meta">{result.rowCount ?? rows.length} dòng kết quả</small>
      </div>
    );
  }

  const data = rows.slice(0, 50).map((row) => ({ ...row, [y]: toNumber(row[y]) }));

  if (chart.type === "pie") {
    return (
      <div className="chart-view">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} dataKey={y} nameKey={x} cx="50%" cy="50%" outerRadius={110} label>
              {data.map((_, index) => (
                <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === "line") {
    return (
      <div className="chart-view">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#efe6d2" />
            <XAxis dataKey={x} tick={{ fontSize: 11, fill: "#8a7d63" }} />
            <YAxis tick={{ fontSize: 11, fill: "#8a7d63" }} />
            <Tooltip />
            <Line type="monotone" dataKey={y} stroke="#D98E12" strokeWidth={2.4} dot={{ r: 3, fill: "#F5A623" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default: bar chart (also the fallback for unknown types).
  return (
    <div className="chart-view">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efe6d2" vertical={false} />
          <XAxis dataKey={x} tick={{ fontSize: 11, fill: "#8a7d63" }} />
          <YAxis tick={{ fontSize: 11, fill: "#8a7d63" }} />
          <Tooltip cursor={{ fill: "#FFF7E6" }} />
          <Bar dataKey={y} radius={[6, 6, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
