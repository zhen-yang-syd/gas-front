"use client";

import { BubbleWallChart } from "./BubbleWallChart";

interface BubbleData {
  label: string;
  cav: number;
  ulv: number;
  llv: number;
  is_pair_dynamic: boolean;
  pair_history_count: number;
  status: string;
  color: string;
  type?: string;       // T-T, T-WD, T-FS
  type_color?: string; // 类型颜色
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
  maxDisplay?: number;
  columns?: number;
}

/**
 * 气泡墙图网格组件
 *
 * 显示多个气泡墙图，每个代表一对传感器的相关性状态
 */
export function BubbleWallGrid({
  bubbles,
  globalThresholds,
  maxDisplay = 24,
  columns = 6,
}: BubbleWallGridProps) {
  // 限制显示数量
  const displayBubbles = bubbles.slice(0, maxDisplay);

  // 统计各状态数量
  const stats = {
    normal: bubbles.filter((b) =>
      ["NORMAL", "HIGH_NORMAL", "LOW_NORMAL"].includes(b.status)
    ).length,
    abnormal: bubbles.filter((b) =>
      ["HIGH_ABNORMAL", "LOW_ABNORMAL"].includes(b.status)
    ).length,
    warning: bubbles.filter((b) =>
      ["HIGH_WARNING", "LOW_WARNING"].includes(b.status)
    ).length,
  };

  // 统计各类型数量
  const typeStats = {
    "T-T": bubbles.filter((b) => b.type === "T-T").length,
    "T-WD": bubbles.filter((b) => b.type === "T-WD").length,
    "T-FS": bubbles.filter((b) => b.type === "T-FS").length,
  };

  // 类型颜色
  const typeColors: Record<string, string> = {
    "T-T": "#06B6D4",   // 青色 - Gas-Gas
    "T-WD": "#3B82F6",  // 蓝色 - Gas-Temp
    "T-FS": "#1E3A5F",  // 藏青色 - Gas-Wind
  };

  return (
    <div className="space-y-4">
      {/* 状态统计条 */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            正常: {stats.normal}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            异常: {stats.abnormal}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            警告: {stats.warning}
          </span>
        </div>
        <span className="text-slate-400">
          显示 {displayBubbles.length} / {bubbles.length} 对
        </span>
      </div>

      {/* 类型统计条 */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: typeColors["T-T"] }} />
          T-T: {typeStats["T-T"]}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: typeColors["T-WD"] }} />
          T-WD: {typeStats["T-WD"]}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: typeColors["T-FS"] }} />
          T-FS: {typeStats["T-FS"]}
        </span>
      </div>

      {/* 气泡墙图网格 */}
      {displayBubbles.length > 0 ? (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {displayBubbles.map((bubble, index) => (
            <div
              key={`${bubble.label}-${index}`}
              className="flex justify-center"
            >
              <BubbleWallChart
                label={bubble.label}
                cav={bubble.cav}
                ulv={bubble.ulv}
                llv={bubble.llv}
                isPairDynamic={bubble.is_pair_dynamic}
                pairHistoryCount={bubble.pair_history_count}
                status={bubble.status}
                color={bubble.color}
                sensorType={bubble.type || "T-T"}
                typeColor={bubble.type_color || typeColors[bubble.type || "T-T"]}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-slate-500">
          暂无数据
        </div>
      )}

      {/* 全局阈值参考信息 */}
      <div className="pt-2 border-t border-slate-700 space-y-2">
        {/* 独立阈值模式说明 */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 rounded">
            独立阈值模式
          </span>
          <span className="text-slate-500">
            每对传感器有独立的 ULV/LLV
          </span>
        </div>

        {/* 全局参考值显示 */}
        <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-400">
          <span className="text-slate-500">全局参考:</span>
          <span className="font-mono">
            ULV = <span className="text-yellow-400">{globalThresholds.ulv.toFixed(4)}</span>
          </span>
          <span className="font-mono">
            LLV = <span className="text-blue-400">{globalThresholds.llv.toFixed(4)}</span>
          </span>
          <span className="text-slate-500">
            (基于 {globalThresholds.total_history} 个样本)
          </span>
        </div>

        {/* 使用说明 */}
        <div className="text-center text-xs text-slate-500">
          Hover 查看每对传感器的独立阈值
        </div>
      </div>
    </div>
  );
}

export default BubbleWallGrid;
