"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { formatSensorPairLabel } from "@/lib/sensors";

interface BubbleWallChartProps {
  label: string;
  cav: number;
  ulv: number;
  llv: number;
  isPairDynamic: boolean;
  pairHistoryCount: number;
  changeMagnitude?: number; // 波动幅度
  hasData?: boolean;        // 是否有有效数据
  status: string;
  color: string;
  sensorType?: string;      // T-T, T-WD, T-FS
  typeColor?: string;       // 类型颜色
}

/**
 * 单个气泡墙图组件
 *
 * 视觉结构:
 * - 两条水平线表示"墙" (ULV上墙, LLV下墙)
 * - 气泡位置反映CAV值相对于墙的位置
 * - 气泡颜色表示状态 (蓝=正常, 黄=异常, 红=警告)
 */
export function BubbleWallChart({
  label,
  cav,
  ulv,
  llv,
  isPairDynamic,
  pairHistoryCount,
  hasData = true,
  status,
  color,
  sensorType = "T-T",
  typeColor = "#06B6D4",
}: BubbleWallChartProps) {
  // 判断是否为 disabled 状态（无数据或 cav=0）
  const isDisabled = hasData === false || cav === 0;

  // disabled 状态使用灰色
  const displayColor = isDisabled ? "#64748B" : color;

  // 计算气泡Y位置
  const bubbleY = useMemo(() => {
    const wallTop = 25;    // ULV线Y坐标
    const wallBottom = 75; // LLV线Y坐标
    const wallHeight = wallBottom - wallTop;

    // 安全检查：处理 NaN 或无效值
    const safeCav = typeof cav === 'number' && !isNaN(cav) ? cav : 0.5;
    const safeUlv = typeof ulv === 'number' && !isNaN(ulv) ? ulv : 0.95;
    const safeLlv = typeof llv === 'number' && !isNaN(llv) ? llv : 0.85;

    // 防止除零：ulv === llv 时返回中间位置
    if (safeUlv <= safeLlv) {
      return (wallTop + wallBottom) / 2;
    }

    // 正常范围内: 线性映射
    if (safeCav >= safeLlv && safeCav <= safeUlv) {
      const ratio = (safeUlv - safeCav) / (safeUlv - safeLlv);
      return wallTop + ratio * wallHeight;
    }

    // 超过上限: 气泡向上移动
    if (safeCav > safeUlv) {
      const excess = Math.min((safeCav - safeUlv) / 0.3, 1); // 最多移动到顶部
      return Math.max(8, wallTop - excess * 17);
    }

    // 低于下限: 气泡向下移动
    const deficit = Math.min((safeLlv - safeCav) / 0.3, 1);
    return Math.min(92, wallBottom + deficit * 17);
  }, [cav, ulv, llv]);

  // 计算气泡半径 (基于CAV值，disabled状态使用固定小半径)
  const radius = useMemo(() => {
    if (isDisabled) return 10; // disabled 状态固定半径
    const minR = 8;
    const maxR = 16;
    const normalized = Math.min(Math.max(cav, 0), 1);
    return minR + normalized * (maxR - minR);
  }, [cav, isDisabled]);

  // 判断是否需要脉冲动画 (异常或警告状态，disabled不动画)
  const shouldPulse = !isDisabled && (status.includes("ABNORMAL") || status.includes("WARNING"));

  // 将传感器对标签转换为简称
  const shortLabel = useMemo(() => {
    const parts = label.split("-");
    if (parts.length === 2) {
      return formatSensorPairLabel(parts[0], parts[1]);
    }
    return label;
  }, [label]);

  // Hover 状态
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{
    x: number;
    y: number;
    below: boolean;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // 客户端挂载检测（Portal 需要）
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 计算 CAV 相对于阈值的位置描述
  const cavPosition = useMemo(() => {
    if (cav > ulv) return `超出上限 ${((cav - ulv) * 100).toFixed(1)}%`;
    if (cav < llv) return `低于下限 ${((llv - cav) * 100).toFixed(1)}%`;
    const range = ulv - llv;
    const posInRange = ((cav - llv) / range) * 100;
    return `正常范围内 ${posInRange.toFixed(0)}%`;
  }, [cav, ulv, llv]);

  // 检测卡片位置，计算 tooltip 绝对位置
  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const below = rect.top < 180; // 如果卡片靠近顶部，tooltip 显示在下方
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: below ? rect.bottom + 8 : rect.top - 8,
        below,
      });
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTooltipPos(null);
  };

  return (
    <div
      ref={cardRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover Tooltip - 使用 Portal 渲染到 body，避免被容器 overflow 裁剪 */}
      {isHovered && isMounted && tooltipPos && createPortal(
        <div
          className="fixed z-[9999] px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-xs whitespace-nowrap pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: tooltipPos.below
              ? "translateX(-50%)"
              : "translateX(-50%) translateY(-100%)",
          }}
        >
          <div className="font-bold text-slate-200 mb-1">{shortLabel}</div>
          <div className="space-y-0.5 text-slate-400">
            {isDisabled ? (
              <>
                <div className="text-slate-500">暂无相关性数据</div>
                <div className="text-slate-600 text-[10px] pt-1">
                  该传感器对尚未积累足够的数据进行相关性分析
                </div>
              </>
            ) : (
              <>
                <div>
                  CAV: <span className="text-white font-mono">{cav.toFixed(4)}</span>
                </div>
                <div className="pt-1 border-t border-slate-700 mt-1">
                  <span className={isPairDynamic ? "text-green-400" : "text-slate-500"}>
                    该对阈值 ({isPairDynamic ? "动态" : "默认"}):
                  </span>
                </div>
                <div>
                  ULV: <span className="text-yellow-400 font-mono">{ulv.toFixed(4)}</span>
                  {" "}(P75)
                </div>
                <div>
                  LLV: <span className="text-blue-400 font-mono">{llv.toFixed(4)}</span>
                  {" "}(P25)
                </div>
                <div>
                  历史样本: <span className="text-slate-300 font-mono">{pairHistoryCount}</span>
                </div>
                <div className="pt-1 border-t border-slate-700 mt-1">
                  位置: <span className="text-slate-300">{cavPosition}</span>
                </div>
                <div>
                  状态: <span style={{ color }}>{getStatusLabel(status)}</span>
                </div>
              </>
            )}
          </div>
          {/* 箭头 - 根据位置调整方向 */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              tooltipPos.below
                ? "-top-2 border-b-slate-800"
                : "-bottom-2 border-t-slate-800"
            }`}
          />
        </div>,
        document.body
      )}

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 120 120"
        className={`overflow-visible cursor-pointer transition-transform ${isHovered ? "scale-105" : ""}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ opacity: isDisabled ? 0.5 : 1 }}
      >
      {/* 背景 */}
      <rect
        x="0"
        y="0"
        width="120"
        height="120"
        fill="#1E293B"
        rx="8"
        ry="8"
      />

      {/* 类型指示条 */}
      <rect
        x="10"
        y="5"
        width="100"
        height="3"
        fill={isDisabled ? "#475569" : typeColor}
        rx="1.5"
        opacity="0.8"
      />
      <text
        x="12"
        y="18"
        fontSize="7"
        fill={isDisabled ? "#64748B" : typeColor}
        fontWeight="bold"
      >
        {sensorType}
      </text>

      {/* 墙区域背景 (正常范围) */}
      <rect
        x="10"
        y="25"
        width="100"
        height="50"
        fill="#334155"
        opacity="0.5"
      />

      {/* 上墙线 ULV */}
      <line
        x1="10"
        y1="25"
        x2="110"
        y2="25"
        stroke="#64748B"
        strokeWidth="2"
        strokeDasharray="4 2"
      />
      <text
        x="108"
        y="20"
        fontSize="8"
        fill="#64748B"
        textAnchor="end"
      >
        ULV
      </text>

      {/* 下墙线 LLV */}
      <line
        x1="10"
        y1="75"
        x2="110"
        y2="75"
        stroke="#64748B"
        strokeWidth="2"
        strokeDasharray="4 2"
      />
      <text
        x="108"
        y="82"
        fontSize="8"
        fill="#64748B"
        textAnchor="end"
      >
        LLV
      </text>

      {/* 气泡阴影 (发光效果) */}
      <defs>
        <filter id={`glow-${label.replace(/[^a-zA-Z0-9]/g, "")}`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 气泡 - 添加平滑动画 */}
      <circle
        cx="60"
        cy={bubbleY}
        r={radius}
        fill={displayColor}
        filter={isDisabled ? undefined : `url(#glow-${label.replace(/[^a-zA-Z0-9]/g, "")})`}
        opacity="0.9"
        style={{
          transition: "cy 0.5s ease-out, r 0.3s ease-out, fill 0.3s ease-out",
        }}
      >
        {/* 脉冲动画 */}
        {shouldPulse && (
          <animate
            attributeName="r"
            values={`${radius};${radius + 3};${radius}`}
            dur="1.5s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* CAV值显示在气泡中（disabled显示"-"） */}
      <text
        x="60"
        y={bubbleY + 4}
        fontSize="9"
        fill="white"
        textAnchor="middle"
        fontWeight="bold"
      >
        {isDisabled ? "-" : cav.toFixed(2)}
      </text>

      {/* 传感器对标签 - 使用简称 */}
      <text
        x="60"
        y="100"
        fontSize="9"
        fill="#94A3B8"
        textAnchor="middle"
        fontWeight="500"
      >
        {shortLabel}
      </text>

      {/* 状态标签 */}
      <text
        x="60"
        y="112"
        fontSize="7"
        fill={displayColor}
        textAnchor="middle"
      >
        {isDisabled ? "暂无数据" : getStatusLabel(status)}
      </text>
    </svg>
    </div>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NORMAL: "正常",
    HIGH_NORMAL: "正常偏高",
    LOW_NORMAL: "正常偏低",
    HIGH_ABNORMAL: "异常偏高",
    LOW_ABNORMAL: "异常偏低",
    HIGH_WARNING: "警告-高",
    LOW_WARNING: "警告-低",
  };
  return labels[status] || status;
}

export default BubbleWallChart;
