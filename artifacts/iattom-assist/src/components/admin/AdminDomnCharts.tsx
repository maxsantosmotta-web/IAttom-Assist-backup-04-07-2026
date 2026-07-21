import { useId, useMemo, useState } from "react";
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

export function DomnLineChart({ data, title, subtitle }: { data: DomnLinePoint[]; title: string; subtitle: string }) {
  const id = useId().replaceAll(":", "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [touching, setTouching] = useState(false);
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
  const active = activeIndex === null ? null : points[Math.min(activeIndex, Math.max(0, points.length - 1))];
  const latest = points[points.length - 1];

  function select(event: React.PointerEvent<SVGSVGElement>) {
    if (!points.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    setActiveIndex(Math.round(ratio * (points.length - 1)));
  }

  return (
    <section className="domn-chart-card domn-line-card">
      <header><div><span>{subtitle}</span><strong>{title}</strong></div><div className="domn-current"><small>{active?.label || latest?.label || "Agora"}</small><strong>{numberFmt(active?.value ?? latest?.value ?? 0)}</strong></div></header>
      {points.length ? (
        <div className="domn-line-stage">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); setTouching(true); select(event); }}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") select(event); }}
            onPointerMove={(event) => { if (touching || event.pointerType === "mouse") select(event); }}
            onPointerUp={(event) => { event.currentTarget.releasePointerCapture?.(event.pointerId); setTouching(false); if (event.pointerType !== "mouse") setActiveIndex(null); }}
            onPointerCancel={() => { setTouching(false); setActiveIndex(null); }}
            onPointerLeave={() => { if (!touching) setActiveIndex(null); }}
          >
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
            {active && <g className="domn-active"><line x1={active.x} y1={padding.top} x2={active.x} y2={floor}/><circle cx={active.x} cy={active.y} r="7"/></g>}
            {[0, Math.floor((points.length - 1) / 2), points.length - 1].filter((i, p, a) => i >= 0 && a.indexOf(i) === p).map((i) => <text key={i} x={points[i].x} y={height - 13} textAnchor="middle" className="domn-axis">{points[i].label}</text>)}
          </svg>
          {active && <div className="domn-tooltip" style={{ left: `${(active.x / width) * 100}%` }}><span>{active.label}</span><strong>Movimentos: {numberFmt(active.value)}</strong></div>}
        </div>
      ) : <div className="domn-empty">Sem dados suficientes</div>}
    </section>
  );
}

export function DomnDonutChart({ data, title, subtitle, centerLabel = "Total" }: { data: DomnBarPoint[]; title: string; subtitle: string; centerLabel?: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const normalized = useMemo(() => data.map((item, index) => ({ ...item, value: Math.max(0, Number(item.value || 0)), color: item.color || COLORS[index % COLORS.length] })), [data]);
  const total = normalized.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const segments = normalized.map((item) => {
    const start = total > 0 ? (cursor / total) * 360 : 0;
    cursor += item.value;
    const end = total > 0 ? (cursor / total) * 360 : 0;
    return `${item.color} ${start}deg ${end}deg`;
  });
  const active = activeIndex === null ? null : normalized[activeIndex];
  const gradient = total > 0 ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#252525 0deg 360deg)";

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
