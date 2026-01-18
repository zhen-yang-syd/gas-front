"use client";

import React from "react";
import { SensorStatus } from "./types";
import { formatValue, getStatusText } from "./utils";

interface SensorGridProps {
  sensors: SensorStatus[];
}

export const SensorGrid: React.FC<SensorGridProps> = ({ sensors }) => {
  // 按前缀分组 - 核心传感器
  const tSensors = sensors.filter((s) => s.name.startsWith("T") && !s.name.startsWith("TS"));
  const wdSensors = sensors.filter((s) => s.name.startsWith("WD"));
  const fsSensors = sensors.filter((s) => s.name.startsWith("FS"));

  // 按前缀分组 - 扩展传感器
  const wySensors = sensors.filter((s) => s.name.startsWith("WY"));
  const ylSensors = sensors.filter((s) => s.name.startsWith("YL"));
  const coSensors = sensors.filter((s) => s.name.startsWith("CO"));
  const sySensors = sensors.filter((s) => s.name.startsWith("SY"));
  const llSensors = sensors.filter((s) => s.name.startsWith("LL"));

  const getStatusClass = (status: SensorStatus["status"]) => {
    switch (status) {
      case "danger":
        return "bg-danger/40 border-danger";
      case "warning":
        return "bg-warning/40 border-warning";
      case "normal":
        return "bg-normal/30 border-normal/60";
      case "no-data":
      default:
        return "bg-tertiary border-edge";
    }
  };

  const renderSensorGroup = (
    title: string,
    groupSensors: SensorStatus[],
    colorClass: string
  ) => {
    // 始终渲染分组容器，避免布局抖动
    return (
      <div className="space-y-2 min-h-[80px]">
        <h3 className={`text-sm font-light ${colorClass} mb-2`}>{title}</h3>
        {groupSensors.length === 0 ? (
          <div className="text-xs text-dim py-4 text-center">暂无数据</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groupSensors.map((sensor) => {
              const valueText =
                sensor.value !== null ? formatValue(sensor.value) : "--";
              const statusText = getStatusText(sensor.status);

              return (
                <div
                  key={sensor.name}
                  className={`${getStatusClass(sensor.status)} border rounded w-[72px] h-[52px] flex flex-col items-center justify-center cursor-pointer transition-colors hover:brightness-110 relative group`}
                >
                  <div className="text-bright text-xs font-light truncate max-w-[64px]">
                    {sensor.name}
                  </div>
                  <div className="text-soft text-xs font-mono tabular-nums truncate max-w-[64px]">{valueText}</div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-20 bg-surface text-bright text-xs rounded px-3 py-2 whitespace-pre-line border border-edge shadow-lg min-w-[180px]">
                    <div className="font-semibold mb-1 text-accent">{sensor.name}</div>
                    <div className="text-soft">最新值: <span className="text-bright font-mono">{valueText}</span></div>
                    <div className="text-soft">更新时间: <span className="text-dim">{sensor.lastUpdate}</span></div>
                    <div className="text-soft">状态: <span className={
                      sensor.status === "danger" ? "text-err" :
                      sensor.status === "warning" ? "text-warn" :
                      sensor.status === "normal" ? "text-ok" : "text-dim"
                    }>{statusText}</span></div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-edge" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // 检查是否有扩展传感器数据
  const hasExtensibleSensors = wySensors.length > 0 || ylSensors.length > 0 ||
    coSensors.length > 0 || sySensors.length > 0 || llSensors.length > 0;

  return (
    <div className="industrial-card p-4">
      <div className="industrial-title text-xs mb-4">传感器状态网格</div>

      {/* 核心传感器 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderSensorGroup("T (Gas/瓦斯)", tSensors, "text-ok")}
        {renderSensorGroup("WD (温度)", wdSensors, "text-note")}
        {renderSensorGroup("FS (风速)", fsSensors, "text-fs-sensor")}
      </div>

      {/* 扩展传感器 */}
      {hasExtensibleSensors && (
        <>
          <div className="my-4 border-t border-edge" />
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-dim">扩展传感器</span>
            <span className="text-xs text-dim opacity-50">（预留接口）</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            {renderSensorGroup("WY (位移/mm)", wySensors, "text-purple-400")}
            {renderSensorGroup("YL (应力/MPa)", ylSensors, "text-orange-400")}
            {renderSensorGroup("CO (一氧化碳/ppm)", coSensors, "text-red-400")}
            {renderSensorGroup("SY (水压/MPa)", sySensors, "text-blue-400")}
            {renderSensorGroup("LL (流量/m³/h)", llSensors, "text-teal-400")}
          </div>
        </>
      )}

      {/* 图例 */}
      <div className="flex items-center gap-6 mt-4 pt-3 border-t border-edge">
        <div className="flex items-center gap-1.5">
          <span className="status-indicator status-normal" />
          <span className="text-xs text-dim">正常</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="status-indicator status-warning" />
          <span className="text-xs text-dim">预警 (&gt;0.8)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="status-indicator status-danger" />
          <span className="text-xs text-dim">危险 (&gt;1.0)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="status-indicator status-muted" />
          <span className="text-xs text-dim">无数据</span>
        </div>
      </div>
    </div>
  );
};
