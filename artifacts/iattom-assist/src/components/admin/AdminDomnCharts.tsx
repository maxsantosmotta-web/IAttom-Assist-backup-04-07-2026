import { useId, useMemo, useState } from "react";
import "./admin-domn-charts.css";

export type DomnLinePoint = { label: string; value: number; secondaryValue?: number | null };
export type DomnBarPoint = { label: string; value: number; color?: string };

const COLORS = ["#d7b65d", "#4e9fd1", "#7fc5a5", "#8f7bc4", "#c78376", "#7086b8", "#b69a67"];
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

function buildVisualValues(values: number[]) {
  const maximum = Math.max(0, ...values);
  if (maximum <= 0) return values.map(() => 0);

  return values.map((value) => {
    if (value <= 0) return 0;
    const normalized = value / maximum;
    const emphasized = Math.pow(normalized, 0.62);
    const minimumVisiblePeak = maximum * 0.28;
    return Math.max(minimumVisiblePeak, emphasized * maximum);
  });
}

export function DomnLineChart({ data, title, subtitle }: { data: DomnLinePoint[]; title: string; subtitle: string }) {
  const id = useId().replaceAll(":", "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [touching, setTouching] = useState(false);
  const width = 760;
  const height = 250;
  const padding = { top: 24, right: 24, bottom: 42, left: 42 };
  const normalized = useMemo(() => data.map((item) => ({ ...item, value: Number(item.value || 0) })), [data]);
  const maxValue = Math.max(1, ...normalized.map((item) => item.value));
  const visualValues = useMemo(() => buildVisualValues(normalized.map((item) => item.value)), [normalized]);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const divisor = Math.max(1, normalized.length - 1);
  const points = normalized.map((item, index) => ({
    ...item,
    visualValue: visualValues[index] ?? 0,
    x: padding.left + (index / divisor) * innerWidth,
    y: padding.top + innerHeight - ((visualValues[index] ?? 0) / maxValue) * innerHeight,
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
    <section className="domn-chart-card domn-line-card iattom-flow-chart">
      <header><div><span>{subtitle}</span><strong>{title}</strong></div><div className="domn-current"><small>{active?.label || latest?.label || "Agora"}</small><strong>{numberFmt(active?.value ?? latest?.value ?? 0)}</strong></div></header>
      {points.length ? (
        <div className="domn-line-stage">
          <svg viewBox={`0 0 ${width} ${height}`} onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setTouching(true); select(e); }} onPointerMove={(e) => touching && select(e)} onPointerUp={(e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); setTouching(false); setActiveIndex(null); }} onPointerCancel={() => { setTouching(false); setActiveIndex(null); }} onPointerLeave={() => !touching && setActiveIndex(null)}>
            <defs>
              <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f6c93f" stopOpacity="0.46"/><stop offset="48%" stopColor="#d7a92f" stopOpacity="0.20"/><stop offset="100%" stopColor="#0d0f13" stopOpacity="0"/></linearGradient>
              <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ffc928"/><stop offset="48%" stopColor="#ffd84d"/><stop offset="100%" stopColor="#ffbf18"/></linearGradient>
            </defs>
            {[0, .25, .5, .75, 1].map((step) => { const y = padding.top + innerHeight - step * innerHeight; return <line key={step} x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="domn-grid"/>; })}
            {areaPath && <path d={areaPath} fill={`url(#${id}-area)`} className="iattom-flow-area"/>}
            {path && <path d={path} className="iattom-flow-halo"/>}
            {path && <path d={path} stroke={`url(#${id}-line)`} className="iattom-flow-trace"/>}
            {path && <path d={path} pathLength="1" className="iattom-flow-energy"/>}
            {latest && <g className="iattom-flow-beat"><circle cx={latest.x} cy={latest.y} r="11"/><circle cx={latest.x} cy={latest.y} r="4.5"/></g>}
            {active && <g className="domn-active"><line x1={active.x} y1={padding.top} x2={active.x} y2={floor}/><circle cx={active.x} cy={active.y} r="6"/></g>}
            {[0, Math.floor((points.length - 1) / 2), points.length - 1].filter((i, p, a) => i >= 0 && a.indexOf(i) === p).map((i) => <text key={i} x={points[i].x} y={height - 13} textAnchor="middle" className="domn-axis">{points[i].label}</text>)}
          </svg>
          {active && <div className="domn-tooltip" style={{ left: `${(active.x / width) * 100}%` }}><span>{active.label}</span><strong>{numberFmt(active.value)}</strong></div>}
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
  const segments: string[] = [];
  normalized.forEach((item) => {
    const start = total > 0 ? (cursor / total) * 360 : 0;
    cursor += item.value;
    const end = total > 0 ? (cursor / total) * 360 : 0;
    const span = Math.max(0, end - start);
    const gap = Math.min(1.8, span / 5);
    segments.push(`#151820 ${start}deg ${start + gap}deg`, `${item.color} ${start + gap}deg ${Math.max(start + gap, end - gap)}deg`, `#151820 ${Math.max(start + gap, end - gap)}deg ${end}deg`);
  });
  const active = activeIndex === null ? null : normalized[activeIndex];
  const gradient = total > 0 ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#252525 0deg 360deg)";
  const variant = title.includes("Módulo") ? "module-ring" : "action-ring";

  return (
    <section className={`domn-chart-card domn-donut-card iattom-segmented-ring ${variant}`}>
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
