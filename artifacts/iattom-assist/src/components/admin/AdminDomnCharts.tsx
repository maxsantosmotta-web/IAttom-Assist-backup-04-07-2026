import { useId, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./admin-domn-charts.css";

export type DomnLinePoint = { label: string; value: number; secondaryValue?: number | null };
export type DomnBarPoint = { label: string; value: number; color?: string };

const COLORS = ["#f4c95d", "#3fd7ff", "#ff5cc8", "#64e6a6", "#9b82ff", "#ff9f5a", "#ff657f"];
const numberFmt = (value: number) => Number(value || 0).toLocaleString("pt-BR");

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function ActivityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-muted-foreground mb-1 font-medium">{label}</p>}
      <p className="font-semibold text-cyan-300">Movimentos: {numberFmt(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

export function DomnLineChart({ data, title, subtitle }: { data: DomnLinePoint[]; title: string; subtitle: string }) {
  const id = useId().replaceAll(":", "");
  const width = 760;
  const height = 250;
  const padding = { top: 24, right: 24, bottom: 42, left: 42 };
  const normalized = useMemo(() => data.map((item) => ({ ...item, value: Math.max(0, Number(item.value || 0)) })), [data]);
  const maxValue = Math.max(1, ...normalized.map((item) => item.value));
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const divisor = Math.max(1, normalized.length - 1);
  const points = normalized.map((item, index) => ({
    ...item,
    x: padding.left + (index / divisor) * innerWidth,
    y: padding.top + innerHeight - (item.value / maxValue) * innerHeight,
  }));
  const path = smoothPath(points);
  const floor = padding.top + innerHeight;
  const areaPath = points.length ? `${path} L ${points[points.length - 1].x} ${floor} L ${points[0].x} ${floor} Z` : "";
  const latest = points[points.length - 1];

  return (
    <section className="domn-chart-card domn-line-card">
      <header><div><span>{subtitle}</span><strong>{title}</strong></div></header>
      {points.length ? (
        <div className="domn-line-stage">
          <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <defs>
              <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3fd7ff" stopOpacity="0.16"/><stop offset="62%" stopColor="#3fd7ff" stopOpacity="0.05"/><stop offset="100%" stopColor="#3fd7ff" stopOpacity="0"/></linearGradient>
              <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#91f3ff"/><stop offset="65%" stopColor="#3fd7ff"/><stop offset="100%" stopColor="#64e6a6"/></linearGradient>
            </defs>
            {[0, .25, .5, .75, 1].map((step) => { const y = padding.top + innerHeight - step * innerHeight; return <line key={step} x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="domn-grid"/>; })}
            {areaPath && <path d={areaPath} fill={`url(#${id}-area)`} className="domn-area"/>}
            {path && <path d={path} className="domn-halo"/>}
            {path && <path d={path} stroke={`url(#${id}-line)`} className="domn-trace"/>}
            {path && <path d={path} pathLength="1" className="domn-energy"/>}
            {path && <g className="domn-moving-point" aria-hidden="true"><circle r="10" className="domn-moving-point-halo"><animateMotion dur="8s" repeatCount="indefinite" path={path} calcMode="linear"/></circle><circle r="3.8" className="domn-moving-point-core"><animateMotion dur="8s" repeatCount="indefinite" path={path} calcMode="linear"/></circle></g>}
            {latest && <g className="domn-beat"><circle cx={latest.x} cy={latest.y} r="8" fill="rgba(100,230,166,.16)"/><circle cx={latest.x} cy={latest.y} r="3.5" fill="#64e6a6"/></g>}
            {[0, Math.floor((points.length - 1) / 2), points.length - 1].filter((i, p, a) => i >= 0 && a.indexOf(i) === p).map((i) => <text key={i} x={points[i].x} y={height - 13} textAnchor="middle" className="domn-axis">{points[i].label}</text>)}
          </svg>
          <div className="domn-recharts-overlay">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={normalized} margin={padding}>
                <XAxis dataKey="label" hide /><YAxis domain={[0, maxValue]} hide />
                <Tooltip content={<ActivityTooltip />} cursor={{ stroke: "rgba(255,255,255,.28)", strokeDasharray: "4 4" }} />
                <Line type="monotone" dataKey="value" name="Movimentos" stroke="transparent" strokeWidth={1} dot={false} activeDot={{ r: 7, fill: "#ffffff", stroke: "#3fd7ff", strokeWidth: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : <div className="domn-empty">Sem dados suficientes</div>}
    </section>
  );
}

export function DomnDonutChart({ data, title, subtitle, centerLabel = "Total", fixedColorStructure = false }: { data: DomnBarPoint[]; title: string; subtitle: string; centerLabel?: string; fixedColorStructure?: boolean }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const normalized = useMemo(() => data.map((item, index) => ({ ...item, value: Math.max(0, Number(item.value || 0)), color: item.color || COLORS[index % COLORS.length] })), [data]);
  const total = normalized.reduce((sum, item) => sum + item.value, 0);
  const visualValues = fixedColorStructure ? normalized.map(() => 1) : total > 0 ? normalized.map((item) => item.value) : normalized.map(() => 1);
  const visualTotal = visualValues.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  const segments = normalized.map((item, index) => {
    const start = visualTotal > 0 ? (cursor / visualTotal) * 360 : 0;
    cursor += visualValues[index];
    const end = visualTotal > 0 ? (cursor / visualTotal) * 360 : 0;
    return `${item.color} ${start}deg ${end}deg`;
  });
  const active = activeIndex === null ? null : normalized[activeIndex];
  const gradient = normalized.length ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#252525 0deg 360deg)";

  return (
    <section className="domn-chart-card domn-donut-card">
      <header><div><span>{subtitle}</span><strong>{title}</strong></div></header>
      {normalized.length ? (
        <div className="domn-donut-layout">
          <div className="domn-premium-donut" style={{ ["--donut-fill" as string]: gradient }}>
            <div><small>{active?.label || centerLabel}</small><strong>{numberFmt(active?.value ?? total)}</strong></div>
          </div>
          <div className="domn-donut-legend">
            {normalized.map((item, index) => (
              <button type="button" className={activeIndex === index ? "active" : ""} onPointerDown={() => setActiveIndex(index)} onPointerEnter={() => setActiveIndex(index)} onPointerLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)} key={item.label}>
                <i style={{ background: item.color }} /><span>{item.label}</span><strong>{numberFmt(item.value)}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : <div className="domn-empty">Sem distribuição disponível</div>}
    </section>
  );
}
