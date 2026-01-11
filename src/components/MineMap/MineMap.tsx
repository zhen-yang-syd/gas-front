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
  // 巷道路径数据
  LINES_Y200,
  LINES_Y210,
  LINES_Y280,
  LINES_Y290,
  LINES_Y360,
  LINES_Y370,
  LINES_Y480,
  LINES_Y490,
  LINES_OTHER_HORIZONTAL,
  VERTICAL_LINES,
  DIAGONAL_LINES,
  U_SHAPED_PATHS,
  CURVED_PATHS,
  WORKING_FACES,
  AIRFLOW_ARROWS,
} from "./constants";

interface SensorData {
  [sensorId: string]: number;
}

interface AlertPair {
  sensor1: string;
  sensor2: string;
  cav: number;
  status?: string;
}

// 根据状态获取连线颜色
function getStatusColor(status?: string): string {
  if (!status) return "#3B82F6"; // 默认蓝色
  if (status.includes("WARNING")) return "#EF4444"; // 红色
  if (status.includes("ABNORMAL")) return "#F59E0B"; // 橙色
  return "#3B82F6"; // 正常蓝色
}

// 巷道线条样式
const TUNNEL_STROKE = "#4A5568";
const TUNNEL_STROKE_WIDTH = 2;

interface MineMapProps {
  sensorData?: SensorData;
  alertSensors?: string[];
  alertPairs?: AlertPair[];
  tlvThreshold?: number;
  showLabels?: boolean;
}

