"use client";

import { useMemo } from "react";

interface SensorProps {
  id: string;
  x: number;
  y: number;
  type: "T" | "WD" | "FS";
  value?: number;
  isAlert?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
}

/**
 * 传感器圆圈组件
 *
 * - T传感器: 蓝色圆圈 (瓦斯浓度)
 * - WD传感器: 绿色方块 (温度)
 * - FS传感器: 橙色三角 (风速)
 */
export function Sensor({
  id,
  x,
  y,
  type,
  value,
  isAlert = false,
  isHighlighted = false,
  onClick,
}: SensorProps) {
  // 根据类型确定样式
  const styles = useMemo(() => {
    const baseStyles = {
      T: { fill: "#3B82F6", stroke: "#60A5FA", size: 10 },
      WD: { fill: "#10B981", stroke: "#34D399", size: 8 },
      FS: { fill: "#F59E0B", stroke: "#FBBF24", size: 8 },
    };

    const style = baseStyles[type];

    // 告警状态覆盖颜色
    if (isAlert) {
      return { ...style, fill: "#EF4444", stroke: "#F87171" };
    }

    // 高亮状态
    if (isHighlighted) {
      return { ...style, fill: "#8B5CF6", stroke: "#A78BFA" };
    }

    return style;
  }, [type, isAlert, isHighlighted]);

  // 渲染不同形状
  const renderShape = () => {
    const { fill, stroke, size } = styles;

    switch (type) {
      case "T":
        // 圆形
        return (
          <circle
            cx={x}
            cy={y}
            r={size}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
          />
        );
      case "WD":
        // 方形
        return (
          <rect
            x={x - size}
            y={y - size}
            width={size * 2}
            height={size * 2}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
            rx="2"
          />
        );
      case "FS":
        // 三角形
        const points = `${x},${y - size} ${x - size},${y + size} ${x + size},${y + size}`;
        return (
          <polygon
            points={points}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
          />
        );
    }
  };

  return (
    <g
      className={`cursor-pointer transition-transform ${onClick ? "hover:scale-110" : ""}`}
      onClick={onClick}
    >
      {/* 告警脉冲效果 */}
      {isAlert && (
        <circle
          cx={x}
          cy={y}
          r={styles.size + 5}
          fill="none"
          stroke="#EF4444"
          strokeWidth="2"
          opacity="0.5"
        >
          <animate
            attributeName="r"
            values={`${styles.size + 5};${styles.size + 15};${styles.size + 5}`}
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.5;0;0.5"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* 高亮光环 */}
      {isHighlighted && !isAlert && (
        <circle
          cx={x}
          cy={y}
          r={styles.size + 3}
          fill="none"
          stroke="#8B5CF6"
          strokeWidth="2"
          opacity="0.7"
        />
      )}

      {/* 传感器形状 */}
      {renderShape()}

      {/* ID标签 */}
      <text
        x={x}
        y={y + styles.size + 12}
        fontSize="8"
        fill="#94A3B8"
        textAnchor="middle"
      >
        {id.replace("T0", "T").replace("WD0", "W").replace("FS0", "F")}
      </text>

      {/* 数值显示 (仅T传感器，且值有效) */}
      {type === "T" && value != null && (
        <text
          x={x}
          y={y + 4}
          fontSize="7"
          fill="white"
          textAnchor="middle"
          fontWeight="bold"
        >
          {value.toFixed(2)}
        </text>
      )}
    </g>
  );
}

export default Sensor;
