"use client";

import { useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BubbleWallChart } from "./BubbleWallChart";

interface BubbleData {
  label: string;
  cav: number;
  ulv: number;
  llv: number;
  is_pair_dynamic: boolean;
  pair_history_count: number;
  change_magnitude?: number;  // 波动幅度
  historical_avg?: number;    // 历史平均值
  has_data?: boolean;         // 是否有有效数据
  status: string;
  color: string;
  type?: string;       // T-T, T-WD, T-FS
  type_color?: string; // 类型颜色
  sensor_pair?: string[];
}

interface GlobalThresholds {
  ulv: number;
  llv: number;
  default_ulv: number;
  default_llv: number;
  is_dynamic: boolean;
  is_using_dynamic: boolean;
  total_history: number;
  dynamic_pairs: number;
  total_pairs: number;
  min_samples_per_pair: number;
}

interface BubbleWallGridProps {
  bubbles: BubbleData[];
  globalThresholds: GlobalThresholds;
  maxDisplay?: number;  // 保留兼容性，但默认不限制
  columns?: number;
}

// 类型过滤选项
type TypeFilter = "all" | "T-T" | "T-WD" | "T-FS";

/**
 * 气泡墙图网格组件
 *
 * 支持显示全部756对传感器，按波动幅度排序
 * 使用虚拟滚动优化大量卡片的渲染性能
 */
export function BubbleWallGrid({
  bubbles,
  globalThresholds,
  maxDisplay,  // 如果不传，显示全部
  columns: _columns = 5,
}: BubbleWallGridProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [showOnlyWithData, setShowOnlyWithData] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 类型颜色
  const typeColors: Record<string, string> = {
    "T-T": "#06B6D4",   // 青色 - Gas-Gas
    "T-WD": "#3B82F6",  // 蓝色 - Gas-Temp
    "T-FS": "#1E3A5F",  // 藏青色 - Gas-Wind
  };

  // 过滤和排序气泡
  const filteredBubbles = useMemo(() => {
    let filtered = bubbles;

    // 按类型过滤
    if (typeFilter !== "all") {
      filtered = filtered.filter((b) => b.type === typeFilter);
    }

    // 只显示有数据的
    if (showOnlyWithData) {
      filtered = filtered.filter((b) => b.has_data !== false);
    }

    // 限制显示数量（如果指定了 maxDisplay）
    if (maxDisplay && maxDisplay > 0) {
      filtered = filtered.slice(0, maxDisplay);
    }

    return filtered;
  }, [bubbles, typeFilter, showOnlyWithData, maxDisplay]);

  // 统计各状态数量
  const stats = useMemo(() => ({
    normal: bubbles.filter((b) =>
      ["NORMAL", "HIGH_NORMAL", "LOW_NORMAL"].includes(b.status)
    ).length,
    abnormal: bubbles.filter((b) =>
      ["HIGH_ABNORMAL", "LOW_ABNORMAL"].includes(b.status)
    ).length,
    warning: bubbles.filter((b) =>
      ["HIGH_WARNING", "LOW_WARNING"].includes(b.status)
    ).length,
    noData: bubbles.filter((b) => b.has_data === false).length,
    total: bubbles.length,
  }), [bubbles]);

  // 统计各类型数量
  const typeStats = useMemo(() => ({
    "T-T": bubbles.filter((b) => b.type === "T-T").length,
    "T-WD": bubbles.filter((b) => b.type === "T-WD").length,
    "T-FS": bubbles.filter((b) => b.type === "T-FS").length,
  }), [bubbles]);

  // 获取前10个最高波动的传感器对
  const topVolatile = useMemo(() => {
    return bubbles
      .filter((b) => b.has_data !== false && (b.change_magnitude ?? 0) > 0)
      .slice(0, 10);
  }, [bubbles]);

  return (
    <div className="space-y-3">
      {/* 状态统计条 */}
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            正常: {stats.normal}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            异常: {stats.abnormal}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            警告: {stats.warning}
          </span>
          {stats.noData > 0 && (
            <span className="flex items-center gap-1 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              无数据: {stats.noData}
            </span>
          )}
        </div>
        <span className="text-slate-400">
          显示 {filteredBubbles.length} / {stats.total} 对
        </span>
      </div>

      {/* 类型过滤器 */}
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">过滤:</span>
          {(["all", "T-T", "T-WD", "T-FS"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTypeFilter(filter)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                typeFilter === filter
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {filter === "all" ? "全部" : filter}
              {filter !== "all" && ` (${typeStats[filter]})`}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyWithData}
            onChange={(e) => setShowOnlyWithData(e.target.checked)}
            className="w-3 h-3 rounded"
          />
          只显示有数据的
        </label>
      </div>

      {/* 高波动传感器对提示 */}
      {topVolatile.length > 0 && (
        <div className="px-3 py-2 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs">
          <div className="flex items-center gap-2 text-yellow-400 mb-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            高波动传感器对 (Top 5):
          </div>
          <div className="flex flex-wrap gap-2">
            {topVolatile.slice(0, 5).map((b) => (
              <span
                key={b.label}
                className="px-2 py-0.5 bg-yellow-800/30 text-yellow-300 rounded font-mono"
              >
                {b.label}: Δ{(b.change_magnitude ?? 0).toFixed(3)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 气泡墙图网格 - 可滚动容器 */}
      {filteredBubbles.length > 0 ? (
        <div
          ref={containerRef}
          className="overflow-y-auto max-h-[500px] pr-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800"
        >
          <div className="grid grid-cols-5 gap-2">
            <AnimatePresence mode="popLayout">
              {filteredBubbles.map((bubble) => (
                <motion.div
                  key={bubble.label}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: bubble.has_data === false ? 0.5 : 1,
                    scale: 1,
                  }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    layout: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.2 },
                  }}
                  className="aspect-square"
                >
                  <BubbleWallChart
                    label={bubble.label}
                    cav={bubble.cav}
                    ulv={bubble.ulv}
                    llv={bubble.llv}
                    isPairDynamic={bubble.is_pair_dynamic}
                    pairHistoryCount={bubble.pair_history_count}
                    changeMagnitude={bubble.change_magnitude}
                    hasData={bubble.has_data}
                    status={bubble.status}
                    color={bubble.color}
                    sensorType={bubble.type || "T-T"}
                    typeColor={bubble.type_color || typeColors[bubble.type || "T-T"]}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="h-32 flex items-center justify-center text-slate-500">
          暂无数据
        </div>
      )}

      {/* 全局阈值参考信息 */}
      <div className="pt-2 border-t border-slate-700 space-y-1">
        {/* 全局参考值显示 */}
        <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-400">
          <span className="text-slate-500">全局参考:</span>
          <span className="font-mono">
            ULV = <span className="text-yellow-400">{globalThresholds.ulv.toFixed(3)}</span>
          </span>
          <span className="font-mono">
            LLV = <span className="text-blue-400">{globalThresholds.llv.toFixed(3)}</span>
          </span>
          <span className="text-slate-500">
            ({globalThresholds.total_history} 样本)
          </span>
        </div>
      </div>
    </div>
  );
}

export default BubbleWallGrid;
