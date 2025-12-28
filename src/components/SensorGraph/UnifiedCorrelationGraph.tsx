"use client";

import { useMemo, useState } from "react";

interface CorrelationItem {
  sensor1: string;
  sensor2: string;
  r_value: number;
  strength: string;
}

interface UnifiedCorrelationGraphProps {
  tTCorrelations?: CorrelationItem[];  // T-T 相关性（新增）
  tWdCorrelations: CorrelationItem[];
  tFsCorrelations: CorrelationItem[];
  width?: number;
  height?: number;
}

// ===== 固定传感器列表（与后端 config.py 完全一致）=====
const T_SENSORS = [
  "T010101", "T010102", "T010103", "T010104", "T010105", "T010106",
  "T010201", "T010202", "T010203", "T010204", "T010205",
  "T010301", "T010302", "T010303", "T010304", "T010305", "T010306", "T010307", "T010308",
];

const WD_SENSORS = [
  "WD010101", "WD010102", "WD010103", "WD010104", "WD010105", "WD010106",
  "WD010107", "WD010108", "WD010109", "WD010110", "WD010111",
  "WD010201", "WD010301", "WD010302", "WD010401", "WD010501",
];

const FS_SENSORS = [
  "FS010103", "FS010104", "FS010105",
  "FS010201", "FS010202",
  "FS010301", "FS010302",
];

// 节点颜色
const NODE_COLORS: Record<string, string> = {
  T: "#3B82F6",   // 蓝色 - Gas传感器
  WD: "#10B981",  // 绿色 - 温度传感器
  FS: "#F59E0B",  // 橙色 - 风速传感器
};

// 连线颜色
const LINK_COLORS = {
  "T-T": "#06B6D4",   // 青色 - Gas-Gas 相关性
  "T-WD": "#4169E1",  // 皇家蓝
  "T-FS": "#F59E0B",  // 橙色
};

// 根据r值获取连线样式
function getLinkStyle(r: number, hasData: boolean) {
  if (!hasData) {
    // 无数据 - 断开状态
    return { width: 0.5, opacity: 0.1, dash: "2,4", animated: false };
  }

  const absR = Math.abs(r);
  if (absR >= 0.7) {
    return { width: 3, opacity: 1, dash: "none", animated: true };
  }
  if (absR >= 0.3) {
    return { width: 2, opacity: 0.7, dash: "none", animated: false };
  }
  return { width: 1, opacity: 0.3, dash: "4,2", animated: false };
}

// 缩短传感器名称
function shortenName(id: string): string {
  return id
    .replace("T0101", "T1.")
    .replace("T0102", "T2.")
    .replace("T0103", "T3.")
    .replace("WD0101", "W1.")
    .replace("WD0102", "W2.")
    .replace("WD0103", "W3.")
    .replace("WD0104", "W4.")
    .replace("WD0105", "W5.")
    .replace("FS0101", "F1.")
    .replace("FS0102", "F2.")
    .replace("FS0103", "F3.");
}

/**
 * 统一关联图组件
 *
 * 将 T-WD 和 T-FS 关联关系在一个图中展示
 * 布局: T传感器(左) -- WD传感器(中) -- FS传感器(右)
 */
