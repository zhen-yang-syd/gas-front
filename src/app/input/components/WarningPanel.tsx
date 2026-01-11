"use client";

import React from "react";
import { WarningRecord } from "./types";

interface WarningPanelProps {
  warnings: WarningRecord[];
}

export const WarningPanel: React.FC<WarningPanelProps> = ({ warnings }) => {
  return (
    <div className="industrial-card p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="industrial-title text-xs text-warn">预警面板</div>
        <span className="text-xs text-dim font-mono">{warnings.length} 条预警</span>
      </div>

      <div className="overflow-auto max-h-64 custom-scrollbar">
        {warnings.length === 0 ? (
          <div className="py-8 text-center text-dim text-xs">暂无预警记录</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-dim border-b border-edge">
                <th className="text-left py-2 px-2 font-mono">时间</th>
                <th className="text-left py-2 px-2 font-mono">类型</th>
                <th className="text-left py-2 px-2 font-mono">数值</th>
                <th className="text-left py-2 px-2 font-mono">规则</th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((warning) => (
                <tr
                  key={warning.id}
                  className="border-b border-edge/50 hover:bg-tertiary/30"
                >
                  <td className="py-1.5 px-2 text-soft font-mono">{warning.time}</td>
                  <td className="py-1.5 px-2 text-warn font-mono">{warning.sensor}</td>
                  <td className="py-1.5 px-2 text-warn font-mono">
                    {warning.value.toFixed(4)}
                  </td>
                  <td className="py-1.5 px-2 text-dim">{warning.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
