"use client";

import React, { useRef } from "react";
import { RowRecord } from "./types";
import { formatValue } from "./utils";

interface RealtimeTableProps {
  data: RowRecord[];
  sensorNames: string[];
  maxRows: number;
}

export const RealtimeTable: React.FC<RealtimeTableProps> = ({
  data,
  sensorNames,
  maxRows,
}) => {
  const tableRef = useRef<HTMLDivElement>(null);

  // 反转数据顺序：新数据在最上面
  const displayData = data.slice(-maxRows).reverse();

  // 按类型分组传感器
  const tSensors = sensorNames.filter((s) => s.startsWith("T"));
  const wdSensors = sensorNames.filter((s) => s.startsWith("WD"));
  const fsSensors = sensorNames.filter((s) => s.startsWith("FS"));
  const wySensors = sensorNames.filter((s) => s.startsWith("WY"));
  const ylSensors = sensorNames.filter((s) => s.startsWith("YL"));
  const coSensors = sensorNames.filter((s) => s.startsWith("CO"));
  const sySensors = sensorNames.filter((s) => s.startsWith("SY"));
  const llSensors = sensorNames.filter((s) => s.startsWith("LL"));

  // 传感器阈值配置
  const thresholds: Record<string, { warning: number; danger: number }> = {
    WY: { warning: 3.0, danger: 10.0 },
    YL: { warning: 15.0, danger: 25.0 },
    CO: { warning: 0.5, danger: 1.5 },
    SY: { warning: 0.6, danger: 1.2 },
    LL: { warning: 5.0, danger: 20.0 },
  };

  // 根据传感器名和值获取样式类
  const getValueClass = (name: string, value: number | null): string => {
    if (value === null) return "text-dim";
    const prefix = name.replace(/\d+$/, "");
    const th = thresholds[prefix];
    if (th) {
      if (value > th.danger) return "text-err bg-danger/10";
      if (value > th.warning) return "text-warn bg-warning/10";
    }
    return "";
  };

  return (
    <div className="industrial-card p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="industrial-title text-xs">实时数据流</div>
        <span className="text-xs text-dim font-mono">{displayData.length} 条记录</span>
      </div>
      <div
        ref={tableRef}
        className="overflow-auto max-h-96 custom-scrollbar"
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-dim border-b border-edge">
              <th className="text-left py-2 px-2 font-mono whitespace-nowrap">时间</th>
              {tSensors.map((name) => (
                <th
                  key={name}
                  className="text-center py-2 px-1 font-mono text-ok"
                  title={name}
                >
                  {name.slice(-4)}
                </th>
              ))}
              {wdSensors.map((name) => (
                <th
                  key={name}
                  className="text-center py-2 px-1 font-mono text-note"
                  title={name}
                >
                  {name}
                </th>
              ))}
              {fsSensors.map((name) => (
                <th
                  key={name}
                  className="text-center py-2 px-1 font-mono text-fs-sensor"
                  title={name}
                >
                  {name}
                </th>
              ))}
              {wySensors.map((name) => (
                <th
                  key={name}
                  className="text-center py-2 px-1 font-mono text-purple-400"
                  title={name}
                >
                  {name}
                </th>
              ))}
              {ylSensors.map((name) => (
                <th
                  key={name}
                  className="text-center py-2 px-1 font-mono text-orange-400"
                  title={name}
                >
                  {name}
                </th>
              ))}
              {coSensors.map((name) => (
                <th
                  key={name}
                  className="text-center py-2 px-1 font-mono text-red-400"
                  title={name}
                >
                  {name}
                </th>
              ))}
              {sySensors.map((name) => (
                <th
                  key={name}
                  className="text-center py-2 px-1 font-mono text-blue-400"
                  title={name}
                >
                  {name}
                </th>
              ))}
              {llSensors.map((name) => (
                <th
                  key={name}
                  className="text-center py-2 px-1 font-mono text-teal-400"
                  title={name}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td
                  colSpan={sensorNames.length + 1}
                  className="py-8 text-center text-dim"
                >
                  等待数据流...
                </td>
              </tr>
            ) : (
              displayData.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-edge/50 hover:bg-tertiary/30"
                >
                  <td className="py-1.5 px-2 font-mono text-soft whitespace-nowrap">
                    {row.timestamp}
                  </td>
                  {tSensors.map((name) => {
                    const value = row.sensors[name] ?? null;
                    const isWarning = value !== null && value > 0.8;
                    const isDanger = value !== null && value > 1.0;
                    return (
                      <td
                        key={name}
                        className={`py-1.5 px-1 text-center font-mono ${
                          isDanger
                            ? "text-err bg-danger/10"
                            : isWarning
                            ? "text-warn bg-warning/10"
                            : "text-ok"
                        }`}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  })}
                  {wdSensors.map((name) => (
                    <td
                      key={name}
                      className="py-1.5 px-1 text-center font-mono text-note"
                    >
                      {formatValue(row.sensors[name] ?? null)}
                    </td>
                  ))}
                  {fsSensors.map((name) => (
                    <td
                      key={name}
                      className="py-1.5 px-1 text-center font-mono text-fs-sensor"
                    >
                      {formatValue(row.sensors[name] ?? null)}
                    </td>
                  ))}
                  {wySensors.map((name) => {
                    const value = row.sensors[name] ?? null;
                    return (
                      <td
                        key={name}
                        className={`py-1.5 px-1 text-center font-mono text-purple-400 ${getValueClass(name, value)}`}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  })}
                  {ylSensors.map((name) => {
                    const value = row.sensors[name] ?? null;
                    return (
                      <td
                        key={name}
                        className={`py-1.5 px-1 text-center font-mono text-orange-400 ${getValueClass(name, value)}`}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  })}
                  {coSensors.map((name) => {
                    const value = row.sensors[name] ?? null;
                    return (
                      <td
                        key={name}
                        className={`py-1.5 px-1 text-center font-mono text-red-400 ${getValueClass(name, value)}`}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  })}
                  {sySensors.map((name) => {
                    const value = row.sensors[name] ?? null;
                    return (
                      <td
                        key={name}
                        className={`py-1.5 px-1 text-center font-mono text-blue-400 ${getValueClass(name, value)}`}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  })}
                  {llSensors.map((name) => {
                    const value = row.sensors[name] ?? null;
                    return (
                      <td
                        key={name}
                        className={`py-1.5 px-1 text-center font-mono text-teal-400 ${getValueClass(name, value)}`}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
