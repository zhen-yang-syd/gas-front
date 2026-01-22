"use client";

import React from "react";
import { AlarmRecord } from "./types";

interface AlarmHistoryProps {
  alarms: AlarmRecord[];
}

export const AlarmHistory: React.FC<AlarmHistoryProps> = ({
  alarms,
}) => {
  // 统计告警和预警数量（累计统计所有记录）
  const alertCount = alarms.filter(a => a.status === "alert").length;
  const warningCount = alarms.filter(a => a.status === "warning").length;

  return (
    <div className="industrial-card p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="industrial-title text-xs">告警历史</div>
        <div className="flex gap-3 text-xs font-mono">
          <span className="text-err">{alertCount} 告警</span>
          <span className="text-warn">{warningCount} 预警</span>
          <span className="text-dim">共 {alarms.length} 条</span>
        </div>
      </div>

      <div className="overflow-auto max-h-96 custom-scrollbar">
        {alarms.length === 0 ? (
          <div className="py-8 text-center text-dim text-xs">暂无告警记录</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="text-dim border-b border-edge">
                <th className="text-left py-2 px-1.5 font-mono whitespace-nowrap">时间</th>
                <th className="text-left py-2 px-1.5 font-mono whitespace-nowrap">传感器对</th>
                <th className="text-right py-2 px-1.5 font-mono whitespace-nowrap">S1值</th>
                <th className="text-right py-2 px-1.5 font-mono whitespace-nowrap">S2值</th>
                <th className="text-right py-2 px-1.5 font-mono whitespace-nowrap">CAV</th>
                <th className="text-right py-2 px-1.5 font-mono whitespace-nowrap">ULV</th>
                <th className="text-right py-2 px-1.5 font-mono whitespace-nowrap">LLV</th>
                <th className="text-left py-2 px-1.5 font-mono whitespace-nowrap">原因</th>
                <th className="text-center py-2 px-1.5 font-mono whitespace-nowrap">状态</th>
              </tr>
            </thead>
            <tbody>
              {alarms.map((alarm) => (
                <tr
                  key={alarm.id}
                  className={`border-b border-edge/50 hover:bg-tertiary/30 ${
                    alarm.status === "alert" ? "bg-err/5" : "bg-warn/5"
                  }`}
                >
                  <td className="py-1.5 px-1.5 text-soft font-mono whitespace-nowrap">
                    {alarm.time}
                  </td>
                  <td className="py-1.5 px-1.5 font-mono whitespace-nowrap">
                    <span className={alarm.status === "alert" ? "text-err" : "text-warn"}>
                      {alarm.sensorPair}
                    </span>
                  </td>
                  <td className="py-1.5 px-1.5 text-soft font-mono text-right">
                    {alarm.sensor1Value.toFixed(3)}
                  </td>
                  <td className="py-1.5 px-1.5 text-soft font-mono text-right">
                    {alarm.sensor2Value.toFixed(3)}
                  </td>
                  <td className="py-1.5 px-1.5 font-mono text-right">
                    <span className={alarm.status === "alert" ? "text-err" : "text-warn"}>
                      {alarm.cav.toFixed(4)}
                    </span>
                  </td>
                  <td className="py-1.5 px-1.5 text-dim font-mono text-right">
                    {alarm.ulv.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-1.5 text-dim font-mono text-right">
                    {alarm.llv.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-1.5 text-soft text-left whitespace-nowrap">
                    {alarm.reason}
                  </td>
                  <td className="py-1.5 px-1.5 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        alarm.status === "alert"
                          ? "bg-err/20 text-err"
                          : "bg-warn/20 text-warn"
                      }`}
                    >
                      {alarm.status === "alert" ? "告警" : "预警"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
