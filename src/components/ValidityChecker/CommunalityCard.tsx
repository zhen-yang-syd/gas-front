"use client";

interface CommunalityResult {
  values: Record<string, number>;
  avg_value: number;
  threshold: number;
  passed: boolean;
  low_communality_vars: string[];
}

interface CommunalityCardProps {
  data: CommunalityResult;
}

export function CommunalityCard({ data }: CommunalityCardProps) {
  const { avg_value, threshold, passed, low_communality_vars } = data;

  // 计算进度条百分比 (0-1 范围映射到 0-100%)
  const percentage = Math.min(Math.max(avg_value * 100, 0), 100);

  // 根据值确定颜色
  const getColor = () => {
    if (avg_value >= 0.8) return "bg-green-500";
    if (avg_value >= 0.7) return "bg-green-400";
    if (avg_value >= 0.6) return "bg-yellow-400";
    if (avg_value >= 0.5) return "bg-orange-400";
    return "bg-red-400";
  };

  // 获取解释文字
  const getInterpretation = () => {
    if (avg_value >= 0.8) return "优秀";
    if (avg_value >= 0.7) return "良好";
    if (avg_value >= 0.6) return "可接受";
    if (avg_value >= 0.5) return "边缘";
    return "不足";
  };

  return (
    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
      {/* 标题 */}
      <div className="text-xs text-slate-400 mb-2">Communality</div>

      {/* 数值 */}
      <div className="text-center mb-2">
        <span className="text-2xl font-bold text-white">{avg_value.toFixed(2)}</span>
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
        {passed ? "✓" : "✗"} {passed ? "通过" : "未通过"} ({getInterpretation()})
      </div>

      {/* 低共同性变量提示 */}
      {low_communality_vars.length > 0 && (
        <div className="mt-2 text-xs text-amber-400">
          低共同性: {low_communality_vars.slice(0, 3).join(", ")}
          {low_communality_vars.length > 3 && ` +${low_communality_vars.length - 3}`}
        </div>
      )}
    </div>
  );
}

export default CommunalityCard;
