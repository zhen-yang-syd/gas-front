"use client";

import React from "react";
import { CavHistoryRecord } from "../lib/types";

interface CavHistoryProps {
  records: CavHistoryRecord[];
}

// 类型颜色映射
const TYPE_COLORS: Record<string, string> = {
  "T-T": "text-cyan-400",
  "T-WD": "text-orange-400",
  "T-FS": "text-purple-400",
};

export const CavHistory: React.FC<CavHistoryProps> = ({
  records,
}) => {
  // 累计统计
  const totalAlarmCount = records.filter((r) => r.level === "alarm").length;
  const totalWarningCount = records.filter((r) => r.level === "warning").length;

  return (
    <div className="industrial-card p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="industrial-title text-xs">告警历史</div>
        <div className="flex items-center gap-3 text-xs font-mono">
          {totalAlarmCount > 0 && (
            <span className="text-err">累计 {totalAlarmCount} 告警</span>
          )}
          {totalWarningCount > 0 && (
            <span className="text-warn">累计 {totalWarningCount} 预警</span>
          )}
          <span className="text-dim">共 {records.length} 条</span>
        </div>
      </div>

      <div className="overflow-auto max-h-64 custom-scrollbar">
        {records.length === 0 ? (
          <div className="py-8 text-center text-dim text-xs">暂无告警数据</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-dim border-b border-edge">
                <th className="text-left py-2 px-2 font-mono">时间</th>
                <th className="text-left py-2 px-2 font-mono">传感器对</th>
                <th className="text-left py-2 px-2 font-mono">类型</th>
                <th className="text-left py-2 px-2 font-mono">CAV</th>
                <th className="text-left py-2 px-2 font-mono">状态</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const levelClass =
                  record.level === "alarm"
                    ? "text-err"
                    : record.level === "warning"
                    ? "text-warn"
                    : "text-soft";
                const levelText =
                  record.level === "alarm"
                    ? "告警"
                    : record.level === "warning"
                    ? "预警"
                    : "正常";
                const rowBg =
                  record.level === "alarm"
                    ? "bg-err/10"
                    : record.level === "warning"
                    ? "bg-warn/10"
                    : "";
                const typeColor = TYPE_COLORS[record.pairType] || "text-soft";

                return (
                  <tr
                    key={record.id}
                    className={`border-b border-edge/50 hover:bg-tertiary/30 ${rowBg}`}
                  >
                    <td className="py-1.5 px-2 text-soft font-mono">{record.time}</td>
                    <td className="py-1.5 px-2 font-mono text-bright">
                      {record.sensorPair[0]} - {record.sensorPair[1]}
                    </td>
                    <td className={`py-1.5 px-2 font-mono ${typeColor}`}>
                      {record.pairType}
                    </td>
                    <td className={`py-1.5 px-2 font-mono ${levelClass}`}>
                      {record.cav.toFixed(4)}
                    </td>
                    <td className={`py-1.5 px-2 font-mono ${levelClass}`}>
                      {levelText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
