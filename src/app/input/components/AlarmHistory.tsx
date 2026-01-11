"use client";

import React from "react";
import { AlarmRecord } from "./types";

interface AlarmHistoryProps {
  alarms: AlarmRecord[];
  maxAlarms: number;
}

export const AlarmHistory: React.FC<AlarmHistoryProps> = ({
  alarms,
  maxAlarms,
}) => {
  const displayAlarms = alarms.slice(-maxAlarms);

  return (
    <div className="industrial-card p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="industrial-title text-xs">告警历史</div>
        <span className="text-xs text-dim font-mono">{alarms.length} 条告警</span>
      </div>

      <div className="overflow-auto max-h-64 custom-scrollbar">
        {displayAlarms.length === 0 ? (
          <div className="py-8 text-center text-dim text-xs">暂无告警记录</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-dim border-b border-edge">
                <th className="text-left py-2 px-2 font-mono">时间</th>
                <th className="text-left py-2 px-2 font-mono">传感器</th>
                <th className="text-left py-2 px-2 font-mono">数值</th>
                <th className="text-left py-2 px-2 font-mono">规则</th>
              </tr>
            </thead>
            <tbody>
              {displayAlarms.map((alarm) => (
                <tr
                  key={alarm.id}
                  className="border-b border-edge/50 hover:bg-tertiary/30"
                >
                  <td className="py-1.5 px-2 text-soft font-mono">{alarm.time}</td>
                  <td className="py-1.5 px-2 text-err font-mono">{alarm.sensor}</td>
                  <td className="py-1.5 px-2 text-err font-mono">
                    {alarm.value.toFixed(3)}
                  </td>
                  <td className="py-1.5 px-2 text-dim">{alarm.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
