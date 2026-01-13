"use client";

import { useMemo, useState } from "react";
import { getSensorLabel, T_SENSORS, WD_SENSORS, formatSensorPairLabel } from "@/lib/sensors";

interface CorrelationItem {
  sensor1: string;
  sensor2: string;
  r_value: number;
  strength: string;
}

interface TTWDGraphProps {
  tTCorrelations?: CorrelationItem[];
  tWdCorrelations: CorrelationItem[];
  width?: number;
  height?: number;
}

// 三列布局：列1=T全部，列2=T全部(副本)，列3=WD
// 使用从 sensors.ts 导入的传感器列表
const T_COL1 = T_SENSORS;  // 列1：用于 T-T 连线的起点
const T_COL2 = T_SENSORS;  // 列2：用于 T-T 连线的终点 + T-WD 连线的起点
const WD_COL = WD_SENSORS; // 列3：WD传感器

// Link 数据类型
interface LinkData {
  id: string;
  type: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r: number;
  strength: string;
  hasData: boolean;
  width: number;
  opacity: number;
  dash: string;
  animated: boolean;
  isLine?: boolean;
  cx?: number;
  cy?: number;
}

// 工业科技风配色
const NODE_COLORS = {
  T: "#06b6d4",   // 青色 - T传感器
  WD: "#3b82f6",  // 蓝色 - WD传感器
};

const LINK_COLORS = {
  "T-T": "#06b6d4",   // 青色
  "T-WD": "#3b82f6",  // 蓝色
};

// 显示连线的最小相关系数阈值（只显示显著相关的连接）
const MIN_CORRELATION_THRESHOLD = 0.3;

function getLinkStyle(r: number, hasData: boolean) {
  if (!hasData) {
    return { width: 0.5, opacity: 0.1, dash: "2,4", animated: false };
  }
  const absR = Math.abs(r);
  if (absR >= 0.7) {
    // 强相关：粗实线 + 动画
    return { width: 2, opacity: 1, dash: "none", animated: true };
  }
  if (absR >= 0.3) {
    // 中等相关：中等实线
    return { width: 1.2, opacity: 0.7, dash: "none", animated: false };
  }
  // 弱相关：细虚线（但仍可见）
  return { width: 0.8, opacity: 0.35, dash: "3,3", animated: false };
}


/**
 * T-T-WD 关联图组件 (三列布局)
 *
 * 新布局规则：
 * - 列1: 全部T传感器
 * - 列2: 全部T传感器（副本）
 * - 列3: WD传感器
 *
 * 连线规则：
 * - T-T: 仅列1 → 列2（跨列连线）
 * - T-WD: 仅列2 → 列3
 * - 同列内不连线，列1和列3不直接连线
 */
