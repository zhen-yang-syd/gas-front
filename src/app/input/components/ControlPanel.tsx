"use client";

import React, { useState } from "react";

interface ControlPanelProps {
  frequency: number;
  onFrequencyChange: (freq: number) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onJump: (index: number) => void;
  isRunning: boolean;
  isCompleted: boolean;
  totalRows: number;
}

const FREQUENCIES = [
  { value: 1, label: "1 条/秒" },
  { value: 10, label: "10 条/秒" },
  { value: 50, label: "50 条/秒" },
  { value: 100, label: "100 条/秒" },
  { value: 200, label: "200 条/秒" },
];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  frequency,
  onFrequencyChange,
  onStart,
  onStop,
  onReset,
  onJump,
  isRunning,
  isCompleted,
  totalRows,
}) => {
  const [jumpInput, setJumpInput] = useState("");

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
        <div className="flex gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              onClick={() => onFrequencyChange(f.value)}
              className={`industrial-btn text-xs px-3 py-1.5 ${
                frequency === f.value ? "border-accent text-accent" : ""
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex gap-3">
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

      {/* 跳转 */}
      <div className="mt-4">
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
