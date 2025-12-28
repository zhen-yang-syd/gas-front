"use client";

import { useMemo } from "react";
import { Sensor } from "./Sensor";
import { Flyline } from "./Flyline";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  T_SENSOR_POSITIONS,
  WD_SENSOR_POSITIONS,
  FS_SENSOR_POSITIONS,
  getSensorPosition,
  ZONE_COLORS,
} from "./constants";

interface SensorData {
  [sensorId: string]: number;
}

interface AlertPair {
  sensor1: string;
  sensor2: string;
  cav: number;
}

interface MineMapProps {
  sensorData?: SensorData;
  alertSensors?: string[];
  alertPairs?: AlertPair[];
  tlvThreshold?: number;
  showLabels?: boolean;
}

/**
 * 矿洞地图组件
 *
 * 显示:
 * - 矿洞巷道布局
 * - 5个采区
 * - 传感器位置
 * - TLV超标高亮
 * - CAV>CALV飞线动画
 */
export function MineMap({
  sensorData = {},
  alertSensors = [],
  alertPairs = [],
  tlvThreshold = 0.8,
  showLabels = true,
}: MineMapProps) {
  // 计算超TLV的传感器
  const tlvAlertSensors = useMemo(() => {
    const alerts: string[] = [];
    Object.entries(sensorData).forEach(([id, value]) => {
      if (id.startsWith("T") && value > tlvThreshold) {
        alerts.push(id);
      }
    });
    return new Set([...alerts, ...alertSensors]);
  }, [sensorData, alertSensors, tlvThreshold]);

  // 渲染巷道背景
  const renderTunnels = () => (
    <g className="tunnels">
      {/* 主巷道 */}
      <rect
        x="40"
        y="260"
        width="520"
        height="30"
        fill="#334155"
        stroke="#475569"
        strokeWidth="2"
        rx="4"
      />
      <text x="300" y="280" fontSize="12" fill="#64748B" textAnchor="middle">
        主巷道
      </text>

      {/* 采区1连接通道 */}
      <rect
        x="110"
        y="130"
        width="20"
        height="130"
        fill="#334155"
        stroke="#475569"
        strokeWidth="2"
      />

      {/* 采区1 */}
      <rect
        x="50"
        y="40"
        width="160"
        height="100"
        fill="#1E293B"
        stroke={ZONE_COLORS[1]}
        strokeWidth="2"
        strokeDasharray="5 3"
        rx="8"
      />
      <text x="130" y="30" fontSize="10" fill={ZONE_COLORS[1]} textAnchor="middle">
        采区1
      </text>

      {/* 采区2 */}
      <rect
        x="50"
        y="160"
        width="160"
        height="80"
        fill="#1E293B"
        stroke={ZONE_COLORS[2]}
        strokeWidth="2"
        strokeDasharray="5 3"
        rx="8"
      />
      <text x="130" y="155" fontSize="10" fill={ZONE_COLORS[2]} textAnchor="middle">
        采区2
      </text>

      {/* 采区3连接通道 */}
      <rect
        x="330"
        y="130"
        width="20"
        height="130"
        fill="#334155"
        stroke="#475569"
        strokeWidth="2"
      />

      {/* 采区3 */}
      <rect
        x="260"
        y="40"
        width="180"
        height="100"
        fill="#1E293B"
        stroke={ZONE_COLORS[3]}
        strokeWidth="2"
        strokeDasharray="5 3"
        rx="8"
      />
      <text x="350" y="30" fontSize="10" fill={ZONE_COLORS[3]} textAnchor="middle">
        采区3
      </text>

      {/* 采区4 */}
      <rect
        x="150"
        y="300"
        width="100"
        height="60"
        fill="#1E293B"
        stroke={ZONE_COLORS[4]}
        strokeWidth="2"
        strokeDasharray="5 3"
        rx="8"
      />
      <text x="200" y="295" fontSize="10" fill={ZONE_COLORS[4]} textAnchor="middle">
        采区4
      </text>

      {/* 采区5 */}
      <rect
        x="350"
        y="300"
        width="100"
        height="60"
        fill="#1E293B"
        stroke={ZONE_COLORS[5]}
        strokeWidth="2"
        strokeDasharray="5 3"
        rx="8"
      />
      <text x="400" y="295" fontSize="10" fill={ZONE_COLORS[5]} textAnchor="middle">
        采区5
      </text>
    </g>
  );

  // 渲染飞线
  const renderFlylines = () => (
    <g className="flylines">
      {alertPairs.map((pair, index) => {
        const pos1 = getSensorPosition(pair.sensor1);
        const pos2 = getSensorPosition(pair.sensor2);

        if (!pos1 || !pos2) return null;

        return (
          <Flyline
            key={`flyline-${index}`}
            from={{ x: pos1.x, y: pos1.y }}
            to={{ x: pos2.x, y: pos2.y }}
            active={true}
            color="#EF4444"
            label={`r=${pair.cav.toFixed(2)}`}
          />
        );
      })}
    </g>
  );

  // 渲染所有传感器
  const renderSensors = () => (
    <g className="sensors">
      {/* T传感器 */}
      {Object.entries(T_SENSOR_POSITIONS).map(([id, pos]) => (
        <Sensor
          key={id}
          id={id}
          x={pos.x}
          y={pos.y}
          type="T"
          value={sensorData[id]}
          isAlert={tlvAlertSensors.has(id)}
        />
      ))}

      {/* WD传感器 */}
      {Object.entries(WD_SENSOR_POSITIONS).map(([id, pos]) => (
        <Sensor
          key={id}
          id={id}
          x={pos.x}
          y={pos.y}
          type="WD"
        />
      ))}

      {/* FS传感器 */}
      {Object.entries(FS_SENSOR_POSITIONS).map(([id, pos]) => (
        <Sensor
          key={id}
          id={id}
          x={pos.x}
          y={pos.y}
          type="FS"
        />
      ))}
    </g>
  );

  return (
    <div className="mine-map-container">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="bg-slate-950 rounded-lg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 背景网格 */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#1E293B"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* 巷道布局 */}
        {renderTunnels()}

        {/* 飞线动画 */}
        {renderFlylines()}

        {/* 传感器 */}
        {renderSensors()}

        {/* 图例 */}
        {showLabels && (
          <g className="legend" transform="translate(480, 40)">
            <rect
              x="0"
              y="0"
              width="110"
              height="90"
              fill="#1E293B"
              stroke="#334155"
              strokeWidth="1"
              rx="4"
            />
            <text x="55" y="16" fontSize="9" fill="#94A3B8" textAnchor="middle">
              图例
            </text>

            {/* T传感器 */}
            <circle cx="20" cy="32" r="6" fill="#3B82F6" />
            <text x="35" y="36" fontSize="8" fill="#CBD5E1">
              T - 瓦斯
            </text>

            {/* WD传感器 */}
            <rect x="14" y="46" width="12" height="12" fill="#10B981" rx="2" />
            <text x="35" y="56" fontSize="8" fill="#CBD5E1">
              WD - 温度
            </text>

            {/* FS传感器 */}
            <polygon points="20,62 14,74 26,74" fill="#F59E0B" />
            <text x="35" y="72" fontSize="8" fill="#CBD5E1">
              FS - 风速
            </text>

            {/* 告警 */}
            <circle cx="20" cy="85" r="6" fill="#EF4444" />
            <text x="35" y="89" fontSize="8" fill="#CBD5E1">
              超TLV告警
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default MineMap;
