"use client";

import React, { useRef, useEffect } from "react";
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
  const shouldScrollRef = useRef(true);

  // 自动滚动到底部
  useEffect(() => {
    if (shouldScrollRef.current && tableRef.current) {
      tableRef.current.scrollTop = tableRef.current.scrollHeight;
    }
  }, [data]);

  const handleScroll = () => {
    if (tableRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = tableRef.current;
      shouldScrollRef.current = scrollTop + clientHeight >= scrollHeight - 10;
    }
  };

  const displayData = data.slice(-maxRows);

  // 按类型分组传感器
  const tSensors = sensorNames.filter((s) => s.startsWith("T"));
  const wdSensors = sensorNames.filter((s) => s.startsWith("WD"));
  const fsSensors = sensorNames.filter((s) => s.startsWith("FS"));

  return (
    <div className="industrial-card p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="industrial-title text-xs">实时数据流</div>
        <span className="text-xs text-dim font-mono">{displayData.length} 条记录</span>
      </div>
      <div
        ref={tableRef}
        onScroll={handleScroll}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
