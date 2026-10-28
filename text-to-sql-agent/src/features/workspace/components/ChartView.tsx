"use client";

import { useMemo, useState } from "react";
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
import { Icon } from "@/src/presentation/components/Icon";
import type { QueryResult } from "@/src/core/domain/textToSql";
import { buildChartModel, pieData, type ChartModel, type PlotType } from "../chartData";

// Distinct hues so multiple series stay readable; amber first to match the theme.
const SERIES_COLORS = ["#E09A1A", "#3B7EA1", "#5FA36A", "#C0603F", "#8C6BB1", "#7A6A4F", "#D4B44A"];
const AXIS_TICK = { fontSize: 11, fill: "#8a7d63" };
const TYPE_LABELS: Record<PlotType, string> = { bar: "Cột", line: "Đường", pie: "Tròn" };

const fullFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });
const formatFull = (value: unknown) => fullFormat.format(Number(value ?? 0));
const formatCompact = (value: unknown) => compactFormat.format(Number(value ?? 0));
const truncate = (value: unknown, max = 14) => {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

type PlotModel = Extract<ChartModel, { kind: "plot" }>;

export function ChartCard({ result }: { result: QueryResult }) {
  const model = useMemo(() => buildChartModel(result.rows ?? [], result.chart, result.sql), [result]);
  const [chosenType, setChosenType] = useState<PlotType | null>(null);
  if (model.kind === "empty") return null;

  const type = model.kind === "plot" && chosenType && model.allowedTypes.includes(chosenType) ? chosenType : model.kind === "plot" ? model.defaultType : null;

  return (
    <div className="result-card chart-card">
      <div className="result-header">
        <div>
          <span className="eyebrow">BIỂU ĐỒ</span>
          <h2>{result.chart?.title ?? result.title}</h2>
          {model.kind === "plot" && <p className="chart-caption">{model.caption}</p>}
        </div>
        {model.kind === "plot" && model.allowedTypes.length > 1 && (
          <div className="chart-switch" role="group" aria-label="Loại biểu đồ">
            {model.allowedTypes.map((option) => (
              <button key={option} className={option === type ? "active" : ""} onClick={() => setChosenType(option)}>
                {TYPE_LABELS[option]}
              </button>
            ))}
          </div>
        )}
      </div>
      {model.kind === "kpi" ? <KpiGrid items={model.items} rowCount={result.rowCount ?? result.rows.length} /> : <PlotView model={model} type={type ?? "bar"} />}
      {model.kind === "plot" && model.note && (
        <div className="chart-note">
          <Icon name="trend" size={12} /> {model.note}
        </div>
      )}
    </div>
  );
}

function KpiGrid({ items, rowCount }: { items: { label: string; value: number }[]; rowCount: number }) {
  return (
    <div className="kpi-grid">
      {items.map((item) => (
        <div key={item.label} className="kpi-card">
          <span className="kpi-label">{item.label}</span>
          <strong className="kpi-value">{formatFull(item.value)}</strong>
        </div>
      ))}
      <small className="kpi-meta">{rowCount} dòng kết quả</small>
    </div>
  );
}

function PlotView({ model, type }: { model: PlotModel; type: PlotType }) {
  const { x, series, data, dualAxis } = model;
  const multi = series.length > 1;

  if (type === "pie") {
    const slices = pieData(model);
    return (
      <div className="chart-view">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie data={slices} dataKey={series[0]} nameKey={x} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={1}
              label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}>
              {slices.map((_, index) => <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => formatFull(value)} />
            <Legend formatter={(value) => truncate(value, 24)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "line") {
    return (
      <div className="chart-view">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 12, right: 18, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#efe6d2" vertical={false} />
            <XAxis dataKey={x} tick={AXIS_TICK} tickFormatter={(value) => truncate(value)} minTickGap={16} />
            <YAxis yAxisId="left" tick={AXIS_TICK} tickFormatter={formatCompact} width={56} />
            {dualAxis && <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} tickFormatter={formatCompact} width={56} />}
            <Tooltip formatter={(value) => formatFull(value)} />
            {multi && <Legend />}
            {series.map((name, index) => (
              <Line key={name} yAxisId={dualAxis && index === 1 ? "right" : "left"} type="monotone" dataKey={name}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]} strokeWidth={2.4} dot={data.length <= 40 ? { r: 3 } : false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Long category labels read better as a horizontal bar chart.
  const horizontal = data.some((item) => String(item[x]).length > 12) && data.length <= 15;
  const height = horizontal ? Math.max(240, data.length * (multi ? 34 : 26) + 60) : 320;
  return (
    <div className="chart-view">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 12, right: 18, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efe6d2" horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={AXIS_TICK} tickFormatter={formatCompact} />
              <YAxis yAxisId="left" type="category" dataKey={x} tick={AXIS_TICK} tickFormatter={(value) => truncate(value, 22)} width={150} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} tick={AXIS_TICK} tickFormatter={(value) => truncate(value)} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={AXIS_TICK} tickFormatter={formatCompact} width={56} />
              {dualAxis && <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} tickFormatter={formatCompact} width={56} />}
            </>
          )}
          <Tooltip cursor={{ fill: "#FFF7E6" }} formatter={(value) => formatFull(value)} />
          {multi && <Legend />}
          {series.map((name, index) => (
            <Bar key={name} yAxisId={!horizontal && dualAxis && index === 1 ? "right" : "left"} dataKey={name}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]} radius={horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