export function TTWDGraph({
  tTCorrelations = [],
  tWdCorrelations,
  width = 280,
  height = 420,
}: TTWDGraphProps) {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  // 构建相关性查找表
  const { tTMap, tWdMap } = useMemo(() => {
    const tT = new Map<string, CorrelationItem>();
    const tWd = new Map<string, CorrelationItem>();

    tTCorrelations.forEach((c) => {
      tT.set(`${c.sensor1}-${c.sensor2}`, c);
      tT.set(`${c.sensor2}-${c.sensor1}`, c);
    });

    tWdCorrelations.forEach((c) => {
      tWd.set(`${c.sensor1}-${c.sensor2}`, c);
      tWd.set(`${c.sensor2}-${c.sensor1}`, c);
    });

    return { tTMap: tT, tWdMap: tWd };
  }, [tTCorrelations, tWdCorrelations]);

  // 三列位置
  const colX = {
    T1: 45,           // 第一列 T（T-T起点）
    T2: width / 2,    // 第二列 T（T-T终点 + T-WD起点）
    WD: width - 40,   // 第三列 WD
  };

  // 统一计算节点位置
  const calculateNodes = (sensors: string[], x: number, colKey: string) => {
    const topPadding = 22;
    const bottomPadding = 8;
    const availableHeight = height - topPadding - bottomPadding;
    const step = sensors.length > 1 ? availableHeight / (sensors.length - 1) : 0;
    return sensors.map((id, i) => ({
      id,
      colKey,  // 标记属于哪一列
      x,
      y: topPadding + (sensors.length > 1 ? i * step : availableHeight / 2),
    }));
  };

  // 列1：全部T（T-T连线起点）
  const t1Nodes = calculateNodes(T_COL1, colX.T1, "T1");
  // 列2：全部T副本（T-T连线终点 + T-WD连线起点）
  const t2Nodes = calculateNodes(T_COL2, colX.T2, "T2");
  // 列3：WD
  const wdNodes = calculateNodes(WD_COL, colX.WD, "WD");

  // 分别存储两列T的位置（用不同key区分）
  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    t1Nodes.forEach((n) => map.set(`T1:${n.id}`, { x: n.x, y: n.y }));
    t2Nodes.forEach((n) => map.set(`T2:${n.id}`, { x: n.x, y: n.y }));
    wdNodes.forEach((n) => map.set(`WD:${n.id}`, { x: n.x, y: n.y }));
    return map;
  }, [t1Nodes, t2Nodes, wdNodes]);

  // T-WD 连线：仅从列2的T连接到列3的WD（只显示显著相关 |r| >= 0.3）
  const tWdLinks = useMemo(() => {
    const links: LinkData[] = [];
    T_COL2.forEach((t) => {
      WD_COL.forEach((wd) => {
        const pos1 = nodePositions.get(`T2:${t}`);  // 列2的T
        const pos2 = nodePositions.get(`WD:${wd}`);
        if (!pos1 || !pos2) return;

        const key = `${t}-${wd}`;
        const corr = tWdMap.get(key);
        if (!corr || Math.abs(corr.r_value) < MIN_CORRELATION_THRESHOLD) return;

        const style = getLinkStyle(corr.r_value, true);

        links.push({
          id: key,
          type: "T-WD",
          x1: pos1.x, y1: pos1.y,
          x2: pos2.x, y2: pos2.y,
          r: corr.r_value,
          strength: corr.strength,
          hasData: true,
          ...style,
        });
      });
    });
    return links;
  }, [nodePositions, tWdMap]);

  // T-T 连线：仅从列1的T连接到列2的T（只显示显著相关 |r| >= 0.3）
  const tTLinks = useMemo(() => {
    const links: LinkData[] = [];

    // 遍历所有 T-T 相关性对，在列1和列2之间绘制
    T_COL1.forEach((t1) => {
      T_COL2.forEach((t2) => {
        // 跳过同一个传感器（列1的T1和列2的T1不连）
        if (t1 === t2) return;

        const pos1 = nodePositions.get(`T1:${t1}`);  // 列1
        const pos2 = nodePositions.get(`T2:${t2}`);  // 列2
        if (!pos1 || !pos2) return;

        const key = `${t1}-${t2}`;
        const corr = tTMap.get(key);
        if (!corr || Math.abs(corr.r_value) < MIN_CORRELATION_THRESHOLD) return;

        const style = getLinkStyle(corr.r_value, true);

        links.push({
          id: key,
          type: "T-T",
          isLine: true,
          x1: pos1.x, y1: pos1.y,
          x2: pos2.x, y2: pos2.y,
          r: corr.r_value,
          strength: corr.strength,
          hasData: true,
          ...style,
        });
      });
    });

    return links;
  }, [nodePositions, tTMap]);

  const stats = useMemo(() => ({
    tT: tTLinks.length,
    tWd: tWdLinks.length,
  }), [tTLinks, tWdLinks]);

  const hoveredInfo = useMemo(() => {
    if (!hoveredLink) return null;
    return [...tTLinks, ...tWdLinks].find((l) => l.id === hoveredLink);
  }, [hoveredLink, tTLinks, tWdLinks]);

  return (
    <div className="tt-wd-graph h-full flex flex-col">
      {/* 标题 */}
      <div className="flex items-center justify-between text-xs mb-2 px-1">
        <span className="font-mono text-accent uppercase tracking-wider">T-T-WD</span>
        <div className="flex gap-3 text-dim">
          <span style={{ color: LINK_COLORS["T-T"] }}>T-T: {stats.tT}</span>
          <span style={{ color: LINK_COLORS["T-WD"] }}>T-WD: {stats.tWd}</span>
        </div>
      </div>

      {/* 图表 - 响应式填充容器 */}
      <div className="overflow-hidden rounded border border-edge bg-surface flex-1" style={{ minHeight: height }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block"
        >
          <rect x="0" y="0" width={width} height={height} fill="var(--bg-surface)" />

          {/* 网格线 */}
          <defs>
            <pattern id="grid-ttwd" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border-edge)" strokeWidth="0.5" strokeOpacity="0.3" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#grid-ttwd)" />

          {/* 列标题 */}
          <text x={colX.T1} y="12" fontSize="8" fill="#9ca3af" textAnchor="middle" fontFamily="var(--font-mono)">T</text>
          <text x={colX.T2} y="12" fontSize="8" fill="#9ca3af" textAnchor="middle" fontFamily="var(--font-mono)">T</text>
          <text x={colX.WD} y="12" fontSize="8" fill="#9ca3af" textAnchor="middle" fontFamily="var(--font-mono)">WD</text>

          {/* T-T 直线（列1到列2） */}
          <g className="t-t-links">
            {tTLinks.map((link) => (
              <g key={link.id}>
                {/* 可见线条 */}
                <line
                  x1={link.x1} y1={link.y1}
                  x2={link.x2} y2={link.y2}
                  stroke={LINK_COLORS["T-T"]}
                  strokeWidth={hoveredLink === link.id ? link.width + 1 : link.width}
                  strokeOpacity={hoveredLink === link.id ? 1 : link.opacity}
                  style={{ transition: "stroke-width 0.2s, stroke-opacity 0.2s", pointerEvents: "none" }}
                />
                {/* 透明点击区域（固定宽度，不抖动） */}
                <line
                  x1={link.x1} y1={link.y1}
                  x2={link.x2} y2={link.y2}
                  stroke="transparent"
                  strokeWidth={8}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredLink(link.id)}
                  onMouseLeave={() => setHoveredLink(null)}
                />
                {link.animated && (
                  <line
                    x1={link.x1} y1={link.y1}
                    x2={link.x2} y2={link.y2}
                    stroke={LINK_COLORS["T-T"]}
                    strokeWidth={link.width}
                    strokeOpacity={0.4}
                    strokeDasharray="3,6"
                    className="animate-dash"
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </g>
            ))}
          </g>

          {/* T-WD 连线 */}
          <g className="t-wd-links">
            {tWdLinks.map((link) => (
              <g key={link.id}>
                {/* 可见线条 */}
                <line
                  x1={link.x1} y1={link.y1}
                  x2={link.x2} y2={link.y2}
                  stroke={LINK_COLORS["T-WD"]}
                  strokeWidth={hoveredLink === link.id ? link.width + 1 : link.width}
                  strokeOpacity={hoveredLink === link.id ? 1 : link.opacity}
                  style={{ transition: "stroke-width 0.2s, stroke-opacity 0.2s", pointerEvents: "none" }}
                />
                {/* 透明点击区域（固定宽度，不抖动） */}
                <line
                  x1={link.x1} y1={link.y1}
                  x2={link.x2} y2={link.y2}
                  stroke="transparent"
                  strokeWidth={8}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredLink(link.id)}
                  onMouseLeave={() => setHoveredLink(null)}
                />
                {link.animated && (
                  <line
                    x1={link.x1} y1={link.y1}
                    x2={link.x2} y2={link.y2}
                    stroke={LINK_COLORS["T-WD"]}
                    strokeWidth={link.width}
                    strokeOpacity={0.4}
                    strokeDasharray="3,6"
                    className="animate-dash"
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </g>
            ))}
          </g>

          {/* T1 节点 (第一列) - 带标签 */}
          {t1Nodes.map((node) => (
            <g key={`t1-${node.id}`}>
              <circle
                cx={node.x} cy={node.y} r={3}
                fill={NODE_COLORS.T}
                stroke="#111827"
                strokeWidth={1}
                filter="drop-shadow(0 0 2px rgba(6, 182, 212, 0.5))"
              />
              <text
                x={node.x - 5} y={node.y + 3}
                fontSize="6" fill="#cbd5e1"
                textAnchor="end" fontFamily="var(--font-mono)"
              >
                {getSensorLabel(node.id)}
              </text>
            </g>
          ))}

          {/* T2 节点 (第二列) - 无标签，仅节点 */}
          {t2Nodes.map((node) => (
            <g key={`t2-${node.id}`}>
              <circle
                cx={node.x} cy={node.y} r={3}
                fill={NODE_COLORS.T}
                stroke="#111827"
                strokeWidth={1}
                filter="drop-shadow(0 0 2px rgba(6, 182, 212, 0.5))"
              />
            </g>
          ))}

          {/* WD 节点 (第三列) - 带标签 */}
          {wdNodes.map((node) => (
            <g key={`wd-${node.id}`}>
              <circle
                cx={node.x} cy={node.y} r={3}
                fill={NODE_COLORS.WD}
                stroke="#111827"
                strokeWidth={1}
                filter="drop-shadow(0 0 2px rgba(59, 130, 246, 0.5))"
              />
              <text
                x={node.x + 5} y={node.y + 3}
                fontSize="6" fill="#cbd5e1"
                textAnchor="start" fontFamily="var(--font-mono)"
              >
                {getSensorLabel(node.id)}
              </text>
            </g>
          ))}

          <style>
            {`
              .animate-dash { animation: dashFlow 1s linear infinite; }
              @keyframes dashFlow { to { stroke-dashoffset: -9; } }
            `}
          </style>
        </svg>
      </div>

      {/* Hover 信息 - 始终占位，避免布局抖动 */}
      <div
        className="mt-2 px-2 py-1.5 bg-elevated rounded text-xs font-mono"
        style={{ visibility: hoveredInfo ? "visible" : "hidden" }}
      >
        <span className="text-soft">
          {hoveredInfo ? formatSensorPairLabel(hoveredInfo.id.split("-")[0], hoveredInfo.id.split("-")[1]) : "—"}
        </span>
        <span className="ml-2 text-bright">r = {hoveredInfo?.r.toFixed(4) || "0.0000"}</span>
        <span className="ml-2" style={{ color: hoveredInfo ? LINK_COLORS[hoveredInfo.type as keyof typeof LINK_COLORS] : "#666" }}>
          [{hoveredInfo?.type || "T-T"}]
        </span>
      </div>
    </div>
  );
}

export default TTWDGraph;
