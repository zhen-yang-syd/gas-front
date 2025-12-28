"use client";

interface KMOResult {
  value: number;
  threshold: number;
  passed: boolean;
  interpretation: string;
  msa_per_variable: Record<string, number>;
}

interface KMOCardProps {
  data: KMOResult;
}

export function KMOCard({ data }: KMOCardProps) {
  const { value, threshold, passed, interpretation } = data;

  // 计算进度条百分比 (0-1 范围映射到 0-100%)
  const percentage = Math.min(Math.max(value * 100, 0), 100);

  // 根据值确定颜色
  const getColor = () => {
    if (value >= 0.9) return "bg-blue-500";
    if (value >= 0.8) return "bg-blue-400";
    if (value >= 0.7) return "bg-cyan-400";
    if (value >= 0.6) return "bg-yellow-400";
    return "bg-red-400";
  };

  return (
    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
      {/* 标题 */}
      <div className="text-xs text-slate-400 mb-2">KMO 检验</div>

      {/* 数值 */}
      <div className="text-center mb-2">
        <span className="text-2xl font-bold text-white">{value.toFixed(2)}</span>
      </div>

      {/* 进度条 */}
      <div className="relative h-2 bg-slate-700 rounded-full mb-2">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${getColor()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
        {/* 阈值标记 */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/50"
          style={{ left: `${threshold * 100}%` }}
        />
      </div>

      {/* 阈值说明 */}
      <div className="flex justify-between text-xs text-slate-500 mb-2">
        <span>0</span>
        <span>阈值: {threshold}</span>
        <span>1</span>
      </div>

      {/* 结果 */}
      <div className={`text-xs text-center ${passed ? "text-green-400" : "text-red-400"}`}>
        {passed ? "✓" : "✗"} {passed ? "通过" : "未通过"} ({interpretation})
      </div>
    </div>
  );
}

export default KMOCard;
