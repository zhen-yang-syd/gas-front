"use client";

interface FlylineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  active?: boolean;
  color?: string;
  label?: string;
}

/**
 * 飞线动画组件
 *
 * 当CAV > CALV时，在关联的传感器之间显示动态飞线
 * 参考: Kaspersky Cybermap 飞线效果
 */
export function Flyline({
  from,
  to,
  active = true,
  color = "#EF4444",
  label,
}: FlylineProps) {
  // 计算贝塞尔曲线控制点
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // 曲线弯曲程度 (基于距离)
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(distance * 0.3, 50);

  // 控制点垂直于连线方向
  const angle = Math.atan2(dy, dx);
  const perpAngle = angle + Math.PI / 2;
  const ctrlX = midX + Math.cos(perpAngle) * curvature;
  const ctrlY = midY + Math.sin(perpAngle) * curvature;

  // 路径定义
  const pathD = `M ${from.x},${from.y} Q ${ctrlX},${ctrlY} ${to.x},${to.y}`;

  // 生成唯一ID
  const pathId = `flyline-${from.x}-${from.y}-${to.x}-${to.y}`.replace(/\./g, "-");

  if (!active) return null;

  return (
    <g className="flyline-group">
      {/* 渐变定义 */}
      <defs>
        <linearGradient id={`gradient-${pathId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </linearGradient>

        {/* 发光滤镜 */}
        <filter id={`glow-${pathId}`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 底层静态路径 (发光效果) */}
      <path
        d={pathD}
        stroke={color}
        strokeWidth="2"
        fill="none"
        opacity="0.3"
        filter={`url(#glow-${pathId})`}
      />

      {/* 动画虚线路径 */}
      <path
        d={pathD}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeDasharray="8 4"
        strokeLinecap="round"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-24"
          dur="1s"
          repeatCount="indefinite"
        />
      </path>

      {/* 飞行粒子 */}
      <circle r="4" fill={color} filter={`url(#glow-${pathId})`}>
        <animateMotion dur="1.5s" repeatCount="indefinite" path={pathD} />
      </circle>

      {/* 第二个粒子 (延迟) */}
      <circle r="3" fill={color} opacity="0.7">
        <animateMotion
          dur="1.5s"
          repeatCount="indefinite"
          path={pathD}
          begin="0.5s"
        />
      </circle>

      {/* 标签 (可选) */}
      {label && (
        <text
          x={midX}
          y={midY - 10}
          fontSize="8"
          fill={color}
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
}

export default Flyline;
