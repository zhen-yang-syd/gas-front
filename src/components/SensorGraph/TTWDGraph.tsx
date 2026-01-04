"use client";

import { useMemo, useState } from "react";

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

// 固定传感器列表（与后端 config.py 一致）
// 分成两列显示
const T_SENSORS_COL1 = [
  "T010101", "T010102", "T010103", "T010104", "T010105", "T010106",
  "T010201", "T010202", "T010203", "T010204", "T010205",
];

const T_SENSORS_COL2 = [
  "T010301", "T010302", "T010303", "T010304", "T010305", "T010306", "T010307", "T010308",
];

const ALL_T_SENSORS = [...T_SENSORS_COL1, ...T_SENSORS_COL2];

const WD_SENSORS = [
  "WD010101", "WD010102", "WD010103", "WD010104", "WD010105", "WD010106",
  "WD010107", "WD010108", "WD010109", "WD010110", "WD010111",
  "WD010201", "WD010301", "WD010302", "WD010401", "WD010501",
];

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

function shortenName(id: string): string {
  return id
    .replace("T0101", "T1.")
    .replace("T0102", "T2.")
    .replace("T0103", "T3.")
    .replace("WD0101", "W1.")
    .replace("WD0102", "W2.")
    .replace("WD0103", "W3.")
    .replace("WD0104", "W4.")
    .replace("WD0105", "W5.");
}

/**
 * T-T-WD 关联图组件 (三列布局)
 * 第1列: T传感器 (区域01-02)
 * 第2列: T传感器 (区域03) - T-T弧线在两列之间
 * 第3列: WD传感器 - T-WD连线
 */