export function UnifiedCorrelationGraph({
  tTCorrelations = [],
  tWdCorrelations,
  tFsCorrelations,
  width = 400,
  height = 500,
}: UnifiedCorrelationGraphProps) {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  // 构建相关性查找表
  const { tTMap, tWdMap, tFsMap } = useMemo(() => {
    const tT = new Map<string, CorrelationItem>();
    const tWd = new Map<string, CorrelationItem>();
    const tFs = new Map<string, CorrelationItem>();

    tTCorrelations.forEach((c) => {
      tT.set(`${c.sensor1}-${c.sensor2}`, c);
      tT.set(`${c.sensor2}-${c.sensor1}`, c);
    });

    tWdCorrelations.forEach((c) => {
      tWd.set(`${c.sensor1}-${c.sensor2}`, c);
      tWd.set(`${c.sensor2}-${c.sensor1}`, c);
    });

    tFsCorrelations.forEach((c) => {
      tFs.set(`${c.sensor1}-${c.sensor2}`, c);
      tFs.set(`${c.sensor2}-${c.sensor1}`, c);
    });

    return { tTMap: tT, tWdMap: tWd, tFsMap: tFs };
  }, [tTCorrelations, tWdCorrelations, tFsCorrelations]);

  // 计算三列的 X 坐标
  const colX = {
    T: 50,
    WD: width / 2,
    FS: width - 50,
  };

  // 计算节点位置
  const calculateNodes = (sensors: string[], x: number, type: string) => {
    const padding = 30;
    const availableHeight = height - padding * 2;
    const step = sensors.length > 1 ? availableHeight / (sensors.length - 1) : 0;

    return sensors.map((id, i) => ({
      id,
      x,
      y: padding + (sensors.length > 1 ? i * step : availableHeight / 2),
      type,
    }));
  };

  const tNodes = useMemo(() => calculateNodes(T_SENSORS, colX.T, "T"), [colX.T, height]);
  const wdNodes = useMemo(() => calculateNodes(WD_SENSORS, colX.WD, "WD"), [colX.WD, height]);
  const fsNodes = useMemo(() => calculateNodes(FS_SENSORS, colX.FS, "FS"), [colX.FS, height]);

  // 创建位置映射
  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    [...tNodes, ...wdNodes, ...fsNodes].forEach((n) => {
      map.set(n.id, { x: n.x, y: n.y });
    });
    return map;
  }, [tNodes, wdNodes, fsNodes]);

  // 生成 T-WD 连线
  const tWdLinks = useMemo(() => {
    const links: any[] = [];

    T_SENSORS.forEach((t) => {
      WD_SENSORS.forEach((wd) => {
        const pos1 = nodePositions.get(t);
        const pos2 = nodePositions.get(wd);
        if (!pos1 || !pos2) return;

        const key = `${t}-${wd}`;
        const corr = tWdMap.get(key);
        const hasData = !!corr;
        const style = getLinkStyle(corr?.r_value || 0, hasData);

        links.push({
          id: key,
          type: "T-WD",
          x1: pos1.x,
          y1: pos1.y,
          x2: pos2.x,
          y2: pos2.y,
          r: corr?.r_value || 0,
          strength: corr?.strength || "none",
          hasData,
          ...style,
        });
      });
    });

    // 排序：有数据的在上面
    return links.sort((a, b) => (b.hasData ? 1 : 0) - (a.hasData ? 1 : 0));
  }, [nodePositions, tWdMap]);

  // 生成 T-FS 连线
  const tFsLinks = useMemo(() => {
    const links: any[] = [];

    T_SENSORS.forEach((t) => {
      FS_SENSORS.forEach((fs) => {
        const pos1 = nodePositions.get(t);
        const pos2 = nodePositions.get(fs);
        if (!pos1 || !pos2) return;

        const key = `${t}-${fs}`;
        const corr = tFsMap.get(key);
        const hasData = !!corr;
        const style = getLinkStyle(corr?.r_value || 0, hasData);

        links.push({
          id: key,
          type: "T-FS",
          x1: pos1.x,
          y1: pos1.y,
          x2: pos2.x,
          y2: pos2.y,
          r: corr?.r_value || 0,
          strength: corr?.strength || "none",
          hasData,
          ...style,
        });
      });
    });

    return links.sort((a, b) => (b.hasData ? 1 : 0) - (a.hasData ? 1 : 0));
  }, [nodePositions, tFsMap]);

  // 生成 T-T 连线（弧线，因为在同一列）
  const tTLinks = useMemo(() => {
    const links: any[] = [];

    // 只显示有数据的 T-T 连线（避免过于密集）
    for (let i = 0; i < T_SENSORS.length; i++) {
      for (let j = i + 1; j < T_SENSORS.length; j++) {
        const t1 = T_SENSORS[i];
        const t2 = T_SENSORS[j];
        const pos1 = nodePositions.get(t1);
        const pos2 = nodePositions.get(t2);
        if (!pos1 || !pos2) continue;

        const key = `${t1}-${t2}`;
        const corr = tTMap.get(key);
        const hasData = !!corr;

        // 只保留有数据的连线
        if (!hasData) continue;

        const style = getLinkStyle(corr?.r_value || 0, hasData);

        // 计算弧线控制点（向左弯曲）
        const midY = (pos1.y + pos2.y) / 2;
        const curvature = Math.min(30, Math.abs(pos2.y - pos1.y) * 0.3);

        links.push({
          id: key,
          type: "T-T",
          x1: pos1.x,
          y1: pos1.y,
          x2: pos2.x,
          y2: pos2.y,
          cx: pos1.x - curvature,  // 控制点 X（向左弯曲）
          cy: midY,                 // 控制点 Y
          r: corr?.r_value || 0,
          strength: corr?.strength || "none",
          hasData,
          ...style,
        });
      }
    }

    return links;
  }, [nodePositions, tTMap]);

  // 统计
  const stats = useMemo(() => ({
    tTActive: tTLinks.length,  // T-T 只统计有数据的
    tWdActive: tWdLinks.filter((l) => l.hasData).length,
    tWdTotal: tWdLinks.length,
    tFsActive: tFsLinks.filter((l) => l.hasData).length,
    tFsTotal: tFsLinks.length,
  }), [tTLinks, tWdLinks, tFsLinks]);

  // 获取当前hover的连线信息
  const hoveredInfo = useMemo(() => {
    if (!hoveredLink) return null;
    const link = [...tTLinks, ...tWdLinks, ...tFsLinks].find((l) => l.id === hoveredLink);
    return link;
  }, [hoveredLink, tTLinks, tWdLinks, tFsLinks]);

  return (
    <div className="unified-correlation-graph">
      {/* 标题和统计 */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
        <span className="font-medium">传感器关联图</span>
        <div className="flex gap-2">
          <span style={{ color: LINK_COLORS["T-T"] }}>
            T-T: {stats.tTActive}
          </span>
          <span style={{ color: LINK_COLORS["T-WD"] }}>
            T-WD: {stats.tWdActive}
          </span>
          <span style={{ color: LINK_COLORS["T-FS"] }}>
            T-FS: {stats.tFsActive}
          </span>
        </div>
      </div>

      {/* 图表容器 */}
      <div
        className="overflow-auto rounded border border-slate-700"
        style={{ maxHeight: 450 }}
      >
        <svg
          width={width}
          height={height}
          className="bg-slate-900"
        >
          {/* 背景 */}
          <rect x="0" y="0" width={width} height={height} fill="#1E293B" />

          {/* 列标题 */}
          <text x={colX.T} y="15" fontSize="10" fill="#94A3B8" textAnchor="middle">
            Gas (T)
          </text>
          <text x={colX.WD} y="15" fontSize="10" fill="#94A3B8" textAnchor="middle">
            Temp (WD)
          </text>
          <text x={colX.FS} y="15" fontSize="10" fill="#94A3B8" textAnchor="middle">
            Wind (FS)
          </text>

          {/* T-T 连线（弧线，只显示有数据的） */}
          <g className="t-t-links">
            {tTLinks.map((link) => (
              <g key={link.id}>
                <path
                  d={`M ${link.x1} ${link.y1} Q ${link.cx} ${link.cy} ${link.x2} ${link.y2}`}
                  fill="none"
                  stroke={LINK_COLORS["T-T"]}
                  strokeWidth={hoveredLink === link.id ? link.width + 1 : link.width}
                  strokeOpacity={hoveredLink === link.id ? 1 : link.opacity}
                  style={{
                    transition: "stroke-width 0.3s, stroke-opacity 0.3s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredLink(link.id)}
                  onMouseLeave={() => setHoveredLink(null)}
                />
                {/* 动画效果 - 强相关连线 */}
                {link.animated && (
                  <path
                    d={`M ${link.x1} ${link.y1} Q ${link.cx} ${link.cy} ${link.x2} ${link.y2}`}
                    fill="none"
                    stroke={LINK_COLORS["T-T"]}
                    strokeWidth={link.width}
                    strokeOpacity={0.3}
                    strokeDasharray="4,8"
                    style={{
                      animation: "dash-flow 1s linear infinite",
                    }}
                  />
                )}
              </g>
            ))}
          </g>

          {/* T-WD 连线 - 先画无数据的 */}
          <g className="t-wd-links">
            {tWdLinks.filter((l) => !l.hasData).map((link) => (
              <line
                key={link.id}
                x1={link.x1}
                y1={link.y1}
                x2={link.x2}
                y2={link.y2}
                stroke={LINK_COLORS["T-WD"]}
                strokeWidth={link.width}
                strokeOpacity={link.opacity}
                strokeDasharray={link.dash}
              />
            ))}
          </g>

          {/* T-FS 连线 - 先画无数据的 */}
          <g className="t-fs-links">
            {tFsLinks.filter((l) => !l.hasData).map((link) => (
              <line
                key={link.id}
                x1={link.x1}
                y1={link.y1}
                x2={link.x2}
                y2={link.y2}
                stroke={LINK_COLORS["T-FS"]}
                strokeWidth={link.width}
                strokeOpacity={link.opacity}
                strokeDasharray={link.dash}
              />
            ))}
          </g>

          {/* T-WD 有数据的连线 */}
          <g className="t-wd-active-links">
            {tWdLinks.filter((l) => l.hasData).map((link) => (
              <g key={link.id}>
                <line
                  x1={link.x1}
                  y1={link.y1}
                  x2={link.x2}
                  y2={link.y2}
                  stroke={LINK_COLORS["T-WD"]}
                  strokeWidth={hoveredLink === link.id ? link.width + 1 : link.width}
                  strokeOpacity={hoveredLink === link.id ? 1 : link.opacity}
                  strokeDasharray={link.dash}
                  style={{
                    transition: "stroke-width 0.3s, stroke-opacity 0.3s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredLink(link.id)}
                  onMouseLeave={() => setHoveredLink(null)}
                />
                {/* 动画效果 - 强相关连线 */}
                {link.animated && (
                  <line
                    x1={link.x1}
                    y1={link.y1}
                    x2={link.x2}
                    y2={link.y2}
                    stroke={LINK_COLORS["T-WD"]}
                    strokeWidth={link.width}
                    strokeOpacity={0.3}
                    strokeDasharray="4,8"
                    style={{
                      animation: "dash-flow 1s linear infinite",
                    }}
                  />
                )}
              </g>
            ))}
          </g>

          {/* T-FS 有数据的连线 */}
          <g className="t-fs-active-links">
            {tFsLinks.filter((l) => l.hasData).map((link) => (
              <g key={link.id}>
                <line
                  x1={link.x1}
                  y1={link.y1}
                  x2={link.x2}
                  y2={link.y2}
                  stroke={LINK_COLORS["T-FS"]}
                  strokeWidth={hoveredLink === link.id ? link.width + 1 : link.width}
                  strokeOpacity={hoveredLink === link.id ? 1 : link.opacity}
                  strokeDasharray={link.dash}
                  style={{
                    transition: "stroke-width 0.3s, stroke-opacity 0.3s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredLink(link.id)}
                  onMouseLeave={() => setHoveredLink(null)}
                />
                {link.animated && (
                  <line
                    x1={link.x1}
                    y1={link.y1}
                    x2={link.x2}
                    y2={link.y2}
                    stroke={LINK_COLORS["T-FS"]}
                    strokeWidth={link.width}
                    strokeOpacity={0.3}
                    strokeDasharray="4,8"
                    style={{
                      animation: "dash-flow 1s linear infinite",
                    }}
                  />
                )}
              </g>
            ))}
          </g>

          {/* T 节点 */}
          <g className="t-nodes">
            {tNodes.map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={5}
                  fill={NODE_COLORS.T}
                  stroke="#fff"
                  strokeWidth={1}
                />
                <text
                  x={node.x - 8}
                  y={node.y + 3}
                  fontSize="7"
                  fill="#94A3B8"
                  textAnchor="end"
                >
                  {shortenName(node.id)}
                </text>
              </g>
            ))}
          </g>

          {/* WD 节点 */}
          <g className="wd-nodes">
            {wdNodes.map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={5}
                  fill={NODE_COLORS.WD}
                  stroke="#fff"
                  strokeWidth={1}
                />
                <text
                  x={node.x}
                  y={node.y - 8}
                  fontSize="6"
                  fill="#94A3B8"
                  textAnchor="middle"
                >
                  {shortenName(node.id)}
                </text>
              </g>
            ))}
          </g>

          {/* FS 节点 */}
          <g className="fs-nodes">
            {fsNodes.map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={5}
                  fill={NODE_COLORS.FS}
                  stroke="#fff"
                  strokeWidth={1}
                />
                <text
                  x={node.x + 8}
                  y={node.y + 3}
                  fontSize="7"
                  fill="#94A3B8"
                  textAnchor="start"
                >
                  {shortenName(node.id)}
                </text>
              </g>
            ))}
          </g>

          {/* 动画样式 */}
          <defs>
            <style>
              {`
                @keyframes dash-flow {
                  to {
                    stroke-dashoffset: -12;
                  }
                }
              `}
            </style>
          </defs>
        </svg>
      </div>

      {/* Hover 信息 */}
      {hoveredInfo && (
        <div className="mt-2 px-2 py-1 bg-slate-800 rounded text-xs">
          <span className="text-slate-300">{hoveredInfo.id.replace("-", " → ")}</span>
          <span className="ml-2">
            r = <span className="text-white font-mono">{hoveredInfo.r.toFixed(4)}</span>
          </span>
          <span
            className="ml-2"
            style={{ color: LINK_COLORS[hoveredInfo.type as keyof typeof LINK_COLORS] }}
          >
            {hoveredInfo.type}
          </span>
        </div>
      )}

      {/* 图例 */}
      <div className="flex justify-center gap-4 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-current" style={{ opacity: 1 }} />
          强 (r≥0.7)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-current" style={{ opacity: 0.5 }} />
          中 (0.3-0.7)
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-4 h-0.5 bg-current"
            style={{ opacity: 0.2, background: "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 4px)" }}
          />
          无数据
        </span>
      </div>
    </div>
  );
}

export default UnifiedCorrelationGraph;