/**
 * 矿洞地图组件 - 基于 gas-path-2.drawio 精确复刻
 *
 * 画布: 1600 × 550
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

  // 渲染水平线段组
  const renderHorizontalLines = (
    lines: Array<[number, number, number, number]>,
    key: string
  ) => (
    <g key={key}>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={`${key}-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={TUNNEL_STROKE}
          strokeWidth={TUNNEL_STROKE_WIDTH}
        />
      ))}
    </g>
  );

  // 渲染垂直线段
  const renderVerticalLines = () => (
    <g className="vertical-lines">
      {VERTICAL_LINES.map(([x1, y1, x2, y2], i) => (
        <line
          key={`v-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={TUNNEL_STROKE}
          strokeWidth={TUNNEL_STROKE_WIDTH}
        />
      ))}
    </g>
  );

  // 渲染斜向线段
  const renderDiagonalLines = () => (
    <g className="diagonal-lines">
      {DIAGONAL_LINES.map(([x1, y1, x2, y2], i) => (
        <line
          key={`d-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={TUNNEL_STROKE}
          strokeWidth={TUNNEL_STROKE_WIDTH}
        />
      ))}
    </g>
  );

  // 渲染U形路径
  const renderUShapedPaths = () => (
    <g className="u-shaped-paths">
      {U_SHAPED_PATHS.map((d, i) => (
        <path
          key={`u-${i}`}
          d={d}
          fill="none"
          stroke={TUNNEL_STROKE}
          strokeWidth={TUNNEL_STROKE_WIDTH}
        />
      ))}
    </g>
  );

  // 渲染曲线路径
  const renderCurvedPaths = () => (
    <g className="curved-paths">
      {CURVED_PATHS.map((d, i) => (
        <path
          key={`c-${i}`}
          d={d}
          fill="none"
          stroke={TUNNEL_STROKE}
          strokeWidth={TUNNEL_STROKE_WIDTH}
        />
      ))}
    </g>
  );

  // 渲染巷道背景 - 基于 drawio 坐标精确绘制
  const renderTunnels = () => (
    <g className="tunnels">
      {/* ====== 顶层主巷道 y=200-210 ====== */}
      {renderHorizontalLines(LINES_Y200, "y200")}
      {renderHorizontalLines(LINES_Y210, "y210")}

      {/* ====== 中层回风巷 y=280-290 ====== */}
      {renderHorizontalLines(LINES_Y280, "y280")}
      {renderHorizontalLines(LINES_Y290, "y290")}

      {/* ====== 下层巷道 y=360-370 ====== */}
      {renderHorizontalLines(LINES_Y360, "y360")}
      {renderHorizontalLines(LINES_Y370, "y370")}

      {/* ====== 底层L形分支 y=480-490 ====== */}
      {renderHorizontalLines(LINES_Y480, "y480")}
      {renderHorizontalLines(LINES_Y490, "y490")}

      {/* ====== 其他水平线段 ====== */}
      {renderHorizontalLines(LINES_OTHER_HORIZONTAL, "other-h")}

      {/* ====== 垂直连接线 ====== */}
      {renderVerticalLines()}

      {/* ====== 斜向线段 ====== */}
      {renderDiagonalLines()}

      {/* ====== U形路径 ====== */}
      {renderUShapedPaths()}

      {/* ====== 曲线路径 ====== */}
      {renderCurvedPaths()}
    </g>
  );

  // 渲染工作面 (带斜线填充)
  const renderWorkingFaces = () => (
    <g className="working-faces">
      {/* 工作面填充样式 */}
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8">
          <path d="M0,0 l8,8" stroke="#2D3748" strokeWidth="1.5" />
        </pattern>
      </defs>

      {WORKING_FACES.map((face, i) => (
        <polygon
          key={`face-${i}`}
          points={face.points}
          fill="url(#hatch)"
          stroke="#48BB78"
          strokeWidth="1.5"
        />
      ))}
    </g>
  );

  // 渲染气流方向箭头
  const renderAirflowArrows = () => (
    <g className="airflow-arrows">
      {/* 箭头定义 */}
      <defs>
        <marker
          id="arrowGreen"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,8 L8,4 z" fill="#48BB78" />
        </marker>
        <marker
          id="arrowRed"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,8 L8,4 z" fill="#F56565" />
        </marker>
      </defs>

      {AIRFLOW_ARROWS.map((arrow, i) => (
        <line
          key={`arrow-${i}`}
          x1={arrow.from[0]}
          y1={arrow.from[1]}
          x2={arrow.to[0]}
          y2={arrow.to[1]}
          stroke={arrow.type === "intake" ? "#48BB78" : "#F56565"}
          strokeWidth="3"
          markerEnd={arrow.type === "intake" ? "url(#arrowGreen)" : "url(#arrowRed)"}
        />
      ))}
    </g>
  );

  // 渲染飞线 - 显示所有传感器对的连线
  const renderFlylines = () => (
    <g className="flylines">
      {alertPairs.map((pair, index) => {
        const pos1 = getSensorPosition(pair.sensor1);
        const pos2 = getSensorPosition(pair.sensor2);

        if (!pos1 || !pos2) return null;

        const color = getStatusColor(pair.status);

        return (
          <Flyline
            key={`flyline-${index}`}
            from={{ x: pos1.x, y: pos1.y }}
            to={{ x: pos2.x, y: pos2.y }}
            active={true}
            color={color}
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
        <Sensor key={id} id={id} x={pos.x} y={pos.y} type="WD" />
      ))}

      {/* FS传感器 */}
      {Object.entries(FS_SENSOR_POSITIONS).map(([id, pos]) => (
        <Sensor key={id} id={id} x={pos.x} y={pos.y} type="FS" />
      ))}
    </g>
  );

  // 渲染图例
  const renderLegend = () => (
    <g className="legend" transform="translate(30, 460)">
      <rect
        x="0"
        y="0"
        width="120"
        height="70"
        fill="#1A202C"
        stroke="#4A5568"
        strokeWidth="1"
        rx="4"
      />
      <text
        x="60"
        y="16"
        fontSize="11"
        fill="#A0AEC0"
        textAnchor="middle"
        fontWeight="bold"
      >
        图例
      </text>

      {/* T传感器 */}
      <circle cx="15" cy="32" r="6" fill="#3B82F6" />
      <text x="28" y="36" fontSize="10" fill="#CBD5E1">
        T-瓦斯浓度
      </text>

      {/* WD传感器 */}
      <rect x="9" y="44" width="12" height="12" fill="#10B981" rx="2" />
      <text x="28" y="54" fontSize="10" fill="#CBD5E1">
        WD-温度
      </text>

      {/* FS传感器 */}
      <polygon points="15,62 9,74 21,74" fill="#F59E0B" />
      <text x="28" y="70" fontSize="10" fill="#CBD5E1">
        FS-风速
      </text>

      {/* 告警 */}
      <circle cx="95" cy="32" r="6" fill="#EF4444" />
      <text x="95" y="48" fontSize="9" fill="#EF4444" textAnchor="middle">
        告警
      </text>
    </g>
  );

  // 渲染气流图例
  const renderAirflowLegend = () => (
    <g className="airflow-legend" transform="translate(160, 460)">
      <rect
        x="0"
        y="0"
        width="100"
        height="70"
        fill="#1A202C"
        stroke="#4A5568"
        strokeWidth="1"
        rx="4"
      />
      <text
        x="50"
        y="16"
        fontSize="11"
        fill="#A0AEC0"
        textAnchor="middle"
        fontWeight="bold"
      >
        气流方向
      </text>

      <line
        x1="10"
        y1="35"
        x2="40"
        y2="35"
        stroke="#48BB78"
        strokeWidth="3"
        markerEnd="url(#arrowGreen)"
      />
      <text x="55" y="39" fontSize="10" fill="#48BB78">
        进风
      </text>

      <line
        x1="10"
        y1="55"
        x2="40"
        y2="55"
        stroke="#F56565"
        strokeWidth="3"
        markerEnd="url(#arrowRed)"
      />
      <text x="55" y="59" fontSize="10" fill="#F56565">
        回风
      </text>
    </g>
  );

  return (
    <div className="mine-map-container w-full h-full">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="bg-slate-950 rounded-lg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 背景网格 */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1E293B" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* 巷道布局 */}
        {renderTunnels()}

        {/* 工作面 */}
        {renderWorkingFaces()}

        {/* 气流方向箭头 */}
        {renderAirflowArrows()}

        {/* 飞线动画 */}
        {renderFlylines()}

        {/* 传感器 */}
        {renderSensors()}

        {/* 图例 */}
        {showLabels && renderLegend()}
        {showLabels && renderAirflowLegend()}
      </svg>
    </div>
  );
}

export default MineMap;
