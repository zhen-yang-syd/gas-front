"use client";

import React from "react";

// 可扩展传感器类型配置
const EXTENSIBLE_SENSOR_TYPES = [
  {
    code: "WY",
    name: "位移传感器",
    description: "监测巷道围岩位移变形",
    unit: "mm",
    colorClass: "text-purple-400 border-purple-400/40 bg-purple-400/10",
  },
  {
    code: "YL",
    name: "应力传感器",
    description: "监测支护结构应力状态",
    unit: "MPa",
    colorClass: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  },
  {
    code: "CO",
    name: "一氧化碳传感器",
    description: "监测CO浓度，预防煤自燃",
    unit: "ppm",
    colorClass: "text-red-400 border-red-400/40 bg-red-400/10",
  },
  {
    code: "SY",
    name: "水压传感器",
    description: "监测地下水压力变化",
    unit: "MPa",
    colorClass: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  },
  {
    code: "LL",
    name: "流量传感器",
    description: "监测排水/通风流量",
    unit: "m³/h",
    colorClass: "text-teal-400 border-teal-400/40 bg-teal-400/10",
  },
];

export const ExtensibleSensors: React.FC = () => {
  return (
    <div className="industrial-card p-4">
      <div className="industrial-title text-xs mb-4">可扩展传感器类型</div>
      <p className="text-xs text-dim mb-4">
        系统支持接入以下类型的传感器，可根据实际监测需求进行扩展配置
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {EXTENSIBLE_SENSOR_TYPES.map((sensor) => (
          <div
            key={sensor.code}
            className={`border rounded-lg p-3 ${sensor.colorClass} transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-semibold text-sm">
                {sensor.code}
              </span>
              <span className="text-xs opacity-60">({sensor.unit})</span>
            </div>
            <div className="text-xs font-medium mb-1">{sensor.name}</div>
            <div className="text-xs opacity-70 leading-tight">
              {sensor.description}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-edge flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-dim animate-pulse" />
        <span className="text-xs text-dim">待接入</span>
      </div>
    </div>
  );
};