export function TTWDGraph({
  tTCorrelations = [],
  tWdCorrelations,
  width = 280,
  height = 320,
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
    T1: 45,           // 第一列 T
    T2: width / 2,    // 第二列 T
    WD: width - 40,   // 第三列 WD
  };

  // 统一计算节点位置，确保所有列填充相同的垂直范围
  const calculateNodes = (sensors: string[], x: number) => {
    const topPadding = 22;  // 标题下方开始
    const bottomPadding = 8; // 底部留小边距
    const availableHeight = height - topPadding - bottomPadding;
    const step = sensors.length > 1 ? availableHeight / (sensors.length - 1) : 0;
    return sensors.map((id, i) => ({
      id,
      x,
      y: topPadding + (sensors.length > 1 ? i * step : availableHeight / 2),
    }));
  };

  const t1Nodes = calculateNodes(T_SENSORS_COL1, colX.T1);
  const t2Nodes = calculateNodes(T_SENSORS_COL2, colX.T2);
  const wdNodes = calculateNodes(WD_SENSORS, colX.WD);

  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    [...t1Nodes, ...t2Nodes, ...wdNodes].forEach((n) => map.set(n.id, { x: n.x, y: n.y }));
    return map;
  }, [t1Nodes, t2Nodes, wdNodes]);

  // T-WD 连线 (只显示有数据的)
  const tWdLinks = useMemo(() => {
    const links: LinkData[] = [];
    ALL_T_SENSORS.forEach((t) => {
      WD_SENSORS.forEach((wd) => {
        const pos1 = nodePositions.get(t);
        const pos2 = nodePositions.get(wd);
        if (!pos1 || !pos2) return;

        const key = `${t}-${wd}`;
        const corr = tWdMap.get(key);
        if (!corr) return; // 只显示有数据的

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

  // T-T 弧线连线 (在两列T之间)
  const tTLinks = useMemo(() => {
    const links: LinkData[] = [];

    // 第一列内部的 T-T
    for (let i = 0; i < T_SENSORS_COL1.length; i++) {
      for (let j = i + 1; j < T_SENSORS_COL1.length; j++) {
        const t1 = T_SENSORS_COL1[i];
        const t2 = T_SENSORS_COL1[j];
        const pos1 = nodePositions.get(t1);
        const pos2 = nodePositions.get(t2);
        if (!pos1 || !pos2) continue;

        const key = `${t1}-${t2}`;
        const corr = tTMap.get(key);
        if (!corr) continue;

        const style = getLinkStyle(corr.r_value, true);
        const midY = (pos1.y + pos2.y) / 2;
        const curvature = Math.min(20, Math.abs(pos2.y - pos1.y) * 0.2);

        links.push({
          id: key,
          type: "T-T",
          x1: pos1.x, y1: pos1.y,
          x2: pos2.x, y2: pos2.y,
          cx: pos1.x - curvature,
          cy: midY,
          r: corr.r_value,
          strength: corr.strength,
          hasData: true,
          ...style,
        });
      }
    }

    // 第二列内部的 T-T
    for (let i = 0; i < T_SENSORS_COL2.length; i++) {
      for (let j = i + 1; j < T_SENSORS_COL2.length; j++) {
        const t1 = T_SENSORS_COL2[i];
        const t2 = T_SENSORS_COL2[j];
        const pos1 = nodePositions.get(t1);
        const pos2 = nodePositions.get(t2);
        if (!pos1 || !pos2) continue;

        const key = `${t1}-${t2}`;
        const corr = tTMap.get(key);
        if (!corr) continue;

        const style = getLinkStyle(corr.r_value, true);
        const midY = (pos1.y + pos2.y) / 2;
        const curvature = Math.min(20, Math.abs(pos2.y - pos1.y) * 0.2);

        links.push({
          id: key,
          type: "T-T",
          x1: pos1.x, y1: pos1.y,
          x2: pos2.x, y2: pos2.y,
          cx: pos1.x - curvature,
          cy: midY,
          r: corr.r_value,
          strength: corr.strength,
          hasData: true,
          ...style,
        });
      }
    }

    // 跨列的 T-T (第一列到第二列)
    T_SENSORS_COL1.forEach((t1) => {
      T_SENSORS_COL2.forEach((t2) => {
        const pos1 = nodePositions.get(t1);
        const pos2 = nodePositions.get(t2);
        if (!pos1 || !pos2) return;

        const key = `${t1}-${t2}`;
        const corr = tTMap.get(key);
        if (!corr) return;

        const style = getLinkStyle(corr.r_value, true);

        links.push({
          id: key,
          type: "T-T",
          isLine: true, // 跨列使用直线
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
          <text x={colX.T1} y="12" fontSize="8" fill="#9ca3af" textAnchor="middle" fontFamily="var(--font-mono)">T1-T2</text>
          <text x={colX.T2} y="12" fontSize="8" fill="#9ca3af" textAnchor="middle" fontFamily="var(--font-mono)">T3</text>
          <text x={colX.WD} y="12" fontSize="8" fill="#9ca3af" textAnchor="middle" fontFamily="var(--font-mono)">WD</text>

          {/* T-T 弧线/直线 */}
          <g className="t-t-links">
            {tTLinks.map((link) => (
              <g key={link.id}>
                {link.isLine ? (
                  // 跨列直线
                  <line
                    x1={link.x1} y1={link.y1}
                    x2={link.x2} y2={link.y2}
                    stroke={LINK_COLORS["T-T"]}
                    strokeWidth={hoveredLink === link.id ? link.width + 1 : link.width}
                    strokeOpacity={hoveredLink === link.id ? 1 : link.opacity}
                    style={{ cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={() => setHoveredLink(link.id)}
                    onMouseLeave={() => setHoveredLink(null)}
                  />
                ) : (
                  // 列内弧线
                  <path
                    d={`M ${link.x1} ${link.y1} Q ${link.cx} ${link.cy} ${link.x2} ${link.y2}`}
                    fill="none"
                    stroke={LINK_COLORS["T-T"]}
                    strokeWidth={hoveredLink === link.id ? link.width + 1 : link.width}
                    strokeOpacity={hoveredLink === link.id ? 1 : link.opacity}
                    style={{ cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={() => setHoveredLink(link.id)}
                    onMouseLeave={() => setHoveredLink(null)}
                  />
                )}
                {link.animated && (
                  link.isLine ? (
                    <line
                      x1={link.x1} y1={link.y1}
                      x2={link.x2} y2={link.y2}
                      stroke={LINK_COLORS["T-T"]}
                      strokeWidth={link.width}
                      strokeOpacity={0.4}
                      strokeDasharray="3,6"
                      className="animate-dash"
                    />
                  ) : (
                    <path
                      d={`M ${link.x1} ${link.y1} Q ${link.cx} ${link.cy} ${link.x2} ${link.y2}`}
                      fill="none"
                      stroke={LINK_COLORS["T-T"]}
                      strokeWidth={link.width}
                      strokeOpacity={0.4}
                      strokeDasharray="3,6"
                      className="animate-dash"
                    />
                  )
                )}
              </g>
            ))}
          </g>

          {/* T-WD 连线 */}
          <g className="t-wd-links">
            {tWdLinks.map((link) => (
              <g key={link.id}>
                <line
                  x1={link.x1} y1={link.y1}
                  x2={link.x2} y2={link.y2}
                  stroke={LINK_COLORS["T-WD"]}
                  strokeWidth={hoveredLink === link.id ? link.width + 1 : link.width}
                  strokeOpacity={hoveredLink === link.id ? 1 : link.opacity}
                  style={{ cursor: "pointer", transition: "all 0.2s" }}
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
                  />
                )}
              </g>
            ))}
          </g>

          {/* T1 节点 (第一列) */}
          {t1Nodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x} cy={node.y} r={3.5}
                fill={NODE_COLORS.T}
                stroke="#111827"
                strokeWidth={1}
                filter="drop-shadow(0 0 2px rgba(6, 182, 212, 0.5))"
              />
              <text
                x={node.x - 6} y={node.y + 3}
                fontSize="7" fill="#cbd5e1"
                textAnchor="end" fontFamily="var(--font-mono)"
              >
                {shortenName(node.id)}
              </text>
            </g>
          ))}

          {/* T2 节点 (第二列) */}
          {t2Nodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x} cy={node.y} r={3.5}
                fill={NODE_COLORS.T}
                stroke="#111827"
                strokeWidth={1}
                filter="drop-shadow(0 0 2px rgba(6, 182, 212, 0.5))"
              />
              <text
                x={node.x} y={node.y + 10}
                fontSize="7" fill="#cbd5e1"
                textAnchor="middle" fontFamily="var(--font-mono)"
              >
                {shortenName(node.id)}
              </text>
            </g>
          ))}

          {/* WD 节点 (第三列) */}
          {wdNodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x} cy={node.y} r={3.5}
                fill={NODE_COLORS.WD}
                stroke="#111827"
                strokeWidth={1}
                filter="drop-shadow(0 0 2px rgba(59, 130, 246, 0.5))"
              />
              <text
                x={node.x + 6} y={node.y + 3}
                fontSize="7" fill="#cbd5e1"
                textAnchor="start" fontFamily="var(--font-mono)"
              >
                {shortenName(node.id)}
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

      {/* Hover 信息 */}
      {hoveredInfo && (
        <div className="mt-2 px-2 py-1.5 bg-elevated rounded text-xs font-mono">
          <span className="text-soft">{hoveredInfo.id.replace("-", " → ")}</span>
          <span className="ml-2 text-bright">r = {hoveredInfo.r.toFixed(4)}</span>
          <span className="ml-2" style={{ color: LINK_COLORS[hoveredInfo.type as keyof typeof LINK_COLORS] }}>
            [{hoveredInfo.type}]
          </span>
        </div>
      )}
    </div>
  );
}

export default TTWDGraph;
