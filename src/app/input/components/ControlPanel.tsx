"use client";

import React, { useState, useEffect } from "react";

interface ControlPanelProps {
  ratePerMinute: number;
  onRateChange: (rate: number) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onJump: (index: number) => void;
  isRunning: boolean;
  isCompleted: boolean;
  totalRows: number;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  ratePerMinute,
  onRateChange,
  onStart,
  onStop,
  onReset,
  onJump,
  isRunning,
  isCompleted,
  totalRows,
}) => {
  const [rateInput, setRateInput] = useState((ratePerMinute ?? 60).toString());
  const [jumpInput, setJumpInput] = useState("");

  // 当 ratePerMinute 从 API 更新时，同步输入框
  useEffect(() => {
    if (ratePerMinute !== undefined) {
      setRateInput(ratePerMinute.toString());
    }
  }, [ratePerMinute]);

  const handleRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseInt(rateInput, 10);
    if (rate > 0) {
      onRateChange(rate);
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const index = parseInt(jumpInput, 10);
    if (!isNaN(index) && index >= 0 && index <= totalRows) {
      onJump(index);
      setJumpInput("");
    }
  };

  return (
    <div className="industrial-card p-4">
      <div className="industrial-title text-xs mb-4">控制面板</div>

      {/* 更新频率 */}
      <div className="mb-4">
        <label className="text-xs text-dim mb-2 block">更新频率</label>
        <form onSubmit={handleRateSubmit} className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            className="bg-tertiary border border-edge text-bright px-3 py-1.5 rounded w-24 text-xs font-mono"
          />
          <span className="text-dim text-xs">条/分钟</span>
          <button
            type="submit"
            className="industrial-btn text-xs px-3 py-1.5 hover:border-accent"
          >
            应用
          </button>
        </form>
      </div>

      {/* 控制按钮 */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={onStart}
          disabled={isRunning || isCompleted}
          className="industrial-btn text-xs px-4 py-2 hover:text-ok hover:border-normal disabled:opacity-50"
        >
          开始
        </button>
        <button
          onClick={onStop}
          disabled={!isRunning}
          className="industrial-btn text-xs px-4 py-2 hover:text-err hover:border-danger disabled:opacity-50"
        >
          停止
        </button>
        <button
          onClick={onReset}
          className="industrial-btn text-xs px-4 py-2"
        >
          重置
        </button>
      </div>

      {/* 跳转 - 已隐藏 */}
      <div className="hidden">
        <label className="text-xs text-dim mb-2 block">跳转到索引</label>
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max={totalRows}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder={`0-${totalRows}`}
            className="bg-tertiary border border-edge text-bright px-3 py-1.5 rounded w-32 text-xs font-mono"
          />
          <button
            type="submit"
            disabled={!jumpInput}
            className="industrial-btn text-xs px-4 py-1.5 disabled:opacity-50"
          >
            跳转
          </button>
        </form>
      </div>
    </div>
  );
};
