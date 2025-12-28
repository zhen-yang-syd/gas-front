"use client";

import { useMemo, useState } from "react";

interface CorrelationItem {
  sensor1: string;
  sensor2: string;
  r_value: number;
  strength: string;
}

interface FixedCorrelationGraphProps {
  correlations: CorrelationItem[];
  type: "T-WD" | "T-FS";
  width?: number;
  height?: number;
  title?: string;
}

// ===== 固定传感器列表（与后端 config.py 完全一致）=====
const T_SENSORS = [
  "T010101", "T010102", "T010103", "T010104", "T010105", "T010106",
  "T010201", "T010202", "T010203", "T010204", "T010205",
  "T010301", "T010302", "T010303", "T010304", "T010305", "T010306", "T010307", "T010308",
];  // 19个

const WD_SENSORS = [
  "WD010101", "WD010102", "WD010103", "WD010104", "WD010105", "WD010106",
  "WD010107", "WD010108", "WD010109", "WD010110", "WD010111",
  "WD010201", "WD010301", "WD010302", "WD010401", "WD010501",
];  // 16个

const FS_SENSORS = [
  "FS010103", "FS010104", "FS010105",
  "FS010201", "FS010202",
  "FS010301", "FS010302",
];  // 7个

// 根据传感器数量自动计算合适的高度
function calculateOptimalHeight(leftCount: number, rightCount: number): number {
  const maxCount = Math.max(leftCount, rightCount);
  const minNodeSpacing = 20;  // 最小节点间距
  const padding = 40;  // 上下padding
  return Math.max(200, maxCount * minNodeSpacing + padding);
}

// 节点颜色
const NODE_COLORS: Record<string, string> = {
  T: "#3B82F6",   // 蓝色 - Gas传感器
  WD: "#10B981",  // 绿色 - 温度传感器
  FS: "#F59E0B",  // 橙色 - 风速传感器
};

// 连线颜色
const LINK_COLORS: Record<string, string> = {
  "T-WD": "#4169E1",  // 皇家蓝
  "T-FS": "#2F4F4F",  // 藏青色
};

// 根据r值获取连线样式
function getLinkStyle(r: number) {
  const absR = Math.abs(r);
  if (absR >= 0.7) {
    return { width: 3, opacity: 1, dash: "none" };
  }
  if (absR >= 0.3) {
    return { width: 2, opacity: 0.7, dash: "none" };
  }
  return { width: 1, opacity: 0.3, dash: "4,2" };
}

// 获取强度标签
function getStrengthLabel(strength: string): string {
  const labels: Record<string, string> = {
    great: "极强",
    very_good: "很强",
    good: "较强",
    fair: "中等",
    poor: "较弱",
    very_poor: "很弱",
  };
  return labels[strength] || strength;
}

/**
 * 固定布局关联图组件
 *
 * 所有传感器节点固定显示，连线样式动态反映相关性强度
 */
