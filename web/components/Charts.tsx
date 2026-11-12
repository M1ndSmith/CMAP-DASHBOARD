"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Bin, Prediction, Trial } from "@/lib/types";

const tick = { fill: "#869397", fontSize: 11, fontFamily: "JetBrains Mono, ui-monospace, monospace" };
const tip = {
  background: "rgba(15, 23, 42, 0.95)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 8,
  color: "#dfe2f1",
};
export const REGIME = ["#06B6D4", "#8B5CF6", "#10B981", "#F59E0B", "#F43F5E", "#7DD3FC"];

function corrColor(value: number): string {
  const amount = 0.18 + Math.abs(value) * 0.82;
  return value >= 0 ? `rgba(6, 182, 212, ${amount})` : `rgba(244, 63, 94, ${amount})`;
}

export function VarianceChart({ rows }: { rows: { column: string; std: number; dropped: boolean }[] }) {
  const data = rows
    .filter((row) => !row.dropped && row.std > 1e-6)
    .map((row) => ({ ...row, logStd: Math.log10(row.std) }));
  return (
    <div className="chart" style={{ height: Math.max(240, data.length * 28) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis type="number" tick={tick} stroke="rgba(255,255,255,0.18)" />
          <YAxis type="category" dataKey="column" tick={tick} width={42} stroke="rgba(255,255,255,0.18)" />
          <Tooltip
            contentStyle={tip}
            formatter={(value, _name, item) => {
              const std = (item?.payload as { std?: number } | undefined)?.std;
              return [std === undefined ? String(value) : std.toExponential(2), "std"];
            }}
          />
          <Bar dataKey="logStd" fill="#06B6D4" radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CorrelationHeatmap({ sensors, matrix }: { sensors: string[]; matrix: number[][] }) {
  return (
    <div className="heat-wrap">
      <div className="heat" style={{ gridTemplateColumns: `40px repeat(${sensors.length}, 36px)` }}>
        <b />
        {sensors.map((sensor) => (
          <b key={sensor}>{sensor}</b>
        ))}
        {sensors.map((sensor, row) => (
          <span key={sensor} style={{ display: "contents" }}>
            <b>{sensor}</b>
            {matrix[row].map((value, column) => (
              <i
                key={`${sensor}-${column}`}
                title={`${sensor} / ${sensors[column]} ${value.toFixed(2)}`}
                style={{ background: corrColor(value), color: Math.abs(value) > 0.55 ? "#0B0F19" : "#dfe2f1" }}
              >
                {value.toFixed(1)}
              </i>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RegimeScatter({
  points,
}: {
  points: { op1: number; op2: number; op3: number; regime: number }[];
}) {
  const regimes = [...new Set(points.map((point) => point.regime))].sort((a, b) => a - b);
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="op1" type="number" name="op1" tick={tick} stroke="rgba(255,255,255,0.18)" />
          <YAxis dataKey="op2" type="number" name="op2" tick={tick} stroke="rgba(255,255,255,0.18)" />
          <Tooltip contentStyle={tip} />
          {regimes.map((regime) => (
            <Scatter
              key={regime}
              name={`Regime ${regime}`}
              data={points.filter((point) => point.regime === regime)}
              fill={REGIME[regime % REGIME.length]}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CycleLengthChart({ title, bins }: { title: string; bins: Bin[] }) {
  const data = bins.map((bin) => ({ label: Math.round(bin.lo).toString(), count: bin.count }));
  return (
    <div>
      <p className="label-caps">{title}</p>
      <div className="chart short">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={tick} stroke="rgba(255,255,255,0.18)" />
            <YAxis tick={tick} stroke="rgba(255,255,255,0.18)" width={36} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="count" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SensorHistogram({ histograms }: { histograms: Record<string, Bin[]> }) {
  const names = Object.keys(histograms);
  const [name, setName] = useState(names[0] ?? "");
  const bins = histograms[name] ?? [];
  const data = bins.map((bin) => ({ label: bin.lo.toFixed(1), count: bin.count }));
  return (
    <div>
      <label className="field" style={{ maxWidth: 220, marginBottom: 8 }}>
        <span>Sensor</span>
        <select value={name} onChange={(event) => setName(event.target.value)}>
          {names.map((sensor) => (
            <option key={sensor} value={sensor}>
              {sensor}
            </option>
          ))}
        </select>
      </label>
      <div className="chart short">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={tick} stroke="rgba(255,255,255,0.18)" interval={3} />
            <YAxis tick={tick} stroke="rgba(255,255,255,0.18)" width={40} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="count" fill="#06B6D4" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function lineBlock(data: { cycle: number; value: number }[], color: string) {
  return (
    <div className="chart short">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="cycle" tick={tick} stroke="rgba(255,255,255,0.18)" minTickGap={24} />
          <YAxis tick={tick} stroke="rgba(255,255,255,0.18)" width={48} domain={["auto", "auto"]} />
          <Tooltip contentStyle={tip} />
          <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={1.4} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EngineCharts({
  cycle,
  ops,
  sensors,
  regime,
}: {
  cycle: number[];
  ops: Record<string, number[]>;
  sensors: Record<string, number[]>;
  regime: number[];
}) {
  const colors = ["#06B6D4", "#8B5CF6", "#10B981"];
  return (
    <>
      <article className="card">
        <header className="card-head">
          <p className="label-caps">Flight regime</p>
          <span className="stamp">{cycle.length} cycles</span>
        </header>
        <div className="regime-strip" title="Flight regime along the run">
          {regime.map((id, index) => (
            <span key={`${id}-${index}`} style={{ background: REGIME[id % REGIME.length] }} />
          ))}
        </div>
      </article>
      <div className="sensor-grid">
        {Object.entries(ops).map(([name, values], index) => (
          <article className="card" key={name}>
            <header className="card-head">
              <p className="label-caps">{name}</p>
            </header>
            {lineBlock(
              cycle.map((value, step) => ({ cycle: value, value: values[step] })),
              colors[index % colors.length],
            )}
          </article>
        ))}
      </div>
      <div className="sensor-grid">
        {Object.entries(sensors).map(([name, values]) => (
          <article className="card" key={name}>
            <header className="card-head">
              <p className="label-caps">{name}</p>
            </header>
            {lineBlock(
              cycle.map((value, index) => ({ cycle: value, value: values[index] })),
              "#06B6D4",
            )}
          </article>
        ))}
      </div>
    </>
  );
}

export function HealthChart({ cycle, health }: { cycle: number[]; health: number[] }) {
  const data = cycle.map((value, index) => ({ cycle: value, health: health[index] }));
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="cycle" tick={tick} stroke="rgba(255,255,255,0.18)" minTickGap={24} />
          <YAxis tick={tick} stroke="rgba(255,255,255,0.18)" width={40} />
          <Tooltip contentStyle={tip} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
          <ReferenceLine y={1} stroke="rgba(255,255,255,0.18)" />
          <Line type="monotone" dataKey="health" stroke="#10B981" dot={false} strokeWidth={1.6} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PredictScatter({ rows, selected }: { rows: Prediction[]; selected: number }) {
  const early = rows.filter((row) => row.error < 0);
  const late = rows.filter((row) => row.error >= 0);
  const focus = rows.filter((row) => row.unit === selected);
  const values = rows.flatMap((row) => [row.true_rul, row.pred]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const guide = [
    { true_rul: low, pred: low },
    { true_rul: high, pred: high },
  ];
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="true_rul" type="number" name="True" tick={tick} stroke="rgba(255,255,255,0.18)" />
          <YAxis dataKey="pred" type="number" name="Predicted" tick={tick} stroke="rgba(255,255,255,0.18)" />
          <Tooltip contentStyle={tip} />
          <Line data={guide} dataKey="pred" stroke="rgba(255,255,255,0.28)" dot={false} legendType="none" />
          <Scatter data={early} fill="#F59E0B" name="Early" />
          <Scatter data={late} fill="#F43F5E" name="Late" />
          <Scatter data={focus} fill="#06B6D4" name="Selected" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ErrorBars({ rows }: { rows: Prediction[] }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="unit" tick={tick} stroke="rgba(255,255,255,0.18)" interval={Math.ceil(rows.length / 8)} />
          <YAxis tick={tick} stroke="rgba(255,255,255,0.18)" width={40} />
          <Tooltip contentStyle={tip} />
          <Bar dataKey="error" radius={[2, 2, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.unit} fill={row.error >= 0 ? "#F43F5E" : "#F59E0B"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricBars({
  rows,
  metric,
}: {
  rows: { fleet: string; ridge: number; hgb: number }[];
  metric: string;
}) {
  return (
    <div className="chart short">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="fleet" tick={tick} stroke="rgba(255,255,255,0.18)" />
          <YAxis tick={tick} stroke="rgba(255,255,255,0.18)" width={48} />
          <Tooltip contentStyle={tip} />
          <Bar dataKey="ridge" fill="#06B6D4" name="Ridge" radius={[2, 2, 0, 0]} />
          <Bar dataKey="hgb" fill="#8B5CF6" name={metric} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrialBars({ trials }: { trials: Trial[] }) {
  const data = trials.map((trial, index) => ({
    name: `T${index + 1}`,
    rmse: trial.mean_cv_rmse,
    selected: trial.selected,
  }));
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis type="number" tick={tick} stroke="rgba(255,255,255,0.18)" />
          <YAxis type="category" dataKey="name" tick={tick} width={36} stroke="rgba(255,255,255,0.18)" />
          <Tooltip contentStyle={tip} />
          <Bar dataKey="rmse" radius={[0, 2, 2, 0]}>
            {data.map((trial) => (
              <Cell key={trial.name} fill={trial.selected ? "#10B981" : "#8B5CF6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
