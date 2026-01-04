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

interface MineMapProps {
  sensorData?: SensorData;
  alertSensors?: string[];
  alertPairs?: AlertPair[];
  tlvThreshold?: number;
  showLabels?: boolean;
}

/**
 * 矿洞地图组件 - MaZhuang矿井
 *
 * 基于 drawio 文件精确绘制的巷道布局
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

  // 渲染巷道背景 - 基于 drawio 坐标精确绘制
  const renderTunnels = () => (
    <g className="tunnels">
      {/* ====== 主进风巷 (y: 200-210) ====== */}
      <rect x="80" y="200" width="1520" height="10" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />
      <rect x="80" y="210" width="1520" height="2" fill="#4A5568" /> {/* 下边线 */}

      {/* ====== 主回风巷 (y: 280-290) ====== */}
      <rect x="0" y="280" width="1600" height="10" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />
      <rect x="0" y="290" width="1600" height="2" fill="#4A5568" />

      {/* ====== 下部巷道 (y: 360-370) ====== */}
      <rect x="100" y="360" width="1500" height="10" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />
      <rect x="100" y="370" width="1500" height="2" fill="#4A5568" />

      {/* ====== 左侧工作面1 斜向连接 ====== */}
      <line x1="10" y1="280" x2="80" y2="210" stroke="#4A5568" strokeWidth="2" />
      <line x1="20" y1="280" x2="90" y2="210" stroke="#4A5568" strokeWidth="2" />

      {/* ====== 左侧工作面2 斜向连接 ====== */}
      <line x1="160" y1="280" x2="230" y2="210" stroke="#4A5568" strokeWidth="2" />
      <line x1="170" y1="280" x2="240" y2="210" stroke="#4A5568" strokeWidth="2" />

      {/* ====== 垂直连接1 (x: 815-826) ====== */}
      <rect x="815" y="210" width="11" height="70" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== 垂直连接2 (x: 600-611) ====== */}
      <rect x="600" y="210" width="11" height="150" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== L形分支 - 主竖直段 (x: 1120-1131) ====== */}
      <rect x="1120" y="210" width="11" height="150" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== L形分支 - 垂直连接 (x: 1160-1171) ====== */}
      <rect x="1160" y="280" width="11" height="70" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== 工作面3 区域 (x: 350-390) ====== */}
      <line x1="350" y1="320" x2="380" y2="290" stroke="#4A5568" strokeWidth="2" />
      <line x1="360" y1="320" x2="390" y2="290" stroke="#4A5568" strokeWidth="2" />

      {/* ====== 工作面3 竖直部分 ====== */}
      <rect x="350" y="320" width="10" height="100" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== 工作面3 底部水平 ====== */}
      <rect x="350" y="410" width="130" height="10" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== U形连接区域 (x: 430-530) ====== */}
      <path d="M 520,290 L 520,320 L 440,320 L 440,290" fill="none" stroke="#4A5568" strokeWidth="2" />
      <path d="M 530,290 L 530,330 L 430,330 L 430,290" fill="none" stroke="#4A5568" strokeWidth="2" />

      {/* ====== 垂直连接3 (x: 730-741) ====== */}
      <rect x="730" y="290" width="11" height="70" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== 斜向工作面5 ====== */}
      <line x1="970" y1="360" x2="920" y2="290" stroke="#4A5568" strokeWidth="2" />
      <line x1="980" y1="360" x2="930" y2="290" stroke="#4A5568" strokeWidth="2" />

      {/* ====== MaZhuang 入口 - 斜向上 ====== */}
      <line x1="1160" y1="490" x2="860" y2="90" stroke="#4A5568" strokeWidth="2" />
      <line x1="1160" y1="480" x2="870" y2="90" stroke="#4A5568" strokeWidth="2" />

      {/* ====== MaZhuang 入口顶部 ====== */}
      <path d="M 770,40 Q 820,80 860,90" fill="none" stroke="#4A5568" strokeWidth="2" />
      <path d="M 780,40 Q 820,70 870,90" fill="none" stroke="#4A5568" strokeWidth="2" />

      {/* ====== L形分支底部水平 (y: 480-490) ====== */}
      <rect x="1160" y="480" width="440" height="10" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />
      <rect x="1160" y="490" width="440" height="2" fill="#4A5568" />

      {/* ====== L形分支 - 斜向连接1 ====== */}
      <line x1="1160" y1="400" x2="1190" y2="370" stroke="#4A5568" strokeWidth="2" />
      <line x1="1170" y1="400" x2="1200" y2="370" stroke="#4A5568" strokeWidth="2" />

      {/* ====== L形分支 - 竖直段 (x: 1160-1171) ====== */}
      <rect x="1160" y="400" width="11" height="80" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== L形分支 - 垂直连接 (x: 1230-1241) ====== */}
      <rect x="1230" y="370" width="11" height="110" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== L形分支 - 垂直连接 (x: 1440-1451) ====== */}
      <rect x="1440" y="370" width="11" height="110" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== L形分支 - 斜向水平连接 ====== */}
      <path d="M 1240,400 Q 1340,400 1340,370" fill="none" stroke="#4A5568" strokeWidth="2" />
      <path d="M 1241,410 Q 1350,410 1350,370" fill="none" stroke="#4A5568" strokeWidth="2" />

      {/* ====== L形分支 - 另一侧斜向 ====== */}
      <path d="M 1350,400 Q 1380,400 1380,370" fill="none" stroke="#4A5568" strokeWidth="2" />
      <path d="M 1350,410 Q 1390,410 1390,370" fill="none" stroke="#4A5568" strokeWidth="2" />

      {/* ====== L形分支 - 水平连接 ====== */}
      <rect x="1390" y="400" width="50" height="10" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== 右侧垂直连接 (x: 1310-1321) ====== */}
      <rect x="1310" y="290" width="11" height="70" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== 右侧垂直连接 (x: 1370-1381) ====== */}
      <rect x="1370" y="290" width="11" height="70" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />

      {/* ====== 右侧斜向连接 ====== */}
      <line x1="1400" y1="360" x2="1350" y2="290" stroke="#4A5568" strokeWidth="2" />
      <line x1="1410" y1="360" x2="1360" y2="290" stroke="#4A5568" strokeWidth="2" />

      {/* ====== 最右侧分支 ====== */}
      <path d="M 1450,400 Q 1580,400 1580,480" fill="none" stroke="#4A5568" strokeWidth="2" />
      <path d="M 1450,410 Q 1570,410 1570,480" fill="none" stroke="#4A5568" strokeWidth="2" />

      {/* ====== 最右侧斜向工作面 ====== */}
      <line x1="1510" y1="400" x2="1540" y2="370" stroke="#4A5568" strokeWidth="2" />
      <line x1="1520" y1="400" x2="1550" y2="370" stroke="#4A5568" strokeWidth="2" />

      {/* MaZhuang 标注 */}
      <text x="865" y="75" fontSize="14" fill="#A0AEC0" fontWeight="bold" textAnchor="middle">
        MaZhuang
      </text>
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

      {/* 工作面1 */}
      <polygon points="10,280 80,210 90,210 20,280" fill="url(#hatch)" stroke="#48BB78" strokeWidth="1.5" />

      {/* 工作面2 */}
      <polygon points="160,280 230,210 240,210 170,280" fill="url(#hatch)" stroke="#48BB78" strokeWidth="1.5" />

      {/* 工作面3 */}
      <polygon points="350,320 380,290 390,290 360,320" fill="url(#hatch)" stroke="#48BB78" strokeWidth="1.5" />

      {/* 工作面4 (U形) */}
      <polygon points="520,290 440,290 440,320 530,320" fill="url(#hatch)" stroke="#48BB78" strokeWidth="1.5" />

      {/* 工作面5 (斜向) */}
      <polygon points="970,360 920,290 930,290 980,360" fill="url(#hatch)" stroke="#48BB78" strokeWidth="1.5" />

      {/* L形工作面 */}
      <polygon points="1160,400 1190,370 1200,370 1170,400" fill="url(#hatch)" stroke="#48BB78" strokeWidth="1.5" />

      {/* 右下工作面 */}
      <polygon points="1050,360 1100,360 1115,370 1065,370" fill="url(#hatch)" stroke="#48BB78" strokeWidth="1.5" />
    </g>
  );

  // 渲染气流方向箭头
  const renderAirflowArrows = () => (
    <g className="airflow-arrows">
      {/* 箭头定义 */}
      <defs>
        <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,8 L8,4 z" fill="#48BB78" />
        </marker>
        <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,8 L8,4 z" fill="#F56565" />
        </marker>
      </defs>

      {/* ====== 进风方向 (绿色) - 主巷道向右 ====== */}
      <line x1="110" y1="165" x2="190" y2="165" stroke="#48BB78" strokeWidth="3" markerEnd="url(#arrowGreen)" />
      <line x1="340" y1="165" x2="420" y2="165" stroke="#48BB78" strokeWidth="3" markerEnd="url(#arrowGreen)" />
      <line x1="570" y1="165" x2="650" y2="165" stroke="#48BB78" strokeWidth="3" markerEnd="url(#arrowGreen)" />

      {/* ====== 回风方向 (红色) - 回风巷向左 ====== */}
      <line x1="1140" y1="180" x2="1060" y2="180" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="1530" y1="260" x2="1450" y2="260" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="1370" y1="260" x2="1290" y2="260" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="1100" y1="260" x2="1020" y2="260" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="950" y1="260" x2="870" y2="260" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="770" y1="260" x2="690" y2="260" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="480" y1="260" x2="400" y2="260" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="330" y1="260" x2="250" y2="260" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="155" y1="260" x2="75" y2="260" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />

      {/* ====== 下部巷道气流 ====== */}
      <line x1="170" y1="340" x2="250" y2="340" stroke="#48BB78" strokeWidth="3" markerEnd="url(#arrowGreen)" />
      <line x1="570" y1="315" x2="600" y2="315" stroke="#48BB78" strokeWidth="3" markerEnd="url(#arrowGreen)" />
      <line x1="580" y1="340" x2="550" y2="340" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="920" y1="340" x2="840" y2="340" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="1570" y1="340" x2="1490" y2="340" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="1295" y1="340" x2="1215" y2="340" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />

      {/* ====== L形分支气流 ====== */}
      <line x1="1480" y1="540" x2="1400" y2="540" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="1550" y1="385" x2="1630" y2="385" stroke="#48BB78" strokeWidth="3" markerEnd="url(#arrowGreen)" />

      {/* ====== MaZhuang 入口气流 ====== */}
      <line x1="910" y1="185" x2="860" y2="125" stroke="#48BB78" strokeWidth="3" markerEnd="url(#arrowGreen)" />
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
      <rect x="0" y="0" width="120" height="70" fill="#1A202C" stroke="#4A5568" strokeWidth="1" rx="4" />
      <text x="60" y="16" fontSize="11" fill="#A0AEC0" textAnchor="middle" fontWeight="bold">
        图例
      </text>

      {/* T传感器 */}
      <circle cx="15" cy="32" r="6" fill="#3B82F6" />
      <text x="28" y="36" fontSize="10" fill="#CBD5E1">T-瓦斯浓度</text>

      {/* WD传感器 */}
      <rect x="9" y="44" width="12" height="12" fill="#10B981" rx="2" />
      <text x="28" y="54" fontSize="10" fill="#CBD5E1">WD-温度</text>

      {/* FS传感器 */}
      <polygon points="15,62 9,74 21,74" fill="#F59E0B" />
      <text x="28" y="70" fontSize="10" fill="#CBD5E1">FS-风速</text>

      {/* 告警 */}
      <circle cx="95" cy="32" r="6" fill="#EF4444" />
      <text x="95" y="48" fontSize="9" fill="#EF4444" textAnchor="middle">告警</text>
    </g>
  );

  // 渲染气流图例
  const renderAirflowLegend = () => (
    <g className="airflow-legend" transform="translate(160, 460)">
      <rect x="0" y="0" width="100" height="70" fill="#1A202C" stroke="#4A5568" strokeWidth="1" rx="4" />
      <text x="50" y="16" fontSize="11" fill="#A0AEC0" textAnchor="middle" fontWeight="bold">
        气流方向
      </text>

      <line x1="10" y1="35" x2="40" y2="35" stroke="#48BB78" strokeWidth="3" markerEnd="url(#arrowGreen)" />
      <text x="55" y="39" fontSize="10" fill="#48BB78">进风</text>

      <line x1="10" y1="55" x2="40" y2="55" stroke="#F56565" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <text x="55" y="59" fontSize="10" fill="#F56565">回风</text>
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