export function FixedCorrelationGraph({
  correlations,
  type,
  width = 240,
  height: propHeight,
  title,
}: FixedCorrelationGraphProps) {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  // 使用固定的传感器列表（不再从数据中动态提取）
  const { leftSensors, rightSensors, correlationMap } = useMemo(() => {
    // 左侧始终是 T 传感器
    const leftList = T_SENSORS;
    // 右侧根据类型选择 WD 或 FS
    const rightList = type === "T-WD" ? WD_SENSORS : FS_SENSORS;

    // 构建相关性查找表（支持双向查找）
    const corrMap = new Map<string, CorrelationItem>();
    correlations.forEach((c) => {
      const key1 = `${c.sensor1}-${c.sensor2}`;
      const key2 = `${c.sensor2}-${c.sensor1}`;
      corrMap.set(key1, c);
      corrMap.set(key2, c);
    });

    return {
      leftSensors: leftList,
      rightSensors: rightList,
      correlationMap: corrMap,
    };
  }, [correlations, type]);

  // 自动计算高度以适应所有传感器
  const height = propHeight || calculateOptimalHeight(leftSensors.length, rightSensors.length);

  // 计算节点位置
  const leftNodes = useMemo(() => {
    const padding = 25;
    const availableHeight = height - padding * 2;
    const step = leftSensors.length > 1 ? availableHeight / (leftSensors.length - 1) : 0;

    return leftSensors.map((id, i) => ({
      id,
      x: 35,
      y: padding + (leftSensors.length > 1 ? i * step : availableHeight / 2),
      type: "T" as const,
    }));
  }, [leftSensors, height]);

  const rightNodes = useMemo(() => {
    const padding = 25;
    const availableHeight = height - padding * 2;
    const step = rightSensors.length > 1 ? availableHeight / (rightSensors.length - 1) : 0;

    return rightSensors.map((id, i) => ({
      id,
      x: width - 35,
      y: padding + (rightSensors.length > 1 ? i * step : availableHeight / 2),
      type: id.startsWith("WD") ? "WD" as const : "FS" as const,
    }));
  }, [rightSensors, width, height]);

  // 创建节点位置映射
  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    leftNodes.forEach((n) => map.set(n.id, { x: n.x, y: n.y }));
    rightNodes.forEach((n) => map.set(n.id, { x: n.x, y: n.y }));
    return map;
  }, [leftNodes, rightNodes]);

  // 生成连线数据 - 基于相关性数据动态显示
  const links = useMemo(() => {
    const result: {
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      r: number;
      strength: string;
      width: number;
      opacity: number;
      dash: string;
      hasData: boolean;
    }[] = [];

    // 只为有相关性数据的传感器对绘制连线
    correlations.forEach((c) => {
      const pos1 = nodePositions.get(c.sensor1);
      const pos2 = nodePositions.get(c.sensor2);

      if (pos1 && pos2) {
        const style = getLinkStyle(c.r_value);
        result.push({
          id: `${c.sensor1}-${c.sensor2}`,
          x1: pos1.x,
          y1: pos1.y,
          x2: pos2.x,
          y2: pos2.y,
          r: c.r_value,
          strength: c.strength,
          hasData: true,
          ...style,
        });
      }
    });

    return result;
  }, [correlations, nodePositions]);

  const linkColor = LINK_COLORS[type] || "#666";

  // 缩短传感器名称显示
  const shortenName = (id: string) => {
    return id
      .replace("T0101", "T1-")
      .replace("T0103", "T3-")
      .replace("T0", "T")
      .replace("WD0101", "W1-")
      .replace("WD0103", "W3-")
      .replace("WD0", "W")
      .replace("FS0101", "F1-")
      .replace("FS0103", "F3-")
      .replace("FS0", "F");
  };

  // 统计信息
  const linkCount = links.length;
  const activeLeftNodes = new Set(links.map((l) => l.id.split("-")[0])).size;
  const activeRightNodes = new Set(links.map((l) => l.id.split("-")[1])).size;

  return (
    <div className="fixed-correlation-graph relative">
      {title && (
        <div className="text-xs text-slate-400 mb-1 text-center">
          {title}
          <span className="ml-2 text-slate-500">
            {linkCount} 连接 | {activeLeftNodes}T × {activeRightNodes}{type === "T-WD" ? "W" : "F"}
          </span>
        </div>
      )}
      <div
        className="overflow-auto rounded border border-slate-700"
        style={{ maxHeight: 400 }}
      >
        <svg
          width={width}
          height={height}
          className="bg-slate-900"
        >
        {/* 背景 */}
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="#1E293B"
          rx="4"
        />

        {/* 连线 */}
        <g className="links">
          {links.map((link) => (
            <g key={link.id}>
              <line
                x1={link.x1}
                y1={link.y1}
                x2={link.x2}
                y2={link.y2}
                stroke={linkColor}
                strokeWidth={hoveredLink === link.id ? link.width + 1 : link.width}
                strokeOpacity={hoveredLink === link.id ? 1 : link.opacity}
                strokeDasharray={link.dash}
                style={{
                  transition: "stroke-opacity 0.5s ease-out, stroke-width 0.3s ease-out",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredLink(link.id)}
                onMouseLeave={() => setHoveredLink(null)}
              />
              {/* 增加可点击区域 */}
              <line
                x1={link.x1}
                y1={link.y1}
                x2={link.x2}
                y2={link.y2}
                stroke="transparent"
                strokeWidth={10}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredLink(link.id)}
                onMouseLeave={() => setHoveredLink(null)}
              />
            </g>
          ))}
        </g>

        {/* 左侧节点 (T传感器) */}
        <g className="left-nodes">
          {leftNodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={6}
                fill={NODE_COLORS[node.type]}
                stroke="#fff"
                strokeWidth={1}
              />
              <text
                x={node.x - 10}
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

        {/* 右侧节点 (WD/FS传感器) */}
        <g className="right-nodes">
          {rightNodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={6}
                fill={NODE_COLORS[node.type]}
                stroke="#fff"
                strokeWidth={1}
              />
              <text
                x={node.x + 10}
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
      </svg>
      </div>

      {/* Hover Tooltip */}
      {hoveredLink && (
        <div className="absolute z-50 pointer-events-none" style={{ top: 10, left: 10 }}>
          <div className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs shadow-lg">
            {(() => {
              const [s1, s2] = hoveredLink.split("-");
              const corr = correlationMap.get(hoveredLink);
              return corr ? (
                <>
                  <div className="font-bold text-slate-200">{shortenName(s1)} - {shortenName(s2)}</div>
                  <div className="text-slate-400">
                    r = <span className="text-white font-mono">{corr.r_value.toFixed(4)}</span>
                  </div>
                  <div className="text-slate-400">
                    强度: <span style={{ color: linkColor }}>{getStrengthLabel(corr.strength)}</span>
                  </div>
                </>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* 图例 */}
      <div className="flex justify-center gap-3 mt-1 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span
            className="w-4 h-0.5"
            style={{ backgroundColor: linkColor, opacity: 1 }}
          />
          r≥0.7
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-4 h-0.5"
            style={{ backgroundColor: linkColor, opacity: 0.7 }}
          />
          0.3-0.7
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-4 h-0.5"
            style={{
              backgroundColor: linkColor,
              opacity: 0.3,
              backgroundImage: `repeating-linear-gradient(90deg, ${linkColor} 0, ${linkColor} 4px, transparent 4px, transparent 6px)`,
            }}
          />
          &lt;0.3
        </span>
      </div>
    </div>
  );
}

export default FixedCorrelationGraph;
