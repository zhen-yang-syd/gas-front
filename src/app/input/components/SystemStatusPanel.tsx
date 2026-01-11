"use client";

import React from "react";
import { AppState } from "./types";
import { formatRuntime } from "./utils";

interface SystemStatusPanelProps {
  state: AppState;
  currentIndex: number;
  totalRows: number;
  runtime: number;
}

export const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({
  state,
  currentIndex,
  totalRows,
  runtime,
}) => {
  // 计算进度，确保不超过100%
  const progress =
    totalRows > 0 ? Math.min((currentIndex / totalRows) * 100, 100) : 0;

  const stateText = {
    stopped: "已停止",
    running: "运行中",
    completed: "已完成",
  }[state];

  const stateClass = {
    stopped: "text-dim",
    running: "text-ok",
    completed: "text-accent",
  }[state];

  const stateIndicator = {
    stopped: "status-muted",
    running: "status-normal",
    completed: "status-info",
  }[state];

  return (
    <div className="industrial-card p-4">
      <div className="industrial-title text-xs mb-4">系统状态</div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-dim mb-1">状态</div>
          <div className="flex items-center gap-2">
            <span className={`status-indicator ${stateIndicator}`} />
            <span className={`font-mono text-lg ${stateClass}`}>{stateText}</span>
          </div>
        </div>

        <div>
          <div className="text-xs text-dim mb-1">运行时间</div>
          <div className="font-mono text-lg text-accent">{formatRuntime(runtime)}</div>
        </div>

        <div>
          <div className="text-xs text-dim mb-1">当前索引</div>
          <div className="font-mono text-lg text-bright">
            {currentIndex.toLocaleString()}
            <span className="text-dim text-sm"> / {totalRows.toLocaleString()}</span>
          </div>
        </div>

        <div>
          <div className="text-xs text-dim mb-1">进度</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-tertiary rounded overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-sm text-accent">
              {progress.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
